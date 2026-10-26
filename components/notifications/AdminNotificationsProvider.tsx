"use client";

import {
  getAdminNotificationSocketUrlAction,
  getAdminNotificationsAction,
  markAdminNotificationReadAction,
  markAllAdminNotificationsReadAction,
} from "@/app/actions/notifications";
import { toast } from "@/components/ui/Toast";
import {
  mergeNotifications,
  notificationHref,
  parseSocketEvent,
  reconnectDelayMs,
  unreadForPath,
  type AdminNotification,
} from "@/lib/notifications/adminNotifications";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AdminNotificationsContextValue = {
  notifications: AdminNotification[];
  unreadCount: number;
  connected: boolean;
  open: (notification: AdminNotification) => void;
  markAllRead: () => void;
};

const AdminNotificationsContext = createContext<AdminNotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  connected: false,
  open: () => undefined,
  markAllRead: () => undefined,
});

export const useAdminNotifications = () => useContext(AdminNotificationsContext);

// Safety net for missed socket frames (sleeping laptops, proxies dropping idle
// connections): re-read the list on this interval and whenever the tab returns.
const RESYNC_INTERVAL_MS = 60_000;

/**
 * Keeps one notification socket open for the signed-in admin, so a new support
 * ticket or customer reply shows up immediately as a toast, a bell entry and
 * the Support badge, on whatever page the admin is on.
 */
export default function AdminNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // State is only ever set once the request settles, never synchronously in
  // the effects that trigger it.
  const resync = useCallback(
    () =>
      getAdminNotificationsAction().then((result) => {
        if (!result.ok) return;
        setNotifications((current) => mergeNotifications(current, result.data.notifications));
        setUnreadCount(result.data.unreadCount);
      }),
    [],
  );

  const markRead = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setNotifications((current) =>
      current.map((item) => (idSet.has(item._id) ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - ids.length));
    void Promise.all(ids.map((id) => markAdminNotificationReadAction(id)));
  }, []);

  const open = useCallback(
    (notification: AdminNotification) => {
      if (!notification.isRead) markRead([notification._id]);
      router.push(notificationHref(notification));
    },
    [markRead, router],
  );

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    void markAllAdminNotificationsReadAction();
  }, []);

  // Initial load plus periodic and on-focus resync.
  useEffect(() => {
    void resync();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void resync();
    }, RESYNC_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [resync]);

  // One socket for the session, reconnecting with backoff and a fresh ticket.
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (disposed) return;
      reconnectTimer = setTimeout(() => void connect(), reconnectDelayMs(attempt));
      attempt += 1;
    };

    const connect = async () => {
      const ticket = await getAdminNotificationSocketUrlAction();
      if (disposed) return;
      if (!ticket.ok) {
        scheduleReconnect();
        return;
      }
      socket = new WebSocket(ticket.data);
      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
        void resync();
      };
      socket.onmessage = (message) => {
        const event = parseSocketEvent(String(message.data));
        if (event.kind === "unread-count") {
          setUnreadCount(event.count);
          return;
        }
        if (event.kind !== "new") return;
        const notification = event.notification;
        setNotifications((current) => mergeNotifications(current, [notification]));
        if (notification.isRead) return;
        setUnreadCount((count) => count + 1);
        // Already looking at this ticket: the page refreshes itself, so mark
        // it read instead of interrupting with a toast.
        if (unreadForPath([notification], pathnameRef.current).length) {
          markRead([notification._id]);
          router.refresh();
          return;
        }
        toast.alert(
          `${notification.title}: ${notification.message}`,
          () => open(notification),
          notification._id,
        );
        if (pathnameRef.current === "/support" || pathnameRef.current === "/dashboard") {
          router.refresh();
        }
      };
      socket.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };
      socket.onerror = () => socket?.close();
    };

    void connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [markRead, open, resync, router]);

  // Opening a ticket clears its alerts.
  useEffect(() => {
    const ids = unreadForPath(notifications, pathname).map((item) => item._id);
    if (!ids.length) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) markRead(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [markRead, notifications, pathname]);

  const value = useMemo(
    () => ({ notifications, unreadCount, connected, open, markAllRead }),
    [notifications, unreadCount, connected, open, markAllRead],
  );

  return (
    <AdminNotificationsContext.Provider value={value}>{children}</AdminNotificationsContext.Provider>
  );
}

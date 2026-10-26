"use client";

import { useAdminNotifications } from "@/components/notifications/AdminNotificationsProvider";
import { badgeLabel } from "@/lib/notifications/adminNotifications";
import { cn } from "@/lib/utils";
import { Bell, LifeBuoy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const timeAgo = (iso: string): string => {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

type Props = {
  /** Where the panel opens: beside the desktop sidebar or under the mobile header. */
  placement: "sidebar" | "header";
  className?: string;
};

export default function NotificationBell({ placement, className }: Props) {
  const { notifications, unreadCount, connected, open, markAllRead } = useAdminNotifications();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const label = badgeLabel(unreadCount);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        title={connected ? "Notifications (live)" : "Notifications"}
        className={cn(
          "relative flex items-center justify-center rounded-2xl text-slate-500 transition hover:bg-primary/10 hover:text-primary dark:text-slate-400",
          className,
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {label ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white dark:ring-[#0d1d28]">
            {label}
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className={cn(
            "fixed z-[60] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-[#283c4a] dark:bg-[#0d1d28]",
            placement === "sidebar" ? "bottom-4 left-[100px]" : "right-3 top-[66px]",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#203541]">
            <div>
              <p className="text-sm font-bold text-[#12213a] dark:text-slate-50">Notifications</p>
              <p className="text-[11px] text-slate-400">
                {connected ? "Live" : "Reconnecting…"} · {unreadCount} unread
              </p>
            </div>
            {unreadCount ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-[#009ca4] hover:underline dark:text-cyan-300"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <li key={notification._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded(false);
                      open(notification);
                    }}
                    className={cn(
                      "flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-[#1b2d3a] dark:hover:bg-[#102532]",
                      !notification.isRead && "bg-cyan-50/60 dark:bg-cyan-950/20",
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-[#009ca4] dark:bg-cyan-500/10 dark:text-cyan-300">
                      <LifeBuoy size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {notification.title}
                        </span>
                        {!notification.isRead ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="Unread" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(notification.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications yet.
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// Pure helpers for the admin's support alerts. The backend creates a
// `support_ticket` notification for every admin when a ticket is opened or a
// customer replies, and pushes it over /api/notifications/ws.

export type AdminNotification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: { ticketId?: string; ticketNumber?: number; audience?: string };
};

export type SocketEvent =
  | { kind: "new"; notification: AdminNotification }
  | { kind: "unread-count"; count: number }
  | { kind: "ignore" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const toAdminNotification = (value: unknown): AdminNotification | null => {
  if (!isRecord(value)) return null;
  const id = value._id ?? value.id;
  if (typeof id !== "string" || typeof value.title !== "string") return null;
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  return {
    _id: id,
    type: typeof value.type === "string" ? value.type : "",
    title: value.title,
    message: typeof value.message === "string" ? value.message : "",
    isRead: value.isRead === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    metadata: {
      ticketId: typeof metadata.ticketId === "string" ? metadata.ticketId : undefined,
      ticketNumber: typeof metadata.ticketNumber === "number" ? metadata.ticketNumber : undefined,
      audience: typeof metadata.audience === "string" ? metadata.audience : undefined,
    },
  };
};

export const parseSocketEvent = (raw: string): SocketEvent => {
  try {
    const payload = JSON.parse(raw) as { event?: unknown; data?: unknown };
    if (payload.event === "notification:new") {
      const notification = toAdminNotification(payload.data);
      return notification ? { kind: "new", notification } : { kind: "ignore" };
    }
    if (payload.event === "notification:unread-count" && isRecord(payload.data)) {
      const count = payload.data.count;
      if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
        return { kind: "unread-count", count: Math.floor(count) };
      }
    }
  } catch {
    // Malformed frames are ignored; the next count refresh corrects state.
  }
  return { kind: "ignore" };
};

export const notificationHref = (notification: AdminNotification): string =>
  notification.metadata?.ticketId
    ? `/support/${encodeURIComponent(notification.metadata.ticketId)}`
    : "/support";

/** Unread notifications that belong to the ticket open at `pathname`. */
export const unreadForPath = (
  notifications: AdminNotification[],
  pathname: string,
): AdminNotification[] => {
  const match = /^\/support\/([^/?#]+)/.exec(pathname);
  if (!match) return [];
  const ticketId = decodeURIComponent(match[1]);
  return notifications.filter(
    (notification) => !notification.isRead && notification.metadata?.ticketId === ticketId,
  );
};

/** Newest first, de-duplicated by id, capped for the dropdown. */
export const mergeNotifications = (
  current: AdminNotification[],
  incoming: AdminNotification[],
  limit = 20,
): AdminNotification[] => {
  const byId = new Map<string, AdminNotification>();
  for (const notification of [...incoming, ...current]) {
    if (!byId.has(notification._id)) byId.set(notification._id, notification);
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
};

export const badgeLabel = (count: number): string | null =>
  count <= 0 ? null : count > 99 ? "99+" : String(count);

/** Reconnect delay with a ceiling: 2s, 4s, 8s … up to 60s. */
export const reconnectDelayMs = (attempt: number): number =>
  Math.min(60_000, 2_000 * 2 ** Math.max(0, attempt));

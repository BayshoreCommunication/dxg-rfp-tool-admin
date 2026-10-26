"use server";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import {
  toAdminNotification,
  type AdminNotification,
} from "@/lib/notifications/adminNotifications";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Network error";

const call = async (path: string, init: RequestInit = {}) => {
  const response = await authenticatedBackendFetch(`${BACKEND_URL}/api/notifications${path}`, {
    ...init,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

export async function getAdminNotificationsAction(): Promise<
  Result<{ notifications: AdminNotification[]; unreadCount: number }>
> {
  try {
    const { response, body } = await call("?limit=20");
    if (!response.ok) return { ok: false, error: body?.message || "Notifications are unavailable." };
    const notifications = (Array.isArray(body?.data) ? body.data : [])
      .map(toAdminNotification)
      .filter((item: AdminNotification | null): item is AdminNotification => item !== null);
    const unreadCount = typeof body?.unreadCount === "number" ? body.unreadCount : 0;
    return { ok: true, data: { notifications, unreadCount } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function markAdminNotificationReadAction(id: string): Promise<Result<null>> {
  try {
    const { response, body } = await call(`/${encodeURIComponent(id)}/read`, { method: "PATCH" });
    return response.ok ? { ok: true, data: null } : { ok: false, error: body?.message || "Could not mark as read." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function markAllAdminNotificationsReadAction(): Promise<Result<null>> {
  try {
    const { response, body } = await call("/read-all", { method: "PATCH" });
    return response.ok ? { ok: true, data: null } : { ok: false, error: body?.message || "Could not mark all as read." };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Short-lived, session-bound ticket for the browser's notification socket. */
export async function getAdminNotificationSocketUrlAction(): Promise<Result<string>> {
  try {
    const { response, body } = await call("/socket-ticket", { method: "POST" });
    const ticket = body?.data?.ticket;
    if (!response.ok || typeof ticket !== "string") {
      return { ok: false, error: body?.message || "Unable to authorize the notification socket." };
    }
    const wsBase = BACKEND_URL.replace(/^http/i, "ws");
    return { ok: true, data: `${wsBase}/api/notifications/ws?ticket=${encodeURIComponent(ticket)}` };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

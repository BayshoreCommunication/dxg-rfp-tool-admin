"use client";

import { Bell, ChevronsUpDown, LoaderCircle, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminNotifications } from "@/components/notifications/AdminNotificationsProvider";
import { NotificationPanel } from "@/components/notifications/NotificationBell";
import { badgeLabel } from "@/lib/notifications/adminNotifications";
import { initialsFor } from "@/lib/layout/sidebar";
import { cn } from "@/lib/utils";
import ThemeMenuItem from "./ThemeMenuItem";

export type SidebarUser = {
  name?: string | null;
  email?: string | null;
};

const itemClass =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007f86] dark:text-slate-300 dark:hover:bg-[#12293a] dark:hover:text-white";

// The card pinned to the bottom of the desktop sidebar, as on the dashboard. It opens a short
// menu: who is signed in, notifications, the light or dark theme, and sign out. Settings and
// Support are the links just above the card, so the menu does not repeat them.
export default function AccountMenu({
  currentUser,
  signingOut,
  onSignOut,
  collapsed,
}: {
  currentUser?: SidebarUser;
  signingOut: boolean;
  onSignOut: () => void;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useAdminNotifications();
  const unread = badgeLabel(unreadCount);
  const displayName =
    currentUser?.name?.trim() || currentUser?.email?.split("@")[0] || "Admin account";
  const displayEmail = currentUser?.email?.trim() || "Email unavailable";
  const initials = initialsFor(currentUser?.name, currentUser?.email);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`${open ? "Close" : "Open"} account menu for ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="admin-account-menu"
        title={displayName}
        onClick={() => {
          setNotificationsOpen(false);
          setOpen((current) => !current);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007f86] dark:border-[#22343f] dark:bg-[#0f2230] dark:hover:bg-[#12293a]",
          collapsed && "justify-center p-1.5",
          open && "bg-slate-100 dark:bg-[#12293a]",
        )}
      >
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dff5f4] text-xs font-extrabold text-[#007f86] dark:bg-cyan-950/70 dark:text-cyan-300">
          {initials}
          {unread ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0f2230]"
              aria-hidden
            />
          ) : null}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-slate-900 dark:text-white">
                {displayName}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {displayEmail}
              </span>
            </span>
            <ChevronsUpDown size={16} className="shrink-0 text-slate-400" aria-hidden />
          </>
        )}
      </button>

      {open && (
        <div
          id="admin-account-menu"
          role="menu"
          aria-label="Account options"
          className="absolute bottom-0 left-[calc(100%+12px)] z-[70] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_20px_50px_-18px_rgba(15,23,42,0.28)] dark:border-[#2b4352] dark:bg-[#0d1d28]"
        >
          <div className="px-4 py-3.5">
            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {displayEmail}
            </p>
          </div>

          <div className="border-t border-slate-100 p-1.5 dark:border-[#22343f]">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="dialog"
              onClick={() => {
                setOpen(false);
                setNotificationsOpen(true);
              }}
              className={itemClass}
            >
              <Bell size={16} aria-hidden />
              <span className="flex-1 text-left">Notifications</span>
              {unread ? (
                <span
                  aria-label={`${unreadCount} unread`}
                  className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white"
                >
                  {unread}
                </span>
              ) : null}
            </button>
            <ThemeMenuItem className={itemClass} />
          </div>

          <div className="border-t border-slate-100 p-1.5 dark:border-[#22343f]">
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-wait disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              {signingOut ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden />
              )}
              {signingOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <NotificationPanel
          positionClassName={collapsed ? "bottom-4 left-[100px]" : "bottom-4 left-[260px]"}
          onClose={closeNotifications}
          ignoreRef={containerRef}
        />
      )}
    </div>
  );
}

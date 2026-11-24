"use client";

import { signOutAction } from "@/app/actions/auth";
import { navigationConfig, NavItem } from "@/config/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import AccountMenu, { type SidebarUser } from "@/components/layout/AccountMenu";
import { isNavItemActive, splitNavigation } from "@/lib/layout/sidebar";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useAdminNotifications } from "@/components/notifications/AdminNotificationsProvider";
import { badgeLabel } from "@/lib/notifications/adminNotifications";
import { cn } from "@/lib/utils";
import { LoaderCircle, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function SidebarRow({
  item,
  active,
  badge,
  collapsed,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  badge: string | null;
  collapsed: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.title : undefined}
      aria-label={collapsed ? item.title : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex w-full shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007f86]",
        compact ? "h-11" : "h-12",
        collapsed && "justify-center px-0",
        active
          ? // Dark teal, not the brand #00c2c9: white text needs 4.5:1 (WCAG AA); #007f86 gives 4.79:1.
            "bg-[#007f86] text-white shadow-[0_10px_24px_-14px_rgba(0,127,134,0.9)]"
          : "text-slate-600 hover:bg-primary/5 hover:text-[#007f86] dark:text-slate-300 dark:hover:text-cyan-300",
      )}
    >
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
        {item.icon}
        {badge && collapsed ? (
          <span className="pointer-events-none absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-white dark:ring-[#0d1d28]">
            {badge}
          </span>
        ) : null}
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.title}</span>}
      {!collapsed && badge ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black leading-none",
            active ? "bg-white/25 text-white" : "bg-rose-500 text-white",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

const Sidebar = ({
  currentUser,
  collapsed = false,
  onToggleCollapsed,
}: {
  currentUser?: SidebarUser;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) => {
  const pathname = usePathname();
  const { main, footer } = splitNavigation(navigationConfig);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { unreadCount } = useAdminNotifications();
  // Unread support alerts surface on the Support item from every page.
  const badgeFor = (item: NavItem) => (item.id === "support" ? badgeLabel(unreadCount) : null);

  const isItemActive = (item: NavItem) => isNavItemActive(pathname, item.href);

  const signOutHandler = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      try {
        await signOutAction();
      } catch (error) {
        console.error("Backend logout failed:", error);
      }
      await signOut({ callbackUrl: "/sign-in" });
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <aside
        aria-label="Sidebar"
        data-collapsed={collapsed}
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden h-dvh min-h-0 flex-col overflow-visible border-r border-[#e1e8ee] bg-white transition-[width] duration-200 dark:border-[#253746] dark:bg-[#0d1d28] lg:flex",
          collapsed ? "w-[88px]" : "w-[248px]",
        )}
      >
        <div
          className={cn(
            "flex h-[68px] shrink-0 items-center border-b border-[#e1e8ee] px-3 dark:border-[#253746]",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <Link
            href="/dashboard"
            aria-label="Go to admin dashboard"
            className="group flex h-12 min-w-0 items-center gap-2 overflow-hidden rounded-xl transition-all duration-200 hover:-translate-y-0.5"
          >
            <Image
              src="/assets/logo/Logomark- White Background.png"
              alt="RFPilot"
              width={64}
              height={64}
              className="h-12 w-12 shrink-0 object-contain p-1.5"
              priority
            />
            {!collapsed && (
              <span className="min-w-0 truncate text-base font-extrabold text-slate-900 dark:text-white">
                RFPilot <span className="font-semibold text-slate-400">Admin</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={onToggleCollapsed}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007f86] dark:hover:bg-[#12293a]"
            >
              <PanelLeftClose size={18} aria-hidden />
            </button>
          )}
        </div>

        <nav
          aria-label="Primary navigation"
          className="sidebar-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4"
        >
          {collapsed && (
            <button
              type="button"
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onClick={onToggleCollapsed}
              className="mb-2 grid h-10 w-full place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007f86] dark:hover:bg-[#12293a]"
            >
              <PanelLeftOpen size={18} aria-hidden />
            </button>
          )}
          {main.map((item) => (
            <SidebarRow
              key={item.id}
              item={item}
              active={isNavItemActive(pathname, item.href)}
              badge={badgeFor(item)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="mx-4 h-px shrink-0 bg-linear-to-r from-transparent via-[#e1e8ee] to-transparent dark:via-[#283c4a]" />

        <div className="flex shrink-0 flex-col gap-1 px-3 py-3">
          {footer.map((item) => (
            <SidebarRow
              key={item.id}
              item={item}
              active={isNavItemActive(pathname, item.href)}
              badge={badgeFor(item)}
              collapsed={collapsed}
              compact
            />
          ))}
          <div className="mt-2">
            <AccountMenu
              currentUser={currentUser}
              signingOut={isSigningOut}
              onSignOut={() => void signOutHandler()}
              collapsed={collapsed}
            />
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-50 flex h-[62px] items-center justify-between border-b border-[#dce5ee] bg-white/95 px-4 backdrop-blur transition-colors dark:border-[#253746] dark:bg-[#0d1d28]/95 lg:hidden">
        <Link
          href="/dashboard"
          className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Image
            src="/assets/logo/Logomark- White Background.png"
            alt="RFPilot"
            width={64}
            height={64}
            className="h-[48px] w-[48px] object-contain"
            priority
          />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell placement="header" className="h-9 w-9" />
          <ThemeToggle className="h-9 w-9 px-0" />
          <button
            type="button"
            onClick={() => void signOutHandler()}
            disabled={isSigningOut}
            aria-label="Sign out of the admin account"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-[#2b4352] dark:bg-[#102432] dark:text-slate-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            {isSigningOut ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut size={14} aria-hidden="true" />
            )}
            {isSigningOut ? "Signing out" : "Sign out"}
          </button>
        </div>
      </header>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid h-[76px] grid-flow-col auto-cols-fr items-stretch overflow-x-hidden border-t border-[#dce5ee] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-colors dark:border-[#253746] dark:bg-[#0d1d28]/95 dark:shadow-[0_-8px_30px_rgba(0,0,0,0.3)] lg:hidden"
      >
        {navigationConfig.map((item) => {
          const isActive = isItemActive(item);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.shortTitle ? item.title : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[8.5px] font-bold transition min-[380px]:text-[9px]",
                isActive ? "text-primary" : "text-slate-400 hover:text-slate-600",
              )}
            >
              {isActive ? (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
              ) : null}
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-xl",
                  isActive ? "bg-[#eaf9f8] dark:bg-cyan-950/50" : "",
                )}
              >
                {item.icon}
                {badgeFor(item) ? (
                  <span
                    aria-label={`${unreadCount} unread`}
                    className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold leading-4 text-white ring-2 ring-white dark:ring-[#0d1d28]"
                  >
                    {badgeFor(item)}
                  </span>
                ) : null}
              </span>
              <span>{item.shortTitle ?? item.title}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;

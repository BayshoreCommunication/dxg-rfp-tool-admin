"use client";

import { signOutAction } from "@/app/actions/auth";
import { navigationConfig, NavItem } from "@/config/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { LoaderCircle, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const Sidebar = () => {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isItemActive = (item: NavItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);

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
      <aside className="fixed inset-y-0 left-0 z-50 hidden h-dvh min-h-0 w-[90px] flex-col overflow-hidden border-r border-[#e1e8ee] bg-white transition-colors dark:border-[#253746] dark:bg-[#0d1d28] md:flex">
      <div className="flex h-[68px] shrink-0 items-center justify-center border-b border-gray-200 dark:border-[#253746] max-[800px]:h-14">
        <Link
          href="/dashboard"
          aria-label="Go to admin dashboard"
          className="group flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-200 hover:-translate-y-0.5 max-[800px]:h-10 max-[800px]:w-10"
        >
          <Image
            src="/assets/logo/Logomark- White Background.png"
            alt="RFPilot"
            width={64}
            height={64}
            className="h-full w-full object-contain p-1.5"
            priority
          />
        </Link>
      </div>

      <nav aria-label="Primary navigation" className="sidebar-scrollbar flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-2">
        {navigationConfig.map((item) => {
          const isActive = isItemActive(item);

          return (
            <Link key={item.id} href={item.href} className="flex min-h-[72px] w-full shrink-0 items-center max-[800px]:min-h-[60px]">
              <div
                className={cn(
                  "group relative flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition-all duration-200 max-[800px]:gap-0.5 max-[800px]:py-1",
                  isActive
                    ? "bg-[#eaf9f8] dark:bg-cyan-950/50"
                    : "hover:bg-primary/5 dark:hover:bg-cyan-950/30",
                )}
              >
                {isActive && (
                  <div className="absolute -left-3 top-1/2 h-7 w-[4px] -translate-y-1/2 rounded-r-full bg-primary shadow-[2px_0_8px_rgba(0,194,201,0.4)]" />
                )}

                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 max-[800px]:h-9 max-[800px]:w-9",
                    isActive
                      ? "bg-white text-primary shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:bg-[#142a37]"
                      : "text-gray-400 group-hover:bg-primary/10 group-hover:text-primary dark:text-slate-500",
                  )}
                >
                  {item.icon}
                </div>

                <span
                  className={cn(
                    "w-full text-center text-[9.5px] font-bold leading-[1.08] tracking-wide max-[800px]:text-[9px]",
                    isActive
                      ? "text-primary"
                      : "text-gray-400 group-hover:text-primary",
                  )}
                >
                  {item.title}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 h-px shrink-0 bg-slate-100 dark:bg-[#253746]" />

      <div className="flex shrink-0 flex-col items-center gap-2 px-2.5 py-3 max-[800px]:gap-1.5 max-[800px]:py-2">
        <ThemeToggle className="h-12 w-12 rounded-2xl px-0 max-[800px]:h-10 max-[800px]:w-10 max-[800px]:rounded-xl" />

        <button
          type="button"
          onClick={() => void signOutHandler()}
          disabled={isSigningOut}
          aria-label="Sign out of the admin account"
          title="Sign out"
          className="group flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:cursor-wait disabled:opacity-60 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white transition group-hover:border-rose-200 group-hover:bg-rose-50 dark:border-[#2b4352] dark:bg-[#102432] dark:group-hover:border-rose-800 dark:group-hover:bg-rose-950/40 max-[800px]:h-7 max-[800px]:w-7 max-[800px]:rounded-lg">
            {isSigningOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <span className="text-[9.5px] font-bold leading-none tracking-wide">
            {isSigningOut ? "Signing out" : "Sign out"}
          </span>
        </button>

      </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-50 flex h-[62px] items-center justify-between border-b border-[#dce5ee] bg-white/95 px-4 backdrop-blur transition-colors dark:border-[#253746] dark:bg-[#0d1d28]/95 md:hidden">
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
        className="fixed inset-x-0 bottom-0 z-50 grid h-[76px] grid-flow-col auto-cols-fr items-stretch overflow-x-hidden border-t border-[#dce5ee] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-colors dark:border-[#253746] dark:bg-[#0d1d28]/95 dark:shadow-[0_-8px_30px_rgba(0,0,0,0.3)] md:hidden"
      >
        {navigationConfig.map((item) => {
          const isActive = isItemActive(item);
          return (
            <Link
              key={item.id}
              href={item.href}
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
                  "flex h-8 w-8 items-center justify-center rounded-xl",
                  isActive ? "bg-[#eaf9f8] dark:bg-cyan-950/50" : "",
                )}
              >
                {item.icon}
              </span>
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;

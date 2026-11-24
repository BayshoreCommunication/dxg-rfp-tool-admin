"use client";

import { useEffect, useState } from "react";
import type { SidebarUser } from "@/components/layout/AccountMenu";
import Sidebar from "@/components/layout/Sidebar";
import AdminNotificationsProvider from "@/components/notifications/AdminNotificationsProvider";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/layout/sidebar";
import { cn } from "@/lib/utils";

export default function LayoutWrapper({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser?: SidebarUser;
}) {
  // Starts expanded on the server and first paint, then follows the member's saved choice.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Reading browser storage is the external system this effect syncs from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readSidebarCollapsed(window.localStorage));
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(window.localStorage, next);
      return next;
    });
  };

  return (
    <AdminNotificationsProvider>
      <div className="min-h-screen bg-[#f2f5f7] transition-colors duration-200 dark:bg-[#07131c]">
        <Sidebar
          currentUser={currentUser}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <main
          className={cn(
            "min-h-screen pb-24 pt-[62px] transition-[margin] duration-200 lg:pb-0 lg:pt-0",
            collapsed ? "lg:ml-[88px]" : "lg:ml-[248px]",
          )}
        >
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </AdminNotificationsProvider>
  );
}

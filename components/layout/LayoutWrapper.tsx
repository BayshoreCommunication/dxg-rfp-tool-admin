"use client";

import Sidebar from "@/components/layout/Sidebar";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f2f5f7] transition-colors duration-200 dark:bg-[#07131c]">
      <Sidebar />
      <main className="min-h-screen pb-24 pt-[62px] md:ml-[90px] md:pb-0 md:pt-0">
        <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

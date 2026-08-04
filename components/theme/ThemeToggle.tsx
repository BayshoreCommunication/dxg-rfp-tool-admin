"use client";

import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
      className={cn(
        "group inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-[#008f96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] dark:border-[#2b4352] dark:bg-[#102432] dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/50 dark:hover:text-cyan-300",
        className,
      )}
    >
      <Sun className="h-4 w-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden h-4 w-4 dark:block" aria-hidden="true" />
      {showLabel ? (
        <>
          <span className="dark:hidden">Light mode</span>
          <span className="hidden dark:inline">Dark mode</span>
        </>
      ) : null}
    </button>
  );
}

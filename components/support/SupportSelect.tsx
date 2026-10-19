"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * A native select (browser arrow and all) inside the bordered pill, with the
 * pill extending a little past the arrow so it never sits flush on the right.
 */
export default function SupportSelect({
  className = "",
  wrapperClassName = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <span
      className={`inline-flex h-10 items-stretch rounded-xl border border-slate-200 bg-white pr-2.5 transition focus-within:border-[#00aeb5] focus-within:ring-2 focus-within:ring-[#00aeb5]/20 dark:border-[#253746] dark:bg-[#0f2230] ${wrapperClassName}`}
    >
      <select
        {...props}
        className={`h-full w-full rounded-xl border-0 bg-transparent pl-3 pr-1 text-sm font-semibold text-slate-700 outline-none disabled:opacity-60 dark:text-slate-100 ${className}`}
      />
    </span>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/**
 * The one select used across the Support area: native <select> for
 * accessibility and keyboard behaviour, with the browser arrow replaced by a
 * chevron drawn 1rem in from the right edge so it never sits flush.
 */
export default function SupportSelect({
  className = "",
  wrapperClassName = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <span className={`relative block ${wrapperClassName}`}>
      <select
        {...props}
        className={`h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-11 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#00aeb5] focus:ring-2 focus:ring-[#00aeb5]/20 disabled:opacity-60 dark:border-[#253746] dark:bg-[#0f2230] dark:text-slate-100 ${className}`}
      />
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
        aria-hidden="true"
      />
    </span>
  );
}

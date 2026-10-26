"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * A native select (browser arrow and all) inside the bordered pill, with the
 * pill extending a little past the arrow so it never sits flush on the right.
 */
export default function SupportSelect({
  className = "",
  wrapperClassName = "",
  size = "md",
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { wrapperClassName?: string; size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      className={`inline-flex ${small ? "h-8 rounded-lg" : "h-10 rounded-xl"} items-stretch border border-slate-200 bg-white pr-2.5 transition focus-within:border-[#00aeb5] focus-within:ring-2 focus-within:ring-[#00aeb5]/20 dark:border-[#253746] dark:bg-[#0f2230] ${wrapperClassName}`}
    >
      <select
        {...props}
        className={`h-full w-full border-0 bg-transparent pr-1 font-semibold ${small ? "rounded-lg pl-2.5 text-xs" : "rounded-xl pl-3 text-sm"} text-slate-700 outline-none disabled:opacity-60 dark:text-slate-100 ${className}`}
      />
    </span>
  );
}

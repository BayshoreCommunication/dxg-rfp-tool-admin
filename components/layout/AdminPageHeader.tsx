import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
};

export default function AdminPageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon ? (
          <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#b8e7e5] bg-[#dff5f4] text-[#007f86] shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-cyan-800/80 dark:bg-cyan-950/70 dark:text-cyan-300">
            <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#009ca4]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.035em] text-[#12213a] sm:text-[32px]">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

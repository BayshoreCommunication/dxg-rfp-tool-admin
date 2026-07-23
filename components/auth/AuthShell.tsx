import { CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import Image from "next/image";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  sideTitle?: string;
  sideDescription?: string;
};

const highlights = [
  "Manage clients and admin access",
  "Review governed knowledge sources",
  "Keep pricing guidance controlled",
];

export default function AuthShell({
  title,
  description,
  children,
  sideTitle = "The operational workspace for DXG proposals.",
  sideDescription = "One secure admin surface for client activity, pricing knowledge, and governed AI readiness.",
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#eef3f6] p-4 transition-colors dark:bg-[#07131c] sm:p-8">
      <ThemeToggle className="absolute right-4 top-4 sm:right-8 sm:top-8" showLabel />
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-[#dce5ee] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] transition-colors dark:border-[#253746] dark:bg-[#0d1d28] dark:shadow-[0_24px_70px_rgba(0,0,0,0.42)] lg:min-h-[680px] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden flex-col justify-between bg-[#123442] p-10 text-white dark:bg-[#0a2430] lg:flex xl:p-12">
          <div>
            <span className="theme-logo-well inline-flex rounded-2xl bg-white p-3">
              <Image
                src="/assets/logo/logo.svg"
                alt="DXG Digital"
                width={68}
                height={54}
                className="h-auto w-[68px]"
                priority
              />
            </span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">
              DXG admin workspace
            </p>
            <h2 className="mt-4 max-w-md text-4xl font-extrabold leading-tight tracking-[-0.04em]">
              {sideTitle}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              {sideDescription}
            </p>
            <ul className="mt-8 space-y-4">
              {highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-center gap-3 text-sm font-semibold text-slate-200"
                >
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-cyan-300"
                    aria-hidden="true"
                  />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-400">Private administrative access</p>
        </aside>

        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Image
                src="/assets/logo/logo.svg"
                alt="DXG Digital"
                width={76}
                height={60}
                className="h-auto w-[76px]"
                priority
              />
            </div>
            <h1 className="text-[30px] font-extrabold tracking-[-0.035em] text-[#12213a] dark:text-[#eef5f8] sm:text-[34px]">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </p>
            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

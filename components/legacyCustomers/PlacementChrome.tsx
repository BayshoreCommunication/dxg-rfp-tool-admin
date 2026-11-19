import { focusRing } from "@/components/organizations/content/ContentChrome";
import { CLIENTS_PATH, LEGACY_CUSTOMERS_PATH, placementFailureCopy, type PlacementFailure } from "@/lib/legacyCustomers/placement";
import { sessionRenewPath } from "@/lib/organizationContent/content";
import { AlertCircle, ArrowLeft, Clock, FileQuestion } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/* Every link to the list opts out of prefetch: each view of it is a backend read that counts
   toward the staff member's allowance (600 list and search reads per 15 minutes).

   The frame and the states the three Legacy customers pages share. It follows the organization
   pages' look (components/organizations/content/ContentChrome.tsx) and takes its focus outline
   from there. No hooks here: the pages render it on the server. */

export const linkClass = `text-sm font-bold text-[#007f86] underline-offset-2 hover:underline dark:text-cyan-300 ${focusRing}`;

// 44px tall: these are pressed by touch on a phone as much as by pointer.
export const primaryButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#007f86] px-5 text-sm font-bold text-white transition hover:bg-[#006d73] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 ${focusRing}`;
export const dangerButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 ${focusRing}`;
export const secondaryButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-[#34445f] transition hover:border-[#00aeb5] hover:text-[#007f86] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
export const inputClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#20304b] outline-none transition placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/20 aria-[invalid=true]:border-rose-500";
export const cardClass = "rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";

/** The word "Clients" as a link to the Clients screen, where the accounts still in the shared
    organization are listed. It takes nothing from its caller, so nothing can be added to the
    address. Prefetched like the navigation's own link to the same screen. */
export const ClientsLink = () => (
  <Link href={CLIENTS_PATH} className={linkClass}>
    Clients
  </Link>
);

/** The page width, and the way back to the list on the two pages under it. */
export const PlacementFrame = ({ back = true, children }: { back?: boolean; children: ReactNode }) => (
  <div className="mx-auto w-full max-w-[1100px] space-y-5 pb-10">
    {back ? (
      <Link
        href={LEGACY_CUSTOMERS_PATH}
        prefetch={false}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 transition hover:text-[#007f86] dark:hover:text-cyan-300 ${focusRing}`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Legacy customers
      </Link>
    ) : null}
    {children}
  </div>
);

// Waiting is all these ask for.
const WAIT: PlacementFailure[] = ["rate_limited", "capacity_reached", "not_available"];
// Asking again can help without anything else being done first.
const RETRY: PlacementFailure[] = ["rate_limited", "capacity_reached", "unavailable", "start_failed"];

/** A whole-page refusal: a page that could not be shown at all. */
export const PlacementFailureState = ({
  failure,
  retryAfterSeconds,
  retryHref,
}: {
  failure: PlacementFailure;
  retryAfterSeconds?: number | null;
  /** This same page: where "Try again" leads, and where signing in again returns to. */
  retryHref?: string;
}) => {
  const { title, message, tone } = placementFailureCopy(failure, retryAfterSeconds);
  const calm = tone === "calm";
  const Icon = WAIT.includes(failure) ? Clock : calm ? FileQuestion : AlertCircle;
  return (
    <section className={`flex min-h-[40vh] flex-col items-center justify-center px-6 py-12 text-center ${cardClass}`} role={calm ? "status" : "alert"}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${calm ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-600"}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className={`mt-4 text-base font-bold ${calm ? "text-[#12213a]" : "text-rose-700"}`}>{title}</h1>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {retryHref === LEGACY_CUSTOMERS_PATH ? null : (
          <Link href={LEGACY_CUSTOMERS_PATH} prefetch={false} className={linkClass}>
            Back to Legacy customers
          </Link>
        )}
        {failure === "session_ended" ? (
          <Link href={sessionRenewPath(retryHref ?? LEGACY_CUSTOMERS_PATH)} prefetch={false} className={linkClass}>
            Sign in
          </Link>
        ) : null}
        {retryHref && RETRY.includes(failure) ? (
          <Link href={retryHref} prefetch={false} className={linkClass}>
            Try again
          </Link>
        ) : null}
      </div>
    </section>
  );
};

/** A refusal shown inside a page that is otherwise there: under a form, beside a control. */
export const FailureNote = ({ failure, retryAfterSeconds, children }: { failure: PlacementFailure; retryAfterSeconds?: number | null; children?: ReactNode }) => {
  const { title, message, tone } = placementFailureCopy(failure, retryAfterSeconds);
  const calm = tone === "calm";
  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${calm ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}
    >
      <p className="font-bold">{title}</p>
      <p>{message}</p>
      {children ? <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{children}</div> : null}
    </div>
  );
};

export const PlacementSkeleton = ({ label }: { label: string }) => (
  <div className="mx-auto w-full max-w-[1100px] space-y-5" aria-busy="true" aria-label={label} role="status">
    <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
    <div className="h-24 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
    <div className="h-72 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
  </div>
);

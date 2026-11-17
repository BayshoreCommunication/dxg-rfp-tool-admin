import {
  ORGANIZATIONS_PATH,
  ORGANIZATION_ACCOUNT_FAILURES,
  organizationAccountPath,
  type OrganizationAccountFailure,
} from "@/lib/organizationAccount";
import { AlertCircle, ArrowLeft, Clock, FileQuestion } from "lucide-react";
import Link from "next/link";

const linkClass =
  "text-sm font-bold text-[#007f86] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] dark:text-cyan-300";

export const BackToOrganizations = () => (
  <Link
    href={ORGANIZATIONS_PATH}
    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-[#007f86] dark:hover:text-cyan-300"
  >
    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Organizations
  </Link>
);

// Nothing is wrong when the organization is missing, the link is mistyped or the API doesn't
// have the route yet, so those read calmly; the rest are problems to act on.
const CALM: OrganizationAccountFailure[] = ["not_available", "not_found", "invalid_id"];
// Trying again can help only where the answer can change without anything else being done.
const RETRY: OrganizationAccountFailure[] = ["unavailable", "rate_limited"];

type FailureProps = {
  failure: OrganizationAccountFailure;
  /** Offered as "Try again" where that can help; left out for a malformed id. */
  organizationId?: string;
};

export const OrganizationAccountFailureState = ({ failure, organizationId }: FailureProps) => {
  const { title, message } = ORGANIZATION_ACCOUNT_FAILURES[failure];
  const calm = CALM.includes(failure);
  const Icon = failure === "not_available" ? Clock : calm ? FileQuestion : AlertCircle;
  return (
    <section
      className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-[#dce5ee] bg-white px-6 py-12 text-center"
      role={calm ? "status" : "alert"}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          calm ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-600"
        }`}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className={`mt-4 text-base font-bold ${calm ? "text-[#12213a]" : "text-rose-700"}`}>{title}</h1>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href={ORGANIZATIONS_PATH} className={linkClass}>
          Back to Organizations
        </Link>
        {organizationId && RETRY.includes(failure) ? (
          // Opening the page is an audited read: never fetch it ahead of the click.
          <Link href={organizationAccountPath(organizationId)} prefetch={false} className={linkClass}>
            Try again
          </Link>
        ) : null}
      </div>
    </section>
  );
};

export const OrganizationAccountSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading organization">
    <div className="flex items-start gap-3.5">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-full max-w-xs animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
      </div>
    </div>
    <div className="h-16 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-56 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
      ))}
    </div>
  </div>
);

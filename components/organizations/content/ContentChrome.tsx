import { buildPageList } from "@/components/clients/ClientDetilas";
import { ORGANIZATIONS_PATH, organizationAccountPath } from "@/lib/organizationAccount";
import {
  CONTENT_SECTIONS,
  CONTENT_SECTION_LABELS,
  contentFailureCopy,
  organizationSectionPath,
  type ContentFailure,
  type ContentKind,
  type ContentSection,
  type Pagination,
  type Tone,
} from "@/lib/organizationContent/content";
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Clock, Eye, FileQuestion, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/* The frame every organization content page shares. Each link into the organization's pages is
   an audited read on the RFPilot side, so every one of them opts out of prefetching. Nothing
   here changes anything: the content browser is view-only. */

const linkClass =
  "text-sm font-bold text-[#007f86] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] dark:text-cyan-300";

const pillClass = (active: boolean) =>
  `inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] ${
    active
      ? "border-[#aee9e8] bg-[#eaf9f8] text-[#007f86] dark:text-cyan-300"
      : "border-slate-200 text-slate-600 hover:border-[#00aeb5] hover:text-[#007f86]"
  }`;

/** The five sections of an organization's content. Shown on the detail page and on every section. */
export const OrganizationSectionNav = ({ organizationId, active }: { organizationId: string; active?: ContentSection }) => (
  <nav aria-label="Organization content" className="flex flex-wrap gap-2">
    {CONTENT_SECTIONS.map((section) => (
      <Link
        key={section}
        href={organizationSectionPath(organizationId, section)}
        prefetch={false}
        aria-current={section === active ? "page" : undefined}
        className={pillClass(section === active)}
      >
        {CONTENT_SECTION_LABELS[section]}
      </Link>
    ))}
  </nav>
);

export const ReadOnlyNote = () => (
  <p className="flex items-start gap-2 text-xs leading-5 text-slate-600">
    <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>View only. Each page you open here is recorded on the RFPilot side; the organization does not see it.</span>
  </p>
);

/** Back to the organization, the section links and the view-only note. With no usable id, back to the list. */
export const ContentFrame = ({
  organizationId,
  active,
  children,
}: {
  organizationId: string | null;
  active: ContentSection;
  children: ReactNode;
}) => (
  <div className="mx-auto w-full max-w-[1540px] space-y-5 pb-10">
    {organizationId ? (
      <>
        <Link
          href={organizationAccountPath(organizationId)}
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-[#007f86] dark:hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Organization
        </Link>
        <OrganizationSectionNav organizationId={organizationId} active={active} />
        <ReadOnlyNote />
      </>
    ) : (
      <Link
        href={ORGANIZATIONS_PATH}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-[#007f86] dark:hover:text-cyan-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Organizations
      </Link>
    )}
    {children}
  </div>
);

// Nothing is wrong when something is missing, the link is mistyped or the API doesn't have the
// route yet, so those read calmly; the rest are problems to act on.
const CALM: ContentFailure[] = ["not_available", "organization_not_found", "record_not_found", "invalid_id"];
// Trying again can help only where the answer can change without anything else being done.
const RETRY: ContentFailure[] = ["unavailable", "rate_limited"];

type FailureProps = {
  failure: ContentFailure;
  kind: ContentKind;
  /** Where "Try again" leads: this same page. Left out when trying again can't help. */
  retryHref?: string;
  /** Where to go instead, when the organization itself is fine. */
  back?: { href: string; label: string };
};

export const ContentFailureState = ({ failure, kind, retryHref, back }: FailureProps) => {
  const { title, message } = contentFailureCopy(failure, kind);
  const calm = CALM.includes(failure);
  const Icon = failure === "not_available" || failure === "rate_limited" ? Clock : calm ? FileQuestion : AlertCircle;
  return (
    <section
      className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-[#dce5ee] bg-white px-6 py-12 text-center"
      role={calm ? "status" : "alert"}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${calm ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-600"}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className={`mt-4 text-base font-bold ${calm ? "text-[#12213a]" : "text-rose-700"}`}>{title}</h1>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {back && failure === "record_not_found" ? (
          <Link href={back.href} prefetch={false} className={linkClass}>
            {back.label}
          </Link>
        ) : (
          <Link href={ORGANIZATIONS_PATH} className={linkClass}>
            Back to Organizations
          </Link>
        )}
        {retryHref && RETRY.includes(failure) ? (
          <Link href={retryHref} prefetch={false} className={linkClass}>
            Try again
          </Link>
        ) : null}
      </div>
    </section>
  );
};

export const ContentSkeleton = ({ label }: { label: string }) => (
  <div className="mx-auto w-full max-w-[1540px] space-y-5" aria-busy="true" aria-label={label} role="status">
    <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
      ))}
    </div>
    <div className="h-20 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
    <div className="h-72 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
  </div>
);

/** The card a list sits in: icon, title, a count, a line of explanation and its controls. */
export const ContentCard = ({
  icon: Icon,
  title,
  count,
  description,
  controls,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count?: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
}) => (
  <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#007f86] dark:text-cyan-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">{title}</h1>
            {count ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{count}</span> : null}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      {controls ? <div className="flex min-w-0 flex-col gap-3 lg:items-end">{controls}</div> : null}
    </div>
    {children}
  </section>
);

export const EmptyState = ({ icon: Icon, title, message }: { icon: LucideIcon; title: string; message: string }) => (
  <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center" role="status">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
    <p className="mt-4 text-sm font-bold text-[#20304b]">{title}</p>
    <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
  </div>
);

const TONES: Record<Tone, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
};

export const ContentBadge = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONES[tone]}`}>
    {children}
  </span>
);

/** One filter as a row of links. Choosing a value opens the list again: one more recorded read. */
export const FilterPills = <T extends string>({
  label,
  options,
  active,
  hrefFor,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  active: T;
  hrefFor: (value: T) => string;
}) => (
  <nav aria-label={label} className="flex flex-wrap gap-1.5">
    {options.map((option) => (
      <Link
        key={option.value}
        href={hrefFor(option.value)}
        prefetch={false}
        aria-current={option.value === active ? "true" : undefined}
        className={pillClass(option.value === active)}
      >
        {option.label}
      </Link>
    ))}
  </nav>
);

export const Pager = ({
  pagination,
  summary,
  label,
  hrefFor,
}: {
  pagination: Pagination;
  /** "Showing 1–20 of 57 proposals". */
  summary: string;
  label: string;
  hrefFor: (page: number) => string;
}) => {
  if (pagination.total === 0) return null;
  const hasPrev = pagination.page > 1;
  const hasNext = pagination.page < pagination.totalPages;
  const stepClass = (enabled: boolean) =>
    `inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-600 transition ${
      enabled ? "border-slate-200 hover:border-[#00aeb5] hover:text-[#007f86]" : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
    }`;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-xs font-semibold text-slate-600" aria-live="polite">
        {summary}
      </p>
      {pagination.totalPages > 1 ? (
        <nav aria-label={label} className="flex flex-wrap items-center gap-1">
          <Link
            href={hrefFor(Math.max(1, pagination.page - 1))}
            prefetch={false}
            aria-label="Previous page"
            aria-disabled={!hasPrev}
            tabIndex={hasPrev ? undefined : -1}
            className={stepClass(hasPrev)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          {buildPageList(pagination.page, pagination.totalPages).map((item, index) =>
            item === "..." ? (
              <span key={`ellipsis-${index}`} className="inline-flex h-9 w-6 items-center justify-center text-sm text-slate-400">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefFor(item)}
                prefetch={false}
                aria-current={item === pagination.page ? "page" : undefined}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
                  item === pagination.page
                    ? "pointer-events-none border-[#aee9e8] bg-[#eaf9f8] text-[#007f86]"
                    : "border-slate-200 text-slate-600 hover:border-[#00aeb5] hover:text-[#007f86]"
                }`}
              >
                {item}
              </Link>
            ),
          )}
          <Link
            href={hrefFor(pagination.page + 1)}
            prefetch={false}
            aria-label="Next page"
            aria-disabled={!hasNext}
            tabIndex={hasNext ? undefined : -1}
            className={stepClass(hasNext)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </nav>
      ) : null}
    </div>
  );
};

import { listOrganizationPlansAction } from "@/app/actions/organizationPlans";
import { buildPageList } from "@/components/clients/ClientDetilas";
import ClientSearchForm from "@/components/clients/ClientSearchForm";
import {
  planLabel,
  usageLabel,
  usagePercent,
  type OrganizationPlanItem,
  type PlanFeatures,
} from "@/lib/organizationPlans";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
} from "lucide-react";
import Link from "next/link";
import ChangePlanButton from "./ChangePlanButton";

type Props = {
  search?: string;
  page?: number;
};

const formatDate = (isoDate?: string | null) => {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

const headerCell = "px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500";

const PlanBadge = ({ plan }: { plan: string }) => (
  <span
    className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
      plan === "free_trial" ? "bg-amber-50 text-amber-700 dark:text-amber-300" : "bg-emerald-50 text-emerald-700"
    }`}
  >
    {planLabel(plan)}
  </span>
);

const Usage = ({ organization }: { organization: OrganizationPlanItem }) => {
  const percent = usagePercent(organization.proposals);
  const atLimit = !organization.proposals.canCreate;
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-semibold tabular-nums text-[#34445f]">
        {usageLabel(organization.proposals)}
      </p>
      {percent !== null ? (
        <div
          className="mt-1.5 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label={`RFPs created by ${organization.name}`}
          aria-valuemin={0}
          aria-valuemax={organization.proposals.limit ?? 0}
          aria-valuenow={Math.min(organization.proposals.created, organization.proposals.limit ?? 0)}
        >
          <div
            className={`h-full rounded-full ${atLimit ? "bg-rose-500" : "bg-[#00aeb5]"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {atLimit ? (
        <p className="mt-1 text-[11px] font-bold text-rose-600">Limit reached</p>
      ) : null}
    </div>
  );
};

const Feature = ({ label, unlocked }: { label: string; unlocked: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 text-xs ${unlocked ? "font-semibold text-emerald-700" : "text-slate-400"}`}
  >
    {unlocked ? (
      <LockOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : (
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    )}
    {label}
    <span className="sr-only">{unlocked ? "unlocked" : "locked"}</span>
  </span>
);

const Features = ({ features }: { features: PlanFeatures }) => (
  <div className="flex flex-col gap-1">
    <Feature label="Vendor responses" unlocked={features.vendorResponses} />
    <Feature label="RFP intelligence" unlocked={features.proposalIntelligence} />
  </div>
);

const OrganizationName = ({ organization }: { organization: OrganizationPlanItem }) => (
  <div className="min-w-0">
    <p className="truncate text-[13px] font-bold text-[#20304b]" title={organization.name}>
      {organization.name || "Unnamed organization"}
    </p>
    <p className="mt-0.5 truncate text-xs text-slate-400" title={organization.slug}>
      {organization.slug}
      {organization.status !== "active" ? (
        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
          Inactive
        </span>
      ) : null}
    </p>
  </div>
);

export const OrganizationsDirectorySkeleton = () => (
  <section
    className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white lg:flex lg:min-h-0 lg:flex-col"
    aria-label="Loading organizations"
    aria-busy="true"
  >
    <div className="flex shrink-0 flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-100" />
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100 sm:w-80" />
    </div>
    <div className="min-h-0 p-4 sm:p-5 lg:flex lg:flex-1 lg:flex-col">
      <div className="min-h-[356px] overflow-hidden rounded-xl border border-slate-100 lg:min-h-0 lg:flex-1">
        <div className="h-10 animate-pulse border-b border-slate-100 bg-slate-50" />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex h-[79px] animate-pulse items-center gap-4 bg-white px-4">
              <div className="space-y-2">
                <div className="h-3 w-40 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default async function OrganizationsDirectory({ search = "", page = 1 }: Props) {
  const response = await listOrganizationPlansAction(search, page);
  const organizations = response.ok ? response.data.organizations : [];
  const plans = response.ok ? response.data.plans : [];
  const pagination = response.ok ? response.data.pagination : null;
  const total = pagination?.total ?? 0;
  // A stale or hand-edited page number past the end: say so and offer the last page.
  const pastLastPage = Boolean(pagination && organizations.length === 0 && total > 0 && pagination.page > pagination.totalPages);
  const rangeStart = organizations.length === 0 || !pagination ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const rangeEnd = organizations.length === 0 ? 0 : Math.min(rangeStart + organizations.length - 1, total);

  const withPage = (targetPage: number) => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    query.set("page", String(targetPage));
    return `/organizations?${query.toString()}`;
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:flex lg:min-h-0 lg:flex-col">
      <div className="flex shrink-0 flex-col gap-5 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">
                Plans and usage
              </h2>
              {pagination ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                  {pagination.total.toLocaleString()} total
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              A plan change applies right away and is recorded in the organization&apos;s audit trail.
            </p>
          </div>
        </div>

        <ClientSearchForm
          initialSearch={search}
          label="Search organizations"
          placeholder="Search organization name"
        />
      </div>

      {!response.ok ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center lg:min-h-0 lg:flex-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-rose-700">Unable to load organizations</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">{response.error}</p>
        </div>
      ) : organizations.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center lg:min-h-0 lg:flex-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600">
            {pastLastPage ? "There are no organizations on this page" : "No organizations found"}
          </p>
          {pastLastPage && pagination ? (
            <Link
              href={withPage(pagination.totalPages)}
              className="mt-2 text-sm font-bold text-[#008f96] underline-offset-2 hover:underline"
            >
              Go to page {pagination.totalPages}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              {search.trim() ? "Try a different organization name." : "Organizations appear here once customers sign up."}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="hidden min-h-0 p-4 sm:p-5 lg:flex lg:flex-1 lg:flex-col">
            <div
              className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#00aeb5] focus-visible:ring-offset-2 [scrollbar-gutter:stable]"
              tabIndex={0}
              role="region"
              aria-label="Organization plans table"
            >
              <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-100 bg-[#f8fafc]">
                    <th className={`w-[25%] ${headerCell}`}>Organization</th>
                    <th className={`w-[12%] ${headerCell}`}>Plan</th>
                    <th className={`w-[21%] ${headerCell}`}>RFPs created</th>
                    <th className={`w-[17%] ${headerCell}`}>Features</th>
                    <th className={`w-[11%] ${headerCell}`}>Created</th>
                    <th className={`w-[14%] text-center ${headerCell}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizations.map((organization) => (
                    <tr key={organization.id} className="transition-colors hover:bg-[#f8fcfc]">
                      <td className="px-4 py-3.5 align-middle">
                        <OrganizationName organization={organization} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <PlanBadge plan={organization.plan} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <Usage organization={organization} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <Features features={organization.features} />
                      </td>
                      <td className="px-4 py-3.5 align-middle text-[13px] font-medium text-slate-500">
                        {formatDate(organization.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-center align-middle">
                        <ChangePlanButton organization={organization} plans={plans} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {organizations.map((organization) => (
              <article key={organization.id} className="space-y-3 px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <OrganizationName organization={organization} />
                  <PlanBadge plan={organization.plan} />
                </div>
                <Usage organization={organization} />
                <Features features={organization.features} />
                <ChangePlanButton organization={organization} plans={plans} />
              </article>
            ))}
          </div>
        </>
      )}

      {pagination && !pastLastPage ? (
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500" aria-live="polite">
            Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()} organizations
          </p>
          <nav aria-label="Organization pagination" className="flex items-center gap-1">
            <Link
              href={withPage(Math.max(1, pagination.page - 1))}
              aria-label="Previous page"
              aria-disabled={!pagination.hasPrevPage}
              tabIndex={pagination.hasPrevPage ? undefined : -1}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-500 transition ${
                pagination.hasPrevPage
                  ? "border-slate-200 hover:border-[#00aeb5] hover:text-[#009ca4]"
                  : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
              }`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            {buildPageList(pagination.page, pagination.totalPages).map((item, index) =>
              item === "..." ? (
                <span key={`ellipsis-${index}`} className="inline-flex h-9 w-8 items-center justify-center text-sm text-slate-400">
                  …
                </span>
              ) : (
                <Link
                  key={item}
                  href={withPage(item)}
                  aria-current={item === pagination.page ? "page" : undefined}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
                    item === pagination.page
                      ? "pointer-events-none border-[#aee9e8] bg-[#eaf9f8] text-[#008f96]"
                      : "border-slate-200 text-slate-500 hover:border-[#00aeb5] hover:text-[#009ca4]"
                  }`}
                >
                  {item}
                </Link>
              ),
            )}
            <Link
              href={withPage(pagination.page + 1)}
              aria-label="Next page"
              aria-disabled={!pagination.hasNextPage}
              tabIndex={pagination.hasNextPage ? undefined : -1}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-500 transition ${
                pagination.hasNextPage
                  ? "border-slate-200 hover:border-[#00aeb5] hover:text-[#009ca4]"
                  : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
              }`}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <span className="ml-2 text-xs font-semibold text-slate-500">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </span>
          </nav>
        </div>
      ) : null}
    </section>
  );
}

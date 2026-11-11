import { buildPageList } from "@/components/clients/ClientDetilas";
import ClientSearchForm from "@/components/clients/ClientSearchForm";
import { grantedRfpPath, organizationRfpsPath, type GrantedRfpListItem, type GrantedRfpPage } from "@/lib/supportAccess/grants";
import { eventDates, formatDate, stageLabel } from "@/lib/supportAccess/rfpFields";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, FileText } from "lucide-react";
import Link from "next/link";

const STAGE_TONES: Record<string, string> = {
  Draft: "border-amber-200 bg-amber-50 text-amber-700",
  Archived: "border-slate-200 bg-slate-50 text-slate-600",
  Awarded: "border-violet-200 bg-violet-50 text-violet-700",
};

const Stage = ({ rfp }: { rfp: GrantedRfpListItem }) => {
  const label = stageLabel(rfp);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
        STAGE_TONES[label] ?? "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {label}
    </span>
  );
};

const Owner = ({ rfp }: { rfp: GrantedRfpListItem }) =>
  rfp.owner ? (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-[#20304b]">{rfp.owner.name || "Unnamed member"}</p>
      {rfp.owner.email ? <p className="truncate text-xs text-slate-500">{rfp.owner.email}</p> : null}
    </div>
  ) : (
    <span className="text-[13px] text-slate-400">No longer a member</span>
  );

type GrantedRfpListProps = {
  organizationId: string;
  search: string;
  page: GrantedRfpPage;
};

/** The RFPs the organization's active grants cover: all of them, or only the granted ones. */
export default function GrantedRfpList({ organizationId, search, page }: GrantedRfpListProps) {
  const { rfps, pagination } = page;
  const organizationWide = page.grants.some((grant) => grant.scope === "organization");
  const rangeStart = pagination.total === 0 || rfps.length === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const rangeEnd = rangeStart === 0 ? 0 : Math.min(rangeStart + rfps.length - 1, pagination.total);

  const hrefFor = (nextPage: number) => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (nextPage > 1) query.set("page", String(nextPage));
    const base = organizationRfpsPath(organizationId);
    return query.size ? `${base}?${query.toString()}` : base;
  };
  const hasPrev = pagination.page > 1;
  const hasNext = pagination.page < pagination.totalPages;
  const stepClass = (enabled: boolean) =>
    `inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-500 transition ${
      enabled ? "border-slate-200 hover:border-[#00aeb5] hover:text-[#009ca4]" : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
    }`;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-5 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">{organizationWide ? "RFPs" : "Granted RFPs"}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                {pagination.total.toLocaleString()} {search.trim() ? "matching" : "total"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {organizationWide
                ? "Every RFP in this organization, most recently updated first."
                : "Only the RFPs this organization granted, most recently updated first."}
            </p>
          </div>
        </div>
        <ClientSearchForm initialSearch={search} label="Search RFPs" placeholder="Search by event name" />
      </div>

      {rfps.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <FileText className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600">No RFPs found</p>
          <p className="mt-1 text-sm text-slate-400">
            {search.trim() ? "Try a different event name." : "There are no RFPs under this support access yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden p-4 sm:p-5 lg:block">
            <div
              className="overflow-auto rounded-xl border border-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#00aeb5] focus-visible:ring-offset-2"
              tabIndex={0}
              role="region"
              aria-label="RFPs table"
            >
              <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f8fafc]">
                    <th className="w-[34%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Event</th>
                    <th className="w-[24%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Owner</th>
                    <th className="w-[22%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Event dates</th>
                    <th className="w-[10%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Created</th>
                    <th className="w-[10%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rfps.map((rfp) => (
                    <tr key={rfp.id} className="transition-colors hover:bg-[#f8fcfc]">
                      <td className="px-4 py-3.5 align-middle">
                        <Link
                          href={grantedRfpPath(organizationId, rfp.id)}
                          prefetch={false}
                          className="block truncate text-[13px] font-bold text-[#20304b] transition hover:text-[#008f96]"
                          title={rfp.eventName}
                        >
                          {rfp.eventName}
                        </Link>
                        <div className="mt-1">
                          <Stage rfp={rfp} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <Owner rfp={rfp} />
                      </td>
                      <td className="px-4 py-3.5 align-middle text-[13px] text-slate-500">
                        <p className="truncate">{eventDates(rfp)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-500">{formatDate(rfp.createdAt) ?? "—"}</td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-500">{formatDate(rfp.updatedAt) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {rfps.map((rfp) => (
              <article key={rfp.id} className="space-y-2 px-5 py-4">
                <h3 className="break-words text-sm font-bold text-[#20304b]">
                  <Link href={grantedRfpPath(organizationId, rfp.id)} prefetch={false} className="hover:text-[#008f96]">
                    {rfp.eventName}
                  </Link>
                </h3>
                <Stage rfp={rfp} />
                <Owner rfp={rfp} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {eventDates(rfp)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Updated {formatDate(rfp.updatedAt) ?? "—"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {pagination.total > 0 ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500" aria-live="polite">
            Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {pagination.total.toLocaleString()} RFPs
          </p>
          <nav aria-label="RFP pagination" className="flex items-center gap-1">
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
                <span key={`ellipsis-${index}`} className="inline-flex h-9 w-8 items-center justify-center text-sm text-slate-400">
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
                      ? "pointer-events-none border-[#aee9e8] bg-[#eaf9f8] text-[#008f96]"
                      : "border-slate-200 text-slate-500 hover:border-[#00aeb5] hover:text-[#009ca4]"
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
            <span className="ml-2 text-xs font-semibold text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
          </nav>
        </div>
      ) : null}
    </section>
  );
}

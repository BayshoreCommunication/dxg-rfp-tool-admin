import {
  getAdminProposalsAction,
  type AdminProposalItem,
  type AdminProposalView,
} from "@/app/actions/adminProposals";
import { PROPOSAL_VIEWS, eventDates, formatDate, publishedState } from "./proposalLabels";
import { buildPageList } from "@/components/clients/ClientDetilas";
import ClientSearchForm from "@/components/clients/ClientSearchForm";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, FileText } from "lucide-react";
import Link from "next/link";

type ProposalsDirectoryProps = {
  search?: string;
  page?: number;
  view?: AdminProposalView;
};

const Badge = ({ tone, children }: { tone: "amber" | "emerald" | "slate" | "violet"; children: string }) => {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
};

/** The same badges the planner sees on their own proposal list. */
const ProposalBadges = ({ proposal }: { proposal: AdminProposalItem }) => (
  <div className="flex flex-wrap gap-1">
    {proposal.isArchived ? <Badge tone="slate">Archived</Badge> : null}
    {proposal.isCopy ? <Badge tone="violet">Saved copy</Badge> : null}
    {proposal.isDraft ? (
      <Badge tone="amber">Draft</Badge>
    ) : publishedState(proposal) === "Live" ? (
      <Badge tone="emerald">Live</Badge>
    ) : (
      <Badge tone="slate">Offline</Badge>
    )}
  </div>
);

const Planner = ({ proposal }: { proposal: AdminProposalItem }) =>
  proposal.planner ? (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-[#20304b]">{proposal.planner.name || "Unnamed planner"}</p>
      {proposal.planner.email ? (
        <Link
          href={`/clients?search=${encodeURIComponent(proposal.planner.email)}`}
          className="block truncate text-xs text-slate-500 transition hover:text-[#008f96]"
          title="Open this planner in Clients"
        >
          {proposal.planner.email}
        </Link>
      ) : null}
    </div>
  ) : (
    <span className="text-[13px] text-slate-400">Deleted account</span>
  );

export const ProposalsDirectorySkeleton = () => (
  <section
    className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white lg:flex lg:min-h-0 lg:flex-col"
    aria-label="Loading proposals"
    aria-busy="true"
  >
    <div className="flex shrink-0 flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-100" />
        <div className="space-y-2">
          <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100 sm:w-80" />
    </div>
    <div className="divide-y divide-slate-100 p-4 sm:p-5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[68px] animate-pulse bg-white">
          <div className="flex h-full items-center gap-4 px-4">
            <div className="h-3 w-48 rounded bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default async function ProposalsDirectory({ search = "", page = 1, view = "all" }: ProposalsDirectoryProps) {
  const response = await getAdminProposalsAction(search, page, view);
  const proposals = response.data?.data || [];
  const pagination = response.data?.pagination;
  const counts = response.data?.counts;
  const safePage = Math.max(1, page);
  const total = pagination?.total ?? proposals.length;
  const pageSize = pagination?.perPage ?? Math.max(proposals.length, 1);
  const rangeStart = total === 0 ? 0 : (Math.max(pagination?.page ?? safePage, 1) - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(rangeStart + proposals.length - 1, total);

  const hrefFor = (next: { page?: number; view?: AdminProposalView }) => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    const nextView = next.view ?? view;
    if (nextView !== "all") query.set("view", nextView);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    return query.size ? `/proposals?${query.toString()}` : "/proposals";
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:flex lg:min-h-0 lg:flex-col">
      <div className="flex shrink-0 flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">All proposals</h2>
                {typeof counts?.all === "number" ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    {counts.all.toLocaleString()} total
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">Every planner&apos;s proposals, most recently updated first.</p>
            </div>
          </div>
          <ClientSearchForm
            initialSearch={search}
            label="Search proposals"
            placeholder="Search event, planner name or email"
          />
        </div>
        <nav aria-label="Proposal status" className="flex flex-wrap gap-2">
          {PROPOSAL_VIEWS.map((item) => {
            const active = item.id === view;
            return (
              <Link
                key={item.id}
                href={hrefFor({ view: item.id })}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-[#aee9e8] bg-[#eaf9f8] text-[#008f96]"
                    : "border-slate-200 text-slate-500 hover:border-[#00aeb5] hover:text-[#009ca4]"
                }`}
              >
                {item.label}
                {counts ? <span className="tabular-nums opacity-70">{counts[item.id].toLocaleString()}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {!response.ok ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center lg:min-h-0 lg:flex-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-rose-700">Unable to load proposals</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">{response.error || "Please try again in a moment."}</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center lg:min-h-0 lg:flex-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <FileText className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600">No proposals found</p>
          <p className="mt-1 text-sm text-slate-400">
            {search.trim() ? "Try a different event name, planner or email." : "Nothing in this view yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden min-h-0 p-4 sm:p-5 lg:flex lg:flex-1 lg:flex-col">
            <div
              className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#00aeb5] focus-visible:ring-offset-2 [scrollbar-gutter:stable]"
              tabIndex={0}
              role="region"
              aria-label="Proposals table"
            >
              <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-100 bg-[#f8fafc]">
                    <th className="w-[30%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Event</th>
                    <th className="w-[24%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Planner</th>
                    <th className="w-[22%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Event dates</th>
                    <th className="w-[7%] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Views</th>
                    <th className="w-[8.5%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Created</th>
                    <th className="w-[8.5%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proposals.map((proposal) => (
                    <tr key={proposal.id} className="transition-colors hover:bg-[#f8fcfc]">
                      <td className="px-4 py-3.5 align-middle">
                        <Link
                          href={`/proposals/${proposal.id}`}
                          className="block truncate text-[13px] font-bold text-[#20304b] transition hover:text-[#008f96]"
                          title={proposal.eventName}
                        >
                          {proposal.eventName}
                        </Link>
                        <div className="mt-1">
                          <ProposalBadges proposal={proposal} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <Planner proposal={proposal} />
                      </td>
                      <td className="px-4 py-3.5 align-middle text-[13px] text-slate-500">
                        <p className="truncate">{eventDates(proposal)}</p>
                        {proposal.eventFormat || proposal.attendees ? (
                          <p className="truncate text-xs text-slate-400">
                            {[proposal.eventFormat, proposal.attendees ? `${proposal.attendees} attendees` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5 text-center text-sm font-semibold tabular-nums text-[#34445f]">
                        {proposal.viewsCount}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-500">{formatDate(proposal.createdAt) ?? "—"}</td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-500">{formatDate(proposal.updatedAt) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {proposals.map((proposal) => (
              <article key={proposal.id} className="space-y-2 px-5 py-4">
                <h3 className="text-sm font-bold text-[#20304b]">
                  <Link href={`/proposals/${proposal.id}`} className="hover:text-[#008f96]">
                    {proposal.eventName}
                  </Link>
                </h3>
                <ProposalBadges proposal={proposal} />
                <Planner proposal={proposal} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {eventDates(proposal)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    {proposal.viewsCount} views
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Updated {formatDate(proposal.updatedAt) ?? "—"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {response.ok && pagination ? (
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500" aria-live="polite">
            Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()} proposals
          </p>
          <nav aria-label="Proposal pagination" className="flex items-center gap-1">
            <Link
              href={hrefFor({ page: Math.max(1, safePage - 1) })}
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
                  href={hrefFor({ page: item })}
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
              href={hrefFor({ page: safePage + 1 })}
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

import ClientSearchForm from "@/components/clients/ClientSearchForm";
import { countLabel } from "@/lib/plural";
import {
  organizationProposalPath,
  organizationProposalsPath,
  pageRange,
  withQuery,
  type ProposalListItem,
  type ProposalsPage,
} from "@/lib/organizationContent/content";
import { eventDates, formatDate, stageLabel } from "@/lib/organizationContent/proposalFields";
import { CalendarDays, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { ContentCard, EmptyState, Pager } from "./ContentChrome";

const STAGE_TONES: Record<string, string> = {
  Draft: "border-amber-200 bg-amber-50 text-amber-700",
  Archived: "border-slate-200 bg-slate-50 text-slate-600",
  Awarded: "border-violet-200 bg-violet-50 text-violet-700",
};

const Stage = ({ rfp }: { rfp: ProposalListItem }) => {
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

const Owner = ({ rfp }: { rfp: ProposalListItem }) =>
  rfp.owner ? (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-[#20304b]">{rfp.owner.name || "Unnamed member"}</p>
      {rfp.owner.email ? <p className="truncate text-xs text-slate-500">{rfp.owner.email}</p> : null}
    </div>
  ) : (
    <span className="text-[13px] text-slate-500">No longer a member</span>
  );

type ProposalListProps = {
  organizationId: string;
  search: string;
  page: ProposalsPage;
};

/** Every proposal in the organization, most recently updated first. View only. */
export default function ProposalList({ organizationId, search, page }: ProposalListProps) {
  const { rfps, pagination } = page;
  const range = pageRange(pagination, rfps.length);
  const hrefFor = (nextPage: number) => withQuery(organizationProposalsPath(organizationId), { search: search.trim(), page: nextPage });

  return (
    <ContentCard
      icon={FileText}
      title="Proposals"
      count={`${pagination.total.toLocaleString("en-US")} ${search.trim() ? "matching" : "total"}`}
      description="Every proposal in this organization, most recently updated first."
      controls={<ClientSearchForm initialSearch={search} label="Search proposals" placeholder="Search by event name" />}
    >
      {rfps.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals found"
          message={search.trim() ? "Try a different event name." : "This organization has no proposals yet."}
        />
      ) : (
        <>
          <div className="hidden p-4 sm:p-5 lg:block">
            <div
              className="overflow-auto rounded-xl border border-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#00aeb5] focus-visible:ring-offset-2"
              tabIndex={0}
              role="region"
              aria-label="Proposals table"
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
                          href={organizationProposalPath(organizationId, rfp.id)}
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
                  <Link href={organizationProposalPath(organizationId, rfp.id)} prefetch={false} className="hover:text-[#008f96]">
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

      <Pager
        pagination={pagination}
        summary={`Showing ${range.start.toLocaleString("en-US")}–${range.end.toLocaleString("en-US")} of ${countLabel(pagination.total, "proposal")}`}
        label="Proposal pagination"
        hrefFor={hrefFor}
      />
    </ContentCard>
  );
}

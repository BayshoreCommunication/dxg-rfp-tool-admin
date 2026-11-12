import { AlertCircle, Building2, Inbox, X } from "lucide-react";
import Link from "next/link";
import {
  listSupportAgentsAction,
  listSupportTicketsAction,
  type SupportTicket,
} from "@/app/actions/supportDesk";
import SupportInboxFilters from "./SupportInboxFilters";
import {
  categoryLabel,
  priorityClass,
  priorityLabel,
  statusClass,
  statusLabel,
} from "./supportLabels";
import ResponseDueBadge from "./ResponseDueBadge";
import SupportDateTime from "./SupportDateTime";
import { organizationName } from "@/lib/support/organization";

type Filters = {
  status: string;
  assignee: string;
  priority: string;
  category: string;
  search: string;
  organization: string;
  sort: string;
  page: number;
};

export { SupportInboxSkeleton } from "./SupportSkeletons";

const Badge = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${className}`}>
    {children}
  </span>
);

const TicketRow = ({ ticket }: { ticket: SupportTicket }) => {
  const unread = ticket.unreadForAgents > 0;
  // Ticket numbers are per organization, so the organization is shown beside the number.
  const organization = organizationName(ticket.organization);
  return (
    <li>
      <Link
        href={`/support/${ticket.id}`}
        className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-5 py-3.5 transition hover:bg-[#f7fcfc] dark:hover:bg-cyan-950/30 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${
          unread ? "bg-[#fbfefe] dark:bg-cyan-950/15" : ""
        }`}
      >
        <span
          className={`mt-2 h-2.5 w-2.5 rounded-full ${unread ? "bg-[#00c2c9]" : "bg-transparent"}`}
          aria-label={unread ? "Unread customer message" : undefined}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {organization && (
              <span className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-[#1c3442] dark:text-slate-200">
                <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{organization}</span>
              </span>
            )}
            <span className="text-xs font-bold text-slate-400">#{ticket.ticketNumber}</span>
            <span className={`truncate text-sm ${unread ? "font-extrabold text-[#10203a] dark:text-slate-50" : "font-semibold text-[#263650] dark:text-slate-200"}`}>
              {ticket.subject}
            </span>
            <Badge className={statusClass(ticket.status)}>{statusLabel(ticket.status)}</Badge>
            <Badge className={priorityClass(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
            <ResponseDueBadge dueAt={ticket.responseDueAt} resolvedAt={ticket.status === "resolved" ? ticket.resolvedAt : null} />
          </div>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {ticket.requester?.name ?? "Unknown requester"}
            {ticket.requester?.company ? ` · ${ticket.requester.company}` : ""}
            {" · "}
            {categoryLabel(ticket.category)}
            {" · "}
            {ticket.messageCount} message{ticket.messageCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="col-start-2 flex items-center gap-3 text-xs text-slate-500 sm:col-start-3 sm:flex-col sm:items-end sm:gap-1">
          <SupportDateTime value={ticket.lastMessageAt} relative />
          <span className={ticket.assignee ? "font-semibold text-slate-600 dark:text-slate-300" : "italic text-rose-500"}>
            {ticket.assignee?.name ?? "Unassigned"}
          </span>
        </div>
      </Link>
    </li>
  );
};

export default async function SupportInbox({
  filters,
  currentUserId,
}: {
  filters: Filters;
  currentUserId: string;
}) {
  void currentUserId;
  const [listResult, agentsResult] = await Promise.all([
    listSupportTicketsAction({
      status: filters.status || undefined,
      assignee: filters.assignee || undefined,
      priority: filters.priority || undefined,
      category: filters.category || undefined,
      search: filters.search || undefined,
      organization: filters.organization || undefined,
      sort: filters.sort === "recent" ? "recent" : "urgency",
      page: filters.page,
      perPage: 20,
    }),
    listSupportAgentsAction(),
  ]);
  const agents = agentsResult.ok ? agentsResult.data : [];
  const tickets = listResult.ok ? listResult.data.tickets : [];
  const pagination = listResult.ok ? listResult.data.pagination : null;
  // The name of the organization the inbox is narrowed to, when a listed ticket carries it.
  const narrowedTo = filters.organization
    ? organizationName(tickets.find((ticket) => ticket.organization?.id === filters.organization)?.organization)
    : null;

  const withoutOrganization = () => {
    const query = new URLSearchParams();
    for (const key of ["status", "assignee", "priority", "category", "search", "sort"] as const) {
      if (filters[key]) query.set(key, filters[key]);
    }
    const suffix = query.toString();
    return suffix ? `/support?${suffix}` : "/support";
  };

  const withPage = (target: number) => {
    const query = new URLSearchParams();
    for (const key of ["status", "assignee", "priority", "category", "search", "organization", "sort"] as const) {
      if (filters[key]) query.set(key, filters[key]);
    }
    query.set("page", String(target));
    return `/support?${query.toString()}`;
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <SupportInboxFilters
          key={filters.search}
          agents={agents}
          values={{
            status: filters.status,
            assignee: filters.assignee,
            priority: filters.priority,
            category: filters.category,
            search: filters.search,
            sort: filters.sort,
          }}
        />
      </div>
      {filters.organization && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-[#f7fcfc] px-5 py-2.5 text-xs text-slate-600 dark:bg-cyan-950/20 dark:text-slate-300">
          <Building2 className="h-3.5 w-3.5 text-[#007f86]" aria-hidden="true" />
          <span>
            Showing tickets from <span className="font-bold text-[#10203a] dark:text-slate-50">{narrowedTo ?? "one organization"}</span> only.
          </span>
          <Link href={withoutOrganization()} className="inline-flex items-center gap-1 font-semibold text-[#007f86] hover:underline">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Show every organization
          </Link>
        </div>
      )}
      {!listResult.ok ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-rose-700">Unable to load the inbox</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">{listResult.error}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Inbox className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600">No tickets match these filters</p>
          <p className="mt-1 text-sm text-slate-400">New questions from customers will appear here.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </ul>
          {pagination && pagination.totalPages > 1 && (
            <nav aria-label="Inbox pages" className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} tickets
              </span>
              <div className="flex gap-2">
                {pagination.page > 1 && (
                  <Link href={withPage(pagination.page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:border-[#00aeb5]">
                    Previous
                  </Link>
                )}
                {pagination.page < pagination.totalPages && (
                  <Link href={withPage(pagination.page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:border-[#00aeb5]">
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

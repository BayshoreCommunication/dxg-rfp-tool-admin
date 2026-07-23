import { getAllClientsAction, type AllClientItem } from "@/app/actions/allClients";
import { auth } from "@/auth";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Mail,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import BlockClientButton from "./BlockClientButton";
import ClientSearchForm from "./ClientSearchForm";
import DeleteClientButton from "./DeleteClientButton";

type ClientDetailsProps = {
  isLoading?: boolean;
  search?: string;
  page?: number;
};

const formatDate = (isoDate?: string) => {
  if (!isoDate) return "N/A";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const avatarTones = [
  "bg-cyan-50 text-cyan-700",
  "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-sky-50 text-sky-700",
];

const getAvatarTone = (name?: string) => {
  const firstCharacter = name?.trim().charCodeAt(0) ?? 0;
  return avatarTones[firstCharacter % avatarTones.length];
};

const getInitial = (name?: string) =>
  name?.trim().charAt(0).toUpperCase() || "U";

const buildPageList = (current: number, total: number): (number | "...")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (
    let index = Math.max(2, current - 1);
    index <= Math.min(total - 1, current + 1);
    index += 1
  ) {
    pages.push(index);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
};

const StatusBadge = ({ blocked }: { blocked?: boolean }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
      blocked
        ? "bg-rose-50 text-rose-700"
        : "bg-emerald-50 text-emerald-700"
    }`}
  >
    <span
      className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
        blocked ? "bg-rose-500" : "bg-emerald-500"
      }`}
    />
    {blocked ? "Blocked" : "Active"}
  </span>
);

const ClientActions = ({
  client,
  isSuperAdmin,
}: {
  client: AllClientItem;
  isSuperAdmin: boolean;
}) =>
  isSuperAdmin ? (
    <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-center">
      <BlockClientButton
        clientId={client.id}
        isBlocked={client.isBlocked ?? false}
      />
      <DeleteClientButton clientId={client.id} />
    </div>
  ) : (
    <span className="text-sm text-slate-300">—</span>
  );

export const ClientDetailsSkeleton = () => (
  <section
    className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white lg:flex lg:min-h-0 lg:flex-col"
    aria-label="Loading client directory"
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
    <div className="min-h-0 p-4 sm:p-5 lg:flex lg:flex-1 lg:flex-col">
      <div className="min-h-[356px] overflow-hidden rounded-xl border border-slate-100 lg:min-h-0 lg:flex-1">
        <div className="h-10 animate-pulse border-b border-slate-100 bg-slate-50" />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[79px] animate-pulse bg-white">
              <div className="flex h-full items-center gap-4 px-4">
                <div className="h-9 w-9 rounded-full bg-slate-100" />
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-200" />
                  <div className="h-4 w-16 rounded-full bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6">
      <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  </section>
);

export default async function ClientDetails({
  search = "",
  page = 1,
  isLoading,
}: ClientDetailsProps) {
  if (isLoading) return <ClientDetailsSkeleton />;

  const session = await auth();
  const sessionRole = (session?.user?.role || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]/g, "_");
  const isSuperAdmin =
    sessionRole === "super_admin" || sessionRole === "superadmin";

  const response = await getAllClientsAction(search, page);
  const clients = response.data?.data || [];
  const pagination = response.data?.pagination;
  const safePage = Math.max(1, page);
  const totalClients = pagination?.total ?? clients.length;
  const pageSize = pagination?.perPage ?? Math.max(clients.length, 1);
  const rangeStart =
    totalClients === 0
      ? 0
      : (Math.max(pagination?.page ?? safePage, 1) - 1) * pageSize + 1;
  const rangeEnd =
    totalClients === 0
      ? 0
      : Math.min(rangeStart + clients.length - 1, totalClients);

  const baseQuery = new URLSearchParams();
  if (search.trim()) baseQuery.set("search", search.trim());
  const withPage = (targetPage: number) => {
    const query = new URLSearchParams(baseQuery);
    query.set("page", String(targetPage));
    return `/clients?${query.toString()}`;
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:flex lg:min-h-0 lg:flex-col">
      <div className="flex shrink-0 flex-col gap-5 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
            <UsersRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">
                Client directory
              </h2>
              {typeof pagination?.total === "number" ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                  {pagination.total.toLocaleString()} total
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Find accounts and manage their current access status.
            </p>
          </div>
        </div>

        <ClientSearchForm initialSearch={search} />
      </div>

      {!response.ok ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center lg:min-h-0 lg:flex-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-rose-700">
            Unable to load clients
          </p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {response.error || "Please try again in a moment."}
          </p>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center lg:min-h-0 lg:flex-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <UsersRound className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600">
            No clients found
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Try a different name or email address.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden min-h-0 p-4 sm:p-5 lg:flex lg:flex-1 lg:flex-col">
            <div
              className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#00aeb5] focus-visible:ring-offset-2 [scrollbar-gutter:stable]"
              tabIndex={0}
              role="region"
              aria-label="Client directory table"
            >
              <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-100 bg-[#f8fafc]">
                    <th className="w-[20%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Client
                    </th>
                    <th className="w-[20%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Contact
                    </th>
                    <th className="w-[15%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Company
                    </th>
                    <th className="w-[9%] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Proposals
                    </th>
                    <th className="w-[10%] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Emails
                    </th>
                    <th className="w-[11%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Joined
                    </th>
                    <th className="w-[15%] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="group transition-colors hover:bg-[#f8fcfc]"
                    >
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarTone(client.name)}`}
                          >
                            {getInitial(client.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-[#20304b]">
                              {client.name || "Unknown client"}
                            </p>
                            <div className="mt-1">
                              <StatusBadge blocked={client.isBlocked} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <a
                          href={`mailto:${client.email}`}
                          className="block truncate text-[13px] text-slate-500 transition hover:text-[#008f96]"
                          title={client.email}
                        >
                          {client.email}
                        </a>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span
                          className="block truncate text-[13px] text-slate-500"
                          title={client.company || undefined}
                        >
                          {client.company || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center text-sm font-semibold tabular-nums text-[#34445f]">
                        {client.totalProposals ?? 0}
                      </td>
                      <td className="px-3 py-3.5 text-center text-sm font-semibold tabular-nums text-[#34445f]">
                        {client.totalEmailSent ?? 0}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-500">
                        {formatDate(client.joinDate)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <ClientActions
                          client={client}
                          isSuperAdmin={isSuperAdmin}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {clients.map((client) => (
              <article key={client.id} className="px-5 py-5">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarTone(client.name)}`}
                  >
                    {getInitial(client.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-[#20304b]">
                          {client.name || "Unknown client"}
                        </h3>
                        <StatusBadge blocked={client.isBlocked} />
                      </div>
                      <ClientActions
                        client={client}
                        isSuperAdmin={isSuperAdmin}
                      />
                    </div>
                    <a
                      href={`mailto:${client.email}`}
                      className="mt-3 flex items-center gap-2 text-xs text-slate-500"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{client.email}</span>
                    </a>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {client.company || "No company"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {formatDate(client.joinDate)}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        {client.totalProposals ?? 0} proposals
                      </span>
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                        {client.totalEmailSent ?? 0} emails
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {response.ok && pagination ? (
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-semibold text-slate-500" aria-live="polite">
              Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
              {totalClients.toLocaleString()} clients
            </p>
          </div>
          <nav aria-label="Client pagination" className="flex items-center gap-1">
            <Link
              href={withPage(Math.max(1, safePage - 1))}
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
            {buildPageList(pagination.page, pagination.totalPages).map(
              (item, index) =>
                item === "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="inline-flex h-9 w-8 items-center justify-center text-sm text-slate-400"
                  >
                    …
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={withPage(item)}
                    aria-current={
                      item === pagination.page ? "page" : undefined
                    }
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
              href={withPage(safePage + 1)}
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

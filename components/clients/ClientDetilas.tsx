import { getAllClientsAction } from "@/app/actions/allClients";
import BlockClientButton from "./BlockClientButton";
import Link from "next/link";
import { User, Mail, Calendar, Search } from "lucide-react";

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

const generateGradient = (name: string) => {
  const colors = [
    "from-rose-400 to-red-500",
    "from-blue-400 to-indigo-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-purple-400 to-fuchsia-500",
    "from-cyan-400 to-blue-500",
  ];
  const charCode = name?.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

export const ClientDetailsSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mt-6">
      {/* Header section skeleton */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-xl w-10 h-10 animate-pulse" />
          <div className="w-32 h-6 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="w-80 h-10 bg-slate-100 rounded-lg animate-pulse" />
      </div>

      {/* Table section skeleton */}
      <div className="w-full overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <th key={i} className="px-4 py-3 leading-tight">
                  <div className="w-20 h-3 bg-slate-200 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row} className="bg-white">
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                    <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-200 animate-pulse" />
                    <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="w-12 h-6 mx-auto rounded-full bg-emerald-100 animate-pulse" />
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="w-12 h-6 mx-auto rounded-full bg-blue-100 animate-pulse" />
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-200 animate-pulse" />
                    <div className="w-20 h-4 bg-slate-200 rounded animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="w-16 h-7 mx-auto rounded-lg bg-slate-100 animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination skeleton */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 px-2 pt-6">
        <div className="w-40 h-4 bg-slate-100 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-20 h-8 bg-slate-100 rounded-md animate-pulse" />
          <div className="w-20 h-8 bg-slate-100 rounded-md animate-pulse" />
        </div>
      </div>
    </div>
  );
};

const ClientDetails = async ({ search = "", page = 1, isLoading }: ClientDetailsProps) => {
  if (isLoading) return <ClientDetailsSkeleton />;

  const response = await getAllClientsAction(search, page);
  const clients = response.data?.data || [];
  const pagination = response.data?.pagination;

  const safePage = Math.max(1, page);
  const prevPage = Math.max(1, safePage - 1);
  const nextPage = safePage + 1;

  const baseQuery = new URLSearchParams();
  if (search.trim()) {
    baseQuery.set("search", search.trim());
  }

  const withPage = (targetPage: number) => {
    const q = new URLSearchParams(baseQuery);
    q.set("page", String(targetPage));
    return `/clients?${q.toString()}`;
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mt-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">All Clients</h2>
            <p className="text-sm text-slate-500 mt-0.5">Manage and search your complete client list</p>
          </div>
        </div>

        <form className="flex items-center gap-2 w-full sm:w-auto" method="GET" action="/clients">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search name or email"
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table section */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase">
                Client Details
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase">
                Contact Info
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase text-center">
                Proposals
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase text-center">
                Emails Sent
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase">
                Joined Date
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase text-center">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!response.ok ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center align-middle">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-sm font-medium text-rose-500 bg-rose-50 px-4 py-2 rounded-lg border border-rose-100/50">
                      {response.error || "Failed to load clients."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center align-middle">
                  <div className="flex flex-col items-center justify-center">
                    <User className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="text-sm font-medium text-slate-500">No clients found matching your criteria.</p>
                  </div>
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="group hover:bg-slate-50/50 transition-colors duration-200"
                >
                  {/* Client Details */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${generateGradient(client.name || 'User')} text-sm font-bold text-white shadow-sm ring-2 ring-white`}>
                        {client.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {client.name || "Unknown Client"}
                        </span>
                        {client.isBlocked ? (
                          <span className="inline-flex w-max items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100">
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex w-max items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* Client Email */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium">{client.email}</span>
                    </div>
                  </td>
                  
                  {/* Proposal Count */}
                  <td className="px-4 py-3 text-center align-middle">
                    <div className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100/50">
                      {client.totalProposals || 0}
                    </div>
                  </td>

                  {/* Email Sent */}
                  <td className="px-4 py-3 text-center align-middle">
                    <div className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100/50">
                      {client.totalEmailSent || 0}
                    </div>
                  </td>
                  
                  {/* Joining Date */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium">{formatDate(client.joinDate)}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center align-middle">
                    <BlockClientButton
                      clientId={client.id}
                      isBlocked={client.isBlocked ?? false}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {response.ok && pagination ? (
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 px-2 pt-6">
          <p className="text-sm font-medium text-slate-500">
            Showing Page <span className="font-bold text-slate-900">{pagination.page}</span> of <span className="font-bold text-slate-900">{pagination.totalPages}</span> 
            <span className="mx-2 text-slate-300">|</span> 
            Total: <span className="font-bold text-slate-900">{pagination.total}</span> clients
          </p>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link
              href={withPage(prevPage)}
              className={`rounded-lg border px-4 py-2 transition-colors ${
                pagination.hasPrevPage
                  ? "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                  : "pointer-events-none border-slate-100 text-slate-300 bg-slate-50/50"
              }`}
            >
              Previous
            </Link>
            <Link
              href={withPage(nextPage)}
              className={`rounded-lg border px-4 py-2 transition-colors ${
                pagination.hasNextPage
                  ? "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                  : "pointer-events-none border-slate-100 text-slate-300 bg-slate-50/50"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ClientDetails;

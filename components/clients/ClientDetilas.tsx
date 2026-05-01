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
    <div className="bg-[#111318] rounded-2xl p-5 sm:p-6 border border-gray-700/50 mt-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gray-700 rounded-xl w-10 h-10 animate-pulse" />
          <div className="w-32 h-6 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="w-80 h-10 bg-gray-800 rounded-lg animate-pulse" />
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-gray-700/50">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700/50">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <th key={i} className="px-4 py-3 leading-tight">
                  <div className="w-20 h-3 bg-gray-700 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row} className="bg-[#111318]">
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
                    <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
                    <div className="w-32 h-4 bg-gray-700 rounded animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="w-12 h-6 mx-auto rounded-full bg-emerald-900/50 animate-pulse" />
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="w-12 h-6 mx-auto rounded-full bg-blue-900/50 animate-pulse" />
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-700 animate-pulse" />
                    <div className="w-20 h-4 bg-gray-700 rounded animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="w-16 h-7 mx-auto rounded-lg bg-gray-700 animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-700/50 px-2 pt-6">
        <div className="w-40 h-4 bg-gray-700 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-20 h-8 bg-gray-700 rounded-md animate-pulse" />
          <div className="w-20 h-8 bg-gray-700 rounded-md animate-pulse" />
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
  if (search.trim()) baseQuery.set("search", search.trim());

  const withPage = (targetPage: number) => {
    const q = new URLSearchParams(baseQuery);
    q.set("page", String(targetPage));
    return `/clients?${q.toString()}`;
  };

  return (
    <div className="bg-[#111318] rounded-2xl p-5 sm:p-6 border border-gray-700/50 mt-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl">
            <User className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100 tracking-tight">All Clients</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage and search your complete client list</p>
          </div>
        </div>

        <form className="flex items-center gap-2 w-full sm:w-auto" method="GET" action="/clients">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-gray-500" />
            </div>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search name or email"
              className="h-10 w-full rounded-lg border border-gray-600 bg-gray-800 pl-10 pr-3 text-sm text-gray-100 placeholder:text-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-lg bg-gray-700 px-4 text-sm font-medium text-gray-100 hover:bg-gray-600 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table section */}
      <div className="w-full overflow-x-auto rounded-xl border border-gray-700/50">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700/50">
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase">Client Details</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase">Contact Info</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase text-center">Proposals</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase text-center">Emails Sent</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase">Joined Date</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {!response.ok ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center align-middle">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-sm font-medium text-rose-400 bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-500/20">
                      {response.error || "Failed to load clients."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center align-middle">
                  <div className="flex flex-col items-center justify-center">
                    <User className="w-12 h-12 text-gray-700 mb-3" />
                    <p className="text-sm font-medium text-gray-500">No clients found matching your criteria.</p>
                  </div>
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="group hover:bg-gray-800/40 transition-colors duration-200"
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${generateGradient(client.name || 'User')} text-sm font-bold text-white shadow-sm ring-2 ring-gray-700`}>
                        {client.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-gray-200 group-hover:text-indigo-400 transition-colors">
                          {client.name || "Unknown Client"}
                        </span>
                        {client.isBlocked ? (
                          <span className="inline-flex w-max items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex w-max items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Mail className="w-4 h-4 text-gray-600 shrink-0" />
                      <span className="text-sm font-medium">{client.email}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    <div className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                      {client.totalProposals || 0}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    <div className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                      {client.totalEmailSent || 0}
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar className="w-4 h-4 text-gray-600 shrink-0" />
                      <span className="text-sm font-medium">{formatDate(client.joinDate)}</span>
                    </div>
                  </td>

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
        <div className="mt-6 flex items-center justify-between border-t border-gray-700/50 px-2 pt-6">
          <p className="text-sm font-medium text-gray-500">
            Showing Page <span className="font-bold text-gray-300">{pagination.page}</span> of{" "}
            <span className="font-bold text-gray-300">{pagination.totalPages}</span>
            <span className="mx-2 text-gray-700">|</span>
            Total: <span className="font-bold text-gray-300">{pagination.total}</span> clients
          </p>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link
              href={withPage(prevPage)}
              className={`rounded-lg border px-4 py-2 transition-colors ${
                pagination.hasPrevPage
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
                  : "pointer-events-none border-gray-700/50 text-gray-600 bg-gray-800/30"
              }`}
            >
              Previous
            </Link>
            <Link
              href={withPage(nextPage)}
              className={`rounded-lg border px-4 py-2 transition-colors ${
                pagination.hasNextPage
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
                  : "pointer-events-none border-gray-700/50 text-gray-600 bg-gray-800/30"
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

import { AdminOverviewClient } from "@/app/actions/admin";
import { Calendar, ChevronRight, Mail, User } from "lucide-react";
import Link from "next/link";

type RecentClientsProps = {
  isLoading?: boolean;
  clients?: AdminOverviewClient[];
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

export const RecentClientsSkeleton = () => {
  return (
    <div className="bg-[#111318] rounded-2xl p-5 sm:p-6 border border-gray-700/50 mt-2">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gray-700/50 rounded-xl w-10 h-10 animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="w-32 h-5 bg-gray-700 rounded animate-pulse" />
            <div className="w-48 h-3 bg-gray-700/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-16 h-4 bg-gray-700/50 rounded animate-pulse" />
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-gray-700/50">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-700/50">
              {[1, 2, 3, 4, 5].map((i) => (
                <th key={i} className="px-4 py-3">
                  <div className="w-20 h-3 bg-gray-700 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {[1, 2, 3, 4].map((row) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RecentClients = ({ clients = [], isLoading }: RecentClientsProps) => {
  if (isLoading) return <RecentClientsSkeleton />;

  return (
    <div className="bg-[#111318] rounded-2xl p-5 sm:p-6 border border-gray-700/50 mt-2">
      {/* Header section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl">
            <User className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100 tracking-tight">
              Recent Clients
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Latest client acquisitions and engagements
            </p>
          </div>
        </div>
        <Link
          href="/clients"
          className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 group"
        >
          View All
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Table section */}
      <div className="w-full overflow-x-auto rounded-xl border border-gray-700/50">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700/50">
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase">
                Client Details
              </th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase">
                Contact Info
              </th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase text-center">
                Proposals
              </th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase text-center">
                Emails Sent
              </th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 tracking-wider uppercase">
                Joined Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center align-middle">
                  <div className="flex flex-col items-center justify-center">
                    <User className="w-12 h-12 text-gray-700 mb-3" />
                    <p className="text-sm font-medium text-gray-500">
                      No recent clients found.
                    </p>
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
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${generateGradient(client.name || "User")} text-sm font-bold text-white shadow-sm ring-2 ring-gray-700`}
                      >
                        {client.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-200 group-hover:text-indigo-400 transition-colors">
                          {client.name || "Unknown Client"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Mail className="w-4 h-4 text-gray-600 shrink-0" />
                      <span className="text-sm font-medium">
                        {client.email}
                      </span>
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
                      <span className="text-sm font-medium">
                        {formatDate(client.joinDate)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentClients;

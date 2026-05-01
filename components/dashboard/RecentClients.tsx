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

// Generates a consistent gradient background for avatars based on name
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
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mt-2">
      {/* Header section skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-xl w-10 h-10 animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="w-32 h-5 bg-slate-200 rounded animate-pulse" />
            <div className="w-48 h-3 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-16 h-4 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Table section skeleton */}
      <div className="w-full overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <th key={i} className="px-4 py-3">
                  <div className="w-20 h-3 bg-slate-200 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((row) => (
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
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mt-2">
      {/* Header section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Recent Clients
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Latest client acquisitions and engagements
            </p>
          </div>
        </div>
        <Link
          href="/clients"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1 group"
        >
          View All
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center align-middle">
                  <div className="flex flex-col items-center justify-center">
                    <User className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="text-sm font-medium text-slate-500">
                      No recent clients found.
                    </p>
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
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${generateGradient(client.name || "User")} text-sm font-bold text-white shadow-sm ring-2 ring-white`}
                      >
                        {client.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {client.name || "Unknown Client"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Client Email */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium">
                        {client.email}
                      </span>
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

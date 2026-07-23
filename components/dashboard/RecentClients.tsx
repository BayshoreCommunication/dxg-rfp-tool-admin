import { AdminOverviewClient } from "@/app/actions/admin";
import { Building2, CalendarDays, ChevronRight, Mail, UsersRound } from "lucide-react";
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

const getInitial = (name?: string) => {
  const firstLetter = name?.trim().charAt(0);
  return firstLetter ? firstLetter.toUpperCase() : "U";
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

export const RecentClientsSkeleton = () => (
  <section className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-100" />
        <div className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
    </div>

    <div className="p-4 sm:p-5">
      <div className="overflow-hidden rounded-xl border border-slate-100">
        <div className="h-11 animate-pulse border-b border-slate-100 bg-slate-50" />
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="grid grid-cols-[1.6fr_1.5fr_1.2fr_.6fr_.7fr_.9fr] items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
            {Array.from({ length: 6 }).map((_, column) => (
              <div key={column} className="h-4 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const EmptyClients = () => (
  <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
      <UsersRound className="h-7 w-7" aria-hidden="true" />
    </div>
    <p className="mt-4 text-sm font-semibold text-slate-600">No recent clients found</p>
    <p className="mt-1 max-w-xs text-sm text-slate-400">
      Newly added clients will appear here with their proposal and email activity.
    </p>
  </div>
);

export default function RecentClients({ clients = [], isLoading }: RecentClientsProps) {
  if (isLoading) return <RecentClientsSkeleton />;

  return (
    <section className="h-full overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a7ae]">
            <UsersRound className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">Recent Clients</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              Latest client acquisitions and engagements
            </p>
          </div>
        </div>

        <Link
          href="/clients"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold text-[#009ca4] transition hover:bg-cyan-50 hover:text-[#007e85] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5]"
        >
          <span className="hidden sm:inline">View all clients</span>
          <span className="sm:hidden">View all</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      {clients.length === 0 ? (
        <EmptyClients />
      ) : (
        <>
          <div className="hidden p-4 md:block sm:p-5">
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[800px] table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f8fafc]">
                    <th className="w-[23%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Client details</th>
                    <th className="w-[23%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Contact info</th>
                    <th className="w-[18%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Company</th>
                    <th className="w-[10%] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Proposals</th>
                    <th className="w-[12%] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Emails sent</th>
                    <th className="w-[14%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Joined date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => (
                    <tr key={client.id} className="group transition-colors hover:bg-[#f8fcfc]">
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarTone(client.name)}`}>
                            {getInitial(client.name)}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-[#20304b] group-hover:text-[#008f96]">
                            {client.name || "Unknown client"}
                          </span>
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
                        <span className="block truncate text-[13px] text-slate-500" title={client.company || undefined}>
                          {client.company || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle text-sm font-semibold tabular-nums text-[#34445f]">
                        {client.totalProposals ?? 0}
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle text-sm font-semibold tabular-nums text-[#34445f]">
                        {client.totalEmailSent ?? 0}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-[13px] font-medium text-slate-500">
                        {formatDate(client.joinDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {clients.map((client) => (
              <article key={client.id} className="px-5 py-4 transition-colors hover:bg-[#f8fcfc]">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarTone(client.name)}`}>
                    {getInitial(client.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-[#20304b]">{client.name || "Unknown client"}</h3>
                    <a href={`mailto:${client.email}`} className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{client.email}</span>
                    </a>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {client.company || "No company"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
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
    </section>
  );
}

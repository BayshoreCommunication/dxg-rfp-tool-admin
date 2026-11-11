import { listGrantedAccessAction } from "@/app/actions/supportAccess";
import {
  ACCESS_NOTICES,
  formatGrantExpiry,
  formatTimeLeft,
  grantScopeLabel,
  grantedAccessPath,
  isGrantEndingSoon,
  organizationLabel,
  type AccessNotice,
  type GrantedAccess,
} from "@/lib/supportAccess/grants";
import { AlertCircle, ArrowRight, Building2, FileText, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";

const Scope = ({ grant }: { grant: GrantedAccess }) => {
  const Icon = grant.scope === "organization" ? Building2 : FileText;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {grantScopeLabel(grant.scope)}
    </span>
  );
};

const TimeLeft = ({ grant }: { grant: GrantedAccess }) => (
  <>
    <p
      className={`text-[13px] font-bold tabular-nums ${
        isGrantEndingSoon(grant.secondsRemaining) ? "text-amber-700 dark:text-amber-300" : "text-[#20304b]"
      }`}
    >
      {formatTimeLeft(grant.secondsRemaining)} left
    </p>
    <p className="text-xs text-slate-500">Ends {formatGrantExpiry(grant.expiresAt)}</p>
  </>
);

const OpenLink = ({ grant }: { grant: GrantedAccess }) => (
  <Link
    href={grantedAccessPath(grant)}
    // Opening an organization or an RFP is an audited read: never fetch it ahead of the click.
    prefetch={false}
    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#008f96] transition hover:border-[#00aeb5] hover:bg-[#eaf9f8]"
  >
    {grant.scope === "organization" ? "View RFPs" : "Open RFP"}
    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    <span className="sr-only"> for {organizationLabel(grant.organization.name)}</span>
  </Link>
);

/** "Granted to me": a grant is to RFPilot Support as a whole, so this is every active grant. */
export default async function GrantsList({ notice }: { notice?: AccessNotice }) {
  const response = await listGrantedAccessAction();
  const grants = response.ok ? response.data : [];

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{ACCESS_NOTICES[notice]}</p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">Granted to me</h2>
              {response.ok ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                  {grants.length.toLocaleString()} active
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Active grants to RFPilot Support, soonest to end first. An organization&apos;s RFPs can be opened only from here.
            </p>
          </div>
        </div>

        {!response.ok ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-bold text-rose-700">Unable to load grants</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">{response.error}</p>
          </div>
        ) : grants.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-bold text-slate-600">No active grants</p>
            <p className="mt-1 max-w-md text-sm text-slate-400">
              No organization has granted RFPilot Support access right now. An Owner or Admin grants it from their organization
              settings, for one RFP or the whole organization, for up to 30 days.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden p-4 sm:p-5 lg:block">
              <div className="overflow-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#f8fafc]">
                      <th className="w-[26%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Organization</th>
                      <th className="w-[16%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Scope</th>
                      <th className="w-[24%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Reason given</th>
                      <th className="w-[20%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">Expiry</th>
                      <th className="w-[14%] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grants.map((grant) => (
                      <tr key={grant.id} className="transition-colors hover:bg-[#f8fcfc]">
                        <td className="px-4 py-3.5 align-middle">
                          <p className="truncate text-[13px] font-bold text-[#20304b]" title={organizationLabel(grant.organization.name)}>
                            {organizationLabel(grant.organization.name)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <Scope grant={grant} />
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <p className="line-clamp-2 break-words text-[13px] text-slate-500" title={grant.reason ?? undefined}>
                            {grant.reason ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <TimeLeft grant={grant} />
                        </td>
                        <td className="px-4 py-3.5 text-right align-middle">
                          <OpenLink grant={grant} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {grants.map((grant) => (
                <article key={grant.id} className="space-y-2 px-5 py-4">
                  <h3 className="break-words text-sm font-bold text-[#20304b]">{organizationLabel(grant.organization.name)}</h3>
                  <Scope grant={grant} />
                  {grant.reason ? <p className="break-words text-xs text-slate-500">{grant.reason}</p> : null}
                  <div>
                    <TimeLeft grant={grant} />
                  </div>
                  <OpenLink grant={grant} />
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

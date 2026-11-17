import {
  accountPlanItem,
  accountPlanLabel,
  autoApproveLabel,
  companySsoLabel,
  countryLabel,
  domainStatusBadge,
  domainsLabel,
  formatAccountDate,
  lastPlanChangeLabel,
  lastSignInLabel,
  managerInvitesLabel,
  memberCountLabels,
  openTicketsLabel,
  organizationName,
  ownerContact,
  plainCount,
  proposalsStoredLabel,
  roleCountRows,
  signInMethodLabels,
  standingBadge,
  supportAccessLabel,
  teamCountLabels,
  twoFactorLabel,
  type BadgeTone,
  type OrganizationAccount as Account,
} from "@/lib/organizationAccount";
import type { PlanOption } from "@/lib/organizationPlans";
import { SUPPORT_ACCESS_PATH } from "@/lib/supportAccess/grants";
import { Building2, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import ChangePlanButton from "./ChangePlanButton";
import { Features, PlanBadge, Usage } from "./OrganizationsDirectory";

type Props = {
  account: Account;
  /** The plan table, when it could be loaded: "Change plan" is offered only with it. */
  plans?: PlanOption[] | null;
};

// Each pair is at least 4.5:1 on its own background in the light theme (worked out from the
// Tailwind palette, not measured in a browser); the dark theme's colours come from the token
// bridge in app/globals.css (amber has no entry there, so it carries its own dark class).
const TONES: Record<BadgeTone, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-cyan-50 text-cyan-900",
};

const Badge = ({ tone, children, title }: { tone: BadgeTone; children: ReactNode; title?: string }) => (
  <span
    title={title}
    className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${TONES[tone]}`}
  >
    {children}
  </span>
);

const linkClass =
  "font-bold text-[#007f86] underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] dark:text-cyan-300";

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="min-w-0 rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
    <h2 className="text-base font-bold tracking-[-0.01em] text-[#12213a]">{title}</h2>
    <dl className="mt-3 divide-y divide-slate-100">{children}</dl>
  </section>
);

const Row = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <div className="py-3 first:pt-0 last:pb-0">
    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
    <dd className="mt-1 min-w-0 break-words text-sm font-semibold text-[#20304b]">{children}</dd>
    {hint ? <dd className="mt-1 text-xs leading-5 text-slate-500">{hint}</dd> : null}
  </div>
);

export default function OrganizationAccount({ account, plans }: Props) {
  const { organization, plan, counts, security } = account;
  const name = organizationName(organization.name);
  const standing = standingBadge(organization.standing);
  const owner = ownerContact(account.owner);
  const members = memberCountLabels(counts.members);
  const teams = teamCountLabels(counts.teams);
  const planItem = accountPlanItem(account);
  const lastChange = lastPlanChangeLabel(plan.lastChange);
  const methods = signInMethodLabels(security.signInMethods);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#b8e7e5] bg-[#dff5f4] text-[#007f86] shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-cyan-800/80 dark:bg-cyan-950/70 dark:text-cyan-300">
            <Building2 className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
              Organization
            </p>
            <h1 className="break-words text-[26px] font-extrabold leading-tight tracking-[-0.035em] text-[#12213a] sm:text-[32px]">
              {name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={standing.tone} title={standing.description}>
                {standing.label}
              </Badge>
              {plan.exempt ? <Badge tone="neutral">{accountPlanLabel(plan)}</Badge> : <PlanBadge plan={plan.plan} />}
            </div>
            {organization.standing !== "active" ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{standing.description}</p>
            ) : null}
          </div>
        </div>
        {plans && plans.length > 0 && !plan.exempt ? (
          <div className="shrink-0">
            <ChangePlanButton organization={planItem} plans={plans} />
          </div>
        ) : null}
      </header>

      <aside
        aria-label="What this page does not show"
        className="flex items-start gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-5 py-4 text-sm leading-6 text-cyan-900"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          This page shows account information only. Members, proposals and other customer content are not shown here.
          They need a support access grant from the organization:{" "}
          <Link href={SUPPORT_ACCESS_PATH} className={linkClass}>
            open Support access
          </Link>
          .
        </p>
      </aside>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Account">
          <Row label="Account contact (Owner)">
            <span className="block">{owner.name}</span>
            {owner.email ? <span className="block break-all font-medium text-slate-600">{owner.email}</span> : null}
          </Row>
          <Row label="Created">{formatAccountDate(organization.createdAt)}</Row>
          <Row label="Country">{countryLabel(organization.country)}</Row>
          <Row label="Slug">
            <span className="break-all">{organization.slug || "Not set"}</span>
          </Row>
        </Card>

        <Card title="Plan and usage">
          <Row label="Plan">{accountPlanLabel(plan)}</Row>
          <Row
            label="Proposals created"
            hint="Every proposal the organization has ever created. This is the number the plan limit uses."
          >
            <Usage organization={planItem} />
          </Row>
          <Row label="Features">
            <Features features={plan.features} />
          </Row>
          <Row label="Last plan change">
            <span className="block">{lastChange.line}</span>
            {lastChange.detail ? <span className="block font-medium text-slate-600">{lastChange.detail}</span> : null}
          </Row>
        </Card>

        <Card title="People">
          <Row label="Members">
            <span className="block tabular-nums">{members.active}</span>
            <span className="block tabular-nums">{members.deactivated}</span>
          </Row>
          <Row label="Active members by role" hint="A member with two roles is counted under each.">
            <ul className="space-y-1">
              {roleCountRows(counts.members.byRole).map((row) => (
                <li key={row.role} className="flex items-baseline justify-between gap-4">
                  <span className="font-medium text-slate-600">{row.label}</span>
                  <span className="tabular-nums">{plainCount(row.count)}</span>
                </li>
              ))}
            </ul>
          </Row>
          <Row label="Teams">
            <span className="block tabular-nums">{teams.active}</span>
            <span className="block tabular-nums">{teams.archived}</span>
          </Row>
        </Card>

        <Card title="Proposals and support">
          <Row label="Proposals stored" hint="Proposals the organization has now. Their titles and content are not shown here.">
            <span className="tabular-nums">{proposalsStoredLabel(counts.proposals.total)}</span>
          </Row>
          <Row label="Support tickets">
            <span className="tabular-nums">{openTicketsLabel(counts.openSupportTickets)}</span>
          </Row>
          <Row label="Support access">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge tone={account.supportAccess.active ? "good" : "neutral"}>
                {supportAccessLabel(account.supportAccess.active)}
              </Badge>
              <Link href={SUPPORT_ACCESS_PATH} className={`text-xs ${linkClass}`}>
                Go to Support access
              </Link>
            </span>
          </Row>
        </Card>

        <Card title="Sign-in and security">
          <Row label="Two-factor authentication">{twoFactorLabel(security.requireTwoFactor)}</Row>
          <Row label="Company single sign-on">{companySsoLabel(security.companySso)}</Row>
          <Row
            label="Sign-in methods offered"
            hint="What members are offered when they sign in. It doesn't show which ones they sign in with."
          >
            {methods.length > 0 ? methods.join(", ") : "Not reported"}
          </Row>
          <Row label="Domains">
            {security.domains.length === 0 ? (
              domainsLabel(0)
            ) : (
              <ul className="space-y-1.5" aria-label={domainsLabel(security.domains.length)}>
                {security.domains.map((row) => {
                  const status = domainStatusBadge(row.status);
                  return (
                    <li key={row.domain} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 break-all">{row.domain}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Row>
          <Row label="Auto-approve by domain">{autoApproveLabel(security.autoApproveDomain)}</Row>
          <Row label="Team Manager invitations">{managerInvitesLabel(security.allowManagerInvites)}</Row>
        </Card>

        <Card title="Activity">
          <Row label="Last sign-in" hint="The most recent sign-in by any member of the organization. It doesn't say who.">
            {lastSignInLabel(account.activity.lastSignInAt)}
          </Row>
        </Card>
      </div>
    </div>
  );
}

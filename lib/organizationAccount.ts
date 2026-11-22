// Organization account detail for RFPilot staff (owner decision, 2026-11-17): the shape of
// GET /api/v1/admin/organizations/:organizationId and the wording the detail page shows.
// This page shows account-level information only: counts, settings and the Owner as account
// contact. Members and customer content are on their own pages (lib/organizationContent), each
// its own recorded read. The backend builds the response as an allowlist; the parser here keeps
// only the fields the page shows, so a field added to the response later does not reach the
// screen by accident.

import { planLabel, type OrganizationPlanItem, type PlanFeatures, type PlanOption, type PlanUsage } from "@/lib/organizationPlans";
import { countLabel } from "@/lib/plural";

export type OrganizationStanding = "awaiting_placement" | "platform" | "active" | "inactive";

export type MemberRoleCounts = {
  owner: number;
  organization_admin: number;
  team_manager: number;
  planner: number;
  viewer: number;
  other: number;
};

export type CompanySso = {
  configured: boolean;
  enabled: boolean;
  required: boolean;
  type: string | null;
};

export type AccountPlanChange = {
  at: string;
  fromPlan: string | null;
  toPlan: string | null;
  changedBy: { id: string; name: string | null } | null;
};

/* `security.signInMethods` is deliberately not kept: the backend sends the same platform-wide
   list for every organization without checking a provider is set up (Microsoft is not), so it
   says nothing about this organization. The card shows organization-specific facts only. */
export type OrganizationAccount = {
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: string | null;
    country: string | null;
    status: string;
    kind: string;
    standing: OrganizationStanding;
    /** Present only while RFPilot staff have the organization blocked (the API sends `blocked: true`
        and `blockedAt` only then; no key means not blocked). `at` is null if the date is unusable. */
    blocked?: { at: string | null };
  };
  /** The account contact, and the only person the page names. */
  owner: { name: string; email: string } | null;
  plan: {
    plan: string;
    exempt: boolean;
    proposals: PlanUsage;
    features: PlanFeatures;
    lastChange: AccountPlanChange | null;
  };
  counts: {
    members: { active: number; deactivated: number; byRole: MemberRoleCounts };
    teams: { active: number; archived: number };
    proposals: { total: number };
    openSupportTickets: number;
  };
  security: {
    requireTwoFactor: boolean;
    companySso: CompanySso;
    domains: Array<{ domain: string; status: string }>;
    autoApproveDomain: boolean;
    allowManagerInvites: boolean;
  };
  activity: { lastSignInAt: string | null };
};

export const ORGANIZATIONS_PATH = "/organizations";

/** The backend refuses anything else with 400 INVALID_ORGANIZATION_ID. */
export const isOrganizationId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);

export const organizationAccountPath = (organizationId: string): string =>
  `${ORGANIZATIONS_PATH}/${encodeURIComponent(organizationId)}`;

/* ---------- reading the response ---------- */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const textOrNull = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

/** A count that arrives as "3" still reads 3; anything that is not a count reads 0. */
const count = (value: unknown): number => {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

const countOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : count(value));

const instant = (value: unknown): string | null => {
  if (typeof value !== "string" || !value) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
};

const STANDINGS: OrganizationStanding[] = ["awaiting_placement", "platform", "active", "inactive"];

/** Null when the response is not an organization account, so the page shows an error instead. */
export const parseOrganizationAccount = (data: unknown): OrganizationAccount | null => {
  const root = record(data);
  const organization = record(root?.organization);
  const plan = record(root?.plan);
  if (!root || !organization || !plan || !isOrganizationId(organization.id)) return null;

  const status = text(organization.status);
  const standing = STANDINGS.includes(organization.standing as OrganizationStanding)
    ? (organization.standing as OrganizationStanding)
    : status === "active"
      ? "active"
      : "inactive";

  const owner = record(root.owner);
  const usage = record(plan.proposals);
  const limit = countOrNull(usage?.limit);
  const created = count(usage?.created);
  const features = record(plan.features);
  const lastChange = record(plan.lastChange);
  const changedBy = record(lastChange?.changedBy);
  const changedAt = instant(lastChange?.at);

  const counts = record(root.counts);
  const members = record(counts?.members);
  const byRole = record(members?.byRole);
  const teams = record(counts?.teams);
  const security = record(root.security);
  const sso = record(security?.companySso);

  return {
    organization: {
      id: organization.id,
      name: text(organization.name),
      slug: text(organization.slug),
      createdAt: instant(organization.createdAt),
      country: textOrNull(organization.country),
      status,
      kind: text(organization.kind),
      standing,
      ...(organization.blocked === true ? { blocked: { at: instant(organization.blockedAt) } } : {}),
    },
    owner: owner && (textOrNull(owner.name) || textOrNull(owner.email)) ? { name: text(owner.name), email: text(owner.email) } : null,
    plan: {
      plan: text(plan.plan),
      exempt: plan.exempt === true,
      proposals: {
        created,
        limit,
        remaining: limit === null ? null : countOrNull(usage?.remaining) ?? Math.max(0, limit - created),
        canCreate: usage?.canCreate !== false,
      },
      features: {
        vendorResponses: features?.vendorResponses === true,
        proposalIntelligence: features?.proposalIntelligence === true,
      },
      lastChange:
        lastChange && changedAt
          ? {
              at: changedAt,
              fromPlan: textOrNull(lastChange.fromPlan),
              toPlan: textOrNull(lastChange.toPlan),
              changedBy: changedBy ? { id: text(changedBy.id), name: textOrNull(changedBy.name) } : null,
            }
          : null,
    },
    counts: {
      members: {
        active: count(members?.active),
        deactivated: count(members?.deactivated),
        byRole: {
          owner: count(byRole?.owner),
          organization_admin: count(byRole?.organization_admin),
          team_manager: count(byRole?.team_manager),
          planner: count(byRole?.planner),
          viewer: count(byRole?.viewer),
          other: count(byRole?.other),
        },
      },
      teams: { active: count(teams?.active), archived: count(teams?.archived) },
      proposals: { total: count(record(counts?.proposals)?.total) },
      openSupportTickets: count(counts?.openSupportTickets),
    },
    security: {
      requireTwoFactor: security?.requireTwoFactor === true,
      companySso: {
        configured: sso?.configured === true,
        enabled: sso?.enabled === true,
        required: sso?.required === true,
        type: textOrNull(sso?.type),
      },
      domains: Array.isArray(security?.domains)
        ? security.domains.flatMap((row) => {
            const domain = record(row);
            return domain && textOrNull(domain.domain) ? [{ domain: text(domain.domain), status: text(domain.status) }] : [];
          })
        : [],
      autoApproveDomain: security?.autoApproveDomain === true,
      allowManagerInvites: security?.allowManagerInvites === true,
    },
    activity: { lastSignInAt: instant(record(root.activity)?.lastSignInAt) },
  };
};

export const organizationName = (name: string): string => name.trim() || "Unnamed organization";

/** The organization as the plan components (usage bar, "Change plan") take it. They put the
    name in labels ("Change plan for …"), so an unnamed organization still gets one. */
export const accountPlanItem = (account: OrganizationAccount): OrganizationPlanItem => ({
  id: account.organization.id,
  name: organizationName(account.organization.name),
  slug: account.organization.slug,
  status: account.organization.status,
  createdAt: account.organization.createdAt,
  plan: account.plan.plan,
  proposals: account.plan.proposals,
  features: account.plan.features,
});

/* ---------- when the page can't show an organization ---------- */

export type OrganizationAccountFailure =
  | "invalid_id"
  | "not_found"
  /** The admin app is ahead of the API: the route itself answers 404 until the backend release. */
  | "not_available"
  | "forbidden"
  | "session_ended"
  | "rate_limited"
  | "unavailable";

/* A missing organization and a missing route are both 404. Only the backend's own code says the
   organization is missing; a 404 without it comes from the API not having the route yet. */
export const organizationAccountFailure = (status: number, code: string | null): OrganizationAccountFailure => {
  if (code === "INVALID_ORGANIZATION_ID") return "invalid_id";
  if (code === "ORGANIZATION_NOT_FOUND") return "not_found";
  if (status === 404) return "not_available";
  if (status === 401) return "session_ended";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  return "unavailable";
};

export const ORGANIZATION_ACCOUNT_FAILURES: Record<OrganizationAccountFailure, { title: string; message: string }> = {
  invalid_id: {
    title: "This link doesn't point to an organization",
    message: "The address is incomplete or mistyped. Open the organization from the Organizations list.",
  },
  not_found: {
    title: "Organization not found",
    message: "This organization doesn't exist, or it has been removed.",
  },
  not_available: {
    title: "Organization details are not available yet",
    message: "They will appear here after the next RFPilot update. Plans and usage are on the Organizations list in the meantime.",
  },
  forbidden: {
    title: "You can't view organization details",
    message: "Only RFPilot staff can view organization details.",
  },
  session_ended: {
    title: "Your session has ended",
    message: "Sign in again to view this organization.",
  },
  rate_limited: {
    title: "Too many organization pages opened",
    message: "Wait a few minutes, then open the organization again.",
  },
  unavailable: {
    title: "Unable to load this organization",
    message: "The server couldn't be reached or didn't answer as expected. Try again in a moment.",
  },
};

export type OrganizationAccountResult =
  | { ok: true; data: OrganizationAccount }
  | { ok: false; failure: OrganizationAccountFailure; error: string };

/* ---------- which backend reads the page makes ---------- */

/** "Change plan" is for an organization the plan table applies to: not one exempt from plans,
    and not a legacy customer still awaiting placement (the plan routes refuse both). */
export const canChangePlan = (account: OrganizationAccount): boolean =>
  !account.plan.exempt && account.organization.standing !== "awaiting_placement";

type PlanTableResult = { ok: true; data: { plans: PlanOption[] } } | { ok: false };

export type OrganizationPageReads = {
  /** The audited read. Asked for exactly once per page view. */
  account(organizationId: string): Promise<OrganizationAccountResult>;
  /** The plan table "Change plan" needs. Not audited, and not customer data. */
  planTable(organizationId: string): Promise<PlanTableResult>;
};

export type OrganizationPageData = {
  account: OrganizationAccountResult;
  /** Null hides "Change plan": nothing to change, or the plan table couldn't be loaded. */
  plans: PlanOption[] | null;
};

/* Everything the detail page asks the backend, in order: the account once, then the plan table
   only when the organization is on screen and its plan can be changed. Nothing else is read. */
export const loadOrganizationPage = async (organizationId: string, reads: OrganizationPageReads): Promise<OrganizationPageData> => {
  const account = await reads.account(organizationId);
  if (!account.ok || !canChangePlan(account.data)) return { account, plans: null };
  const table = await reads.planTable(account.data.organization.id).catch((): PlanTableResult => ({ ok: false }));
  return { account, plans: table.ok && table.data.plans.length > 0 ? table.data.plans : null };
};

/* ---------- wording ---------- */

export type BadgeTone = "good" | "warning" | "danger" | "neutral" | "info";

const STANDING_LABELS: Record<OrganizationStanding, { label: string; tone: BadgeTone; description: string }> = {
  active: { label: "Active", tone: "good", description: "A customer organization in good standing." },
  inactive: { label: "Inactive", tone: "danger", description: "This organization has been deactivated." },
  platform: { label: "RFPilot's own", tone: "info", description: "RFPilot's own organization, where staff accounts live." },
  awaiting_placement: {
    label: "Awaiting placement",
    tone: "warning",
    description: "A customer from before organizations existed, not yet placed in an organization.",
  },
};

export const standingBadge = (standing: OrganizationStanding) => STANDING_LABELS[standing] ?? STANDING_LABELS.inactive;
export const standingLabel = (standing: OrganizationStanding): string => standingBadge(standing).label;

/** The plan badge: an organization outside the plan table says so instead of naming a plan. */
export const accountPlanLabel = (plan: { plan: string; exempt: boolean }): string =>
  plan.exempt ? "Exempt from plans" : planLabel(plan.plan);

const ROLE_LABELS: Array<[keyof MemberRoleCounts, string]> = [
  ["owner", "Owner"],
  ["organization_admin", "Admin"],
  ["team_manager", "Team Manager"],
  ["planner", "Planner"],
  ["viewer", "Viewer"],
];

/** Active members per role, in rank order. "Other role" appears only when someone has one. */
export const roleCountRows = (byRole: MemberRoleCounts): Array<{ role: string; label: string; count: number }> => {
  const rows = ROLE_LABELS.map(([role, label]) => ({ role, label, count: byRole[role] }));
  return byRole.other > 0 ? [...rows, { role: "other", label: "Other role", count: byRole.other }] : rows;
};

export const memberCountLabels = (members: { active: number; deactivated: number }) => ({
  active: countLabel(members.active, "active member"),
  deactivated: countLabel(members.deactivated, "deactivated member"),
});

export const teamCountLabels = (teams: { active: number; archived: number }) => ({
  active: countLabel(teams.active, "active team"),
  archived: countLabel(teams.archived, "archived team"),
});

export const proposalsStoredLabel = (total: number): string => countLabel(total, "proposal");
export const openTicketsLabel = (open: number): string => countLabel(open, "open ticket");

const DOMAIN_STATUSES: Record<string, { label: string; tone: BadgeTone }> = {
  verified: { label: "Verified", tone: "good" },
  pending: { label: "Verification pending", tone: "warning" },
  unverified: { label: "Not verified", tone: "neutral" },
};

const readable = (value: string): string => {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
};

/** A status added on the backend later still reads as words, and never as "verified". */
export const domainStatusBadge = (status: string): { label: string; tone: BadgeTone } =>
  DOMAIN_STATUSES[status] ?? { label: readable(status) || "Unknown status", tone: "neutral" };

export const domainsLabel = (total: number): string => (total === 0 ? "No domains added" : countLabel(total, "domain"));

export const companySsoLabel = (sso: CompanySso): string => {
  if (!sso.configured) return sso.required ? "Not set up (marked as required)" : "Not set up";
  if (!sso.enabled) return "Set up, turned off";
  return sso.required
    ? "On. Members on the organization's domains must sign in with company single sign-on."
    : "On. Members may sign in with company single sign-on.";
};

export const twoFactorLabel = (required: boolean): string => (required ? "Required" : "Not required");
export const autoApproveLabel = (on: boolean): string =>
  on ? "On: people with a verified domain email join without approval" : "Off";
export const managerInvitesLabel = (allowed: boolean): string => (allowed ? "Allowed" : "Not allowed");

/** Counts shown bare ("Owner 1") still use the en-US thousands separator. */
export const plainCount = (value: number): string => value.toLocaleString("en-US");

export const ownerContact = (owner: OrganizationAccount["owner"]): { name: string; email: string | null } =>
  owner
    ? { name: owner.name.trim() || "Name not set", email: owner.email.trim() || null }
    : { name: "No active Owner", email: null };

let regionNames: Intl.DisplayNames | null | undefined;

/** "United States (US)"; the bare code when the runtime can't name it. */
export const countryLabel = (code: string | null): string => {
  const trimmed = (code ?? "").trim().toUpperCase();
  if (!trimmed) return "Not set";
  try {
    if (regionNames === undefined) regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    const name = /^[A-Z]{2}$/.test(trimmed) ? regionNames?.of(trimmed) : undefined;
    return name && name !== trimmed ? `${name} (${trimmed})` : trimmed;
  } catch {
    regionNames = null;
    return trimmed;
  }
};

// The page is rendered on the server, so times are given in UTC and say so, instead of in
// whatever zone the server happens to run in.
export const formatAccountDate = (iso: string | null): string => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not recorded";
  return `${date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} UTC`;
};

export const formatAccountDateTime = (iso: string | null): string | null => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `${day}, ${time} UTC`;
};

export const lastSignInLabel = (lastSignInAt: string | null): string =>
  formatAccountDateTime(lastSignInAt) ?? "No sign-in recorded";

export const lastPlanChangeLabel = (change: AccountPlanChange | null): { line: string; detail: string | null } => {
  if (!change) return { line: "No plan changes yet", detail: null };
  return {
    line: `${planLabel(change.fromPlan)} → ${planLabel(change.toPlan)}`,
    detail: `${formatAccountDateTime(change.at) ?? "Date not recorded"} · ${change.changedBy?.name || "RFPilot staff"}`,
  };
};

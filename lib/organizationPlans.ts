// Plan management (ORG-603): shapes of /api/v1/admin/organization-plans and the wording the
// Organizations page shows. The backend owns the plan table; nothing here decides a limit.

export type PlanFeatures = {
  vendorResponses: boolean;
  proposalIntelligence: boolean;
};

export type PlanOption = {
  id: string;
  /** RFPs an organization may create on this plan; null is no limit. */
  proposalLimit: number | null;
  features: PlanFeatures;
};

export type PlanUsage = {
  created: number;
  limit: number | null;
  remaining: number | null;
  canCreate: boolean;
};

export type OrganizationPlanItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string | null;
  plan: string;
  proposals: PlanUsage;
  features: PlanFeatures;
};

export type PlanChange = {
  at: string;
  fromPlan: string | null;
  toPlan: string | null;
  note: string | null;
  changedBy: { id: string; name: string | null } | null;
};

export type OrganizationPlansPage = {
  organizations: OrganizationPlanItem[];
  plans: PlanOption[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters: { search: string };
};

export type OrganizationPlanDetail = {
  organization: OrganizationPlanItem;
  plans: PlanOption[];
  history: PlanChange[];
  changed?: boolean;
};

export const PLAN_NOTE_MAX_LENGTH = 500;

const PLAN_LABELS: Record<string, string> = {
  free_trial: "Free trial",
  full_access: "Full access",
};

/** A plan added on the backend later still gets a readable name. */
export const planLabel = (plan: string | null | undefined): string => {
  if (!plan) return "Unknown plan";
  if (PLAN_LABELS[plan]) return PLAN_LABELS[plan];
  const words = plan.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown plan";
};

const rfps = (count: number) => `${count.toLocaleString("en-US")} ${count === 1 ? "RFP" : "RFPs"}`;

export const usageLabel = (usage: PlanUsage): string =>
  usage.limit === null
    ? `${rfps(usage.created)} created · no limit`
    : `${usage.created.toLocaleString("en-US")} of ${rfps(usage.limit)} created`;

/** Share of the limit used, 0 to 100; null when the plan has no limit. */
export const usagePercent = (usage: PlanUsage): number | null => {
  if (usage.limit === null) return null;
  if (usage.limit <= 0) return 100;
  return Math.min(100, Math.round((usage.created / usage.limit) * 100));
};

export const planLimitLabel = (plan: PlanOption): string =>
  plan.proposalLimit === null ? "No limit on RFPs" : `Up to ${rfps(plan.proposalLimit)}`;

export const planFeaturesLabel = (features: PlanFeatures): string => {
  if (features.vendorResponses && features.proposalIntelligence) return "Vendor responses and RFP intelligence included";
  if (features.vendorResponses) return "Vendor responses included, RFP intelligence locked";
  if (features.proposalIntelligence) return "RFP intelligence included, vendor responses locked";
  return "Vendor responses and RFP intelligence locked";
};

/* What staff are told before they confirm a change: the effect on this organization, in the
   order it matters. A change that takes something away says what is kept. */
export const planChangeEffects = (organization: OrganizationPlanItem, target: PlanOption): string[] => {
  const effects: string[] = [];
  const { created } = organization.proposals;
  if (target.proposalLimit === null) {
    effects.push("No limit on the number of RFPs.");
  } else if (created >= target.proposalLimit) {
    effects.push(
      `Limited to ${rfps(target.proposalLimit)}. This organization has created ${created.toLocaleString("en-US")}, so it can't create more.`,
    );
  } else {
    effects.push(`Limited to ${rfps(target.proposalLimit)} (${created.toLocaleString("en-US")} created so far).`);
  }
  const features: Array<[keyof PlanFeatures, string]> = [
    ["vendorResponses", "Vendor responses"],
    ["proposalIntelligence", "RFP intelligence"],
  ];
  let losesAccess = false;
  for (const [key, label] of features) {
    const before = organization.features[key];
    const after = target.features[key];
    if (before && !after) losesAccess = true;
    effects.push(
      after
        ? `${label}: ${before ? "stays unlocked" : "unlocked"}.`
        : `${label}: ${before ? "locked" : "stays locked"}.`,
    );
  }
  if (losesAccess) {
    effects.push("Existing RFPs and vendor responses already received are kept. AI jobs already in progress will finish.");
  }
  effects.push("Takes effect right away. Nobody has to sign out.");
  return effects;
};

export const planChangeLine = (change: PlanChange): string =>
  `${planLabel(change.fromPlan)} → ${planLabel(change.toPlan)}`;

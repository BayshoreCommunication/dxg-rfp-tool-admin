import {
  planChangeEffects,
  planChangeLine,
  planFeaturesLabel,
  planLabel,
  planLimitLabel,
  usageLabel,
  usagePercent,
  type OrganizationPlanItem,
  type PlanOption,
} from "./organizationPlans";

const FREE: PlanOption = { id: "free_trial", proposalLimit: 2, features: { vendorResponses: false, proposalIntelligence: false } };
const FULL: PlanOption = { id: "full_access", proposalLimit: null, features: { vendorResponses: true, proposalIntelligence: true } };

const organization = (plan: PlanOption, created: number): OrganizationPlanItem => ({
  id: "a".repeat(24),
  name: "Acme Events",
  slug: "acme-events",
  status: "active",
  createdAt: "2026-11-01T00:00:00.000Z",
  plan: plan.id,
  proposals: {
    created,
    limit: plan.proposalLimit,
    remaining: plan.proposalLimit === null ? null : Math.max(0, plan.proposalLimit - created),
    canCreate: plan.proposalLimit === null || created < plan.proposalLimit,
  },
  features: plan.features,
});

describe("organization plan wording", () => {
  it("names the known plans and stays readable for a plan added later", () => {
    expect(planLabel("free_trial")).toBe("Free trial");
    expect(planLabel("full_access")).toBe("Full access");
    expect(planLabel("team_annual")).toBe("Team annual");
    expect(planLabel(null)).toBe("Unknown plan");
    expect(planChangeLine({ at: "", fromPlan: "free_trial", toPlan: "full_access", note: null, changedBy: null })).toBe("Free trial → Full access");
  });

  it("shows RFPs created against the limit, and says RFP, never proposal", () => {
    expect(usageLabel(organization(FREE, 0).proposals)).toBe("0 of 2 RFPs created");
    expect(usageLabel(organization(FREE, 2).proposals)).toBe("2 of 2 RFPs created");
    expect(usageLabel(organization({ ...FREE, proposalLimit: 1 }, 1).proposals)).toBe("1 of 1 RFP created");
    expect(usageLabel(organization(FULL, 1).proposals)).toBe("1 RFP created · no limit");
    expect(usageLabel(organization(FULL, 1234).proposals)).toBe("1,234 RFPs created · no limit");
    expect(planLimitLabel(FREE)).toBe("Up to 2 RFPs");
    expect(planLimitLabel(FULL)).toBe("No limit on RFPs");
    for (const text of [usageLabel(organization(FREE, 1).proposals), planLimitLabel(FREE), planFeaturesLabel(FREE.features), ...planChangeEffects(organization(FREE, 1), FULL), ...planChangeEffects(organization(FULL, 5), FREE)]) {
      expect(text).not.toMatch(/proposal/i);
    }
  });

  it("gives the share of the limit used, capped at 100, and none without a limit", () => {
    expect(usagePercent(organization(FREE, 0).proposals)).toBe(0);
    expect(usagePercent(organization(FREE, 1).proposals)).toBe(50);
    expect(usagePercent(organization(FREE, 5).proposals)).toBe(100);
    expect(usagePercent(organization({ ...FREE, proposalLimit: 0 }, 0).proposals)).toBe(100);
    expect(usagePercent(organization(FULL, 9).proposals)).toBeNull();
  });

  it("describes plan features", () => {
    expect(planFeaturesLabel(FULL.features)).toBe("Vendor responses and RFP intelligence included");
    expect(planFeaturesLabel(FREE.features)).toBe("Vendor responses and RFP intelligence locked");
    expect(planFeaturesLabel({ vendorResponses: true, proposalIntelligence: false })).toBe("Vendor responses included, RFP intelligence locked");
  });

  it("tells staff what an upgrade unlocks", () => {
    expect(planChangeEffects(organization(FREE, 2), FULL)).toEqual([
      "No limit on the number of RFPs.",
      "Vendor responses: unlocked.",
      "RFP intelligence: unlocked.",
      "Takes effect right away. Nobody has to sign out.",
    ]);
  });

  it("tells staff what a downgrade locks and what is kept", () => {
    expect(planChangeEffects(organization(FULL, 5), FREE)).toEqual([
      "Limited to 2 RFPs. This organization has created 5, so it can't create more.",
      "Vendor responses: locked.",
      "RFP intelligence: locked.",
      "Existing RFPs and vendor responses already received are kept. AI jobs already in progress will finish.",
      "Takes effect right away. Nobody has to sign out.",
    ]);
    expect(planChangeEffects(organization(FULL, 1), FREE)[0]).toBe("Limited to 2 RFPs (1 created so far).");
  });
});

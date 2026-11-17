import {
  ORGANIZATION_ACCOUNT_FAILURES,
  accountPlanItem,
  accountPlanLabel,
  autoApproveLabel,
  companySsoLabel,
  countryLabel,
  domainStatusBadge,
  domainsLabel,
  formatAccountDate,
  canChangePlan,
  isOrganizationId,
  lastPlanChangeLabel,
  lastSignInLabel,
  loadOrganizationPage,
  managerInvitesLabel,
  memberCountLabels,
  openTicketsLabel,
  organizationAccountFailure,
  organizationAccountPath,
  ownerContact,
  parseOrganizationAccount,
  proposalsStoredLabel,
  roleCountRows,
  standingBadge,
  standingLabel,
  supportAccessLabel,
  teamCountLabels,
  twoFactorLabel,
  type OrganizationAccountFailure,
  type OrganizationAccountResult,
} from "./organizationAccount";

const ORG = "a".repeat(24);

// The response as backend PR #139 documents it (docs/API.md, "Organization account detail").
const response = () => ({
  organization: {
    id: ORG,
    name: "Acme Events",
    slug: "acme-events",
    createdAt: "2026-03-04T10:00:00.000Z",
    country: "US",
    status: "active",
    kind: "customer",
    standing: "active",
  },
  owner: { name: "Dana Whitfield", email: "dana@acme.example" },
  plan: {
    plan: "free_trial",
    exempt: false,
    proposals: { created: 2, limit: 2, remaining: 0, canCreate: false },
    features: { vendorResponses: false, proposalIntelligence: false },
    lastChange: {
      at: "2026-11-10T15:30:00.000Z",
      fromPlan: "full_access",
      toPlan: "free_trial",
      changedBy: { id: "b".repeat(24), name: "Sam Staff" },
    },
  },
  counts: {
    members: { active: 7, deactivated: 1, byRole: { owner: 1, organization_admin: 2, team_manager: 1, planner: 3, viewer: 1, other: 0 } },
    teams: { active: 2, archived: 1 },
    proposals: { total: 1 },
    openSupportTickets: 1,
  },
  security: {
    requireTwoFactor: true,
    companySso: { configured: true, enabled: true, required: false, type: "oidc" },
    domains: [
      { domain: "acme.example", status: "verified" },
      { domain: "acme-events.example", status: "pending" },
    ],
    autoApproveDomain: true,
    allowManagerInvites: false,
  },
  activity: { lastSignInAt: "2026-11-16T08:05:00.000Z" },
  supportAccess: { active: true },
});

describe("reading the organization account response", () => {
  it("keeps every documented field", () => {
    expect(parseOrganizationAccount(response())).toEqual(response());
  });

  it("drops anything the page has no field for", () => {
    const withExtras = {
      ...response(),
      members: [{ name: "Someone Else", email: "someone@acme.example" }],
      owner: { name: "Dana Whitfield", email: "dana@acme.example", id: "c".repeat(24), phone: "555-0100" },
      plan: { ...response().plan, lastChange: { ...response().plan.lastChange, note: "Paid by invoice" } },
      supportAccess: { active: true, reason: "Ticket 4411", expiresAt: "2026-12-01T00:00:00.000Z" },
      // The same platform-wide list for every organization: not a fact about this one.
      security: { ...response().security, signInMethods: ["password", "google", "microsoft", "company_sso"] },
    };
    const parsed = parseOrganizationAccount(withExtras);
    expect(parsed).toEqual(response());
    expect(JSON.stringify(parsed)).not.toMatch(/Someone Else|555-0100|Paid by invoice|Ticket 4411|signInMethods|microsoft/i);
  });

  it("refuses a response that is not an organization", () => {
    expect(parseOrganizationAccount(null)).toBeNull();
    expect(parseOrganizationAccount([])).toBeNull();
    expect(parseOrganizationAccount({ organization: { id: "not-an-id" }, plan: {} })).toBeNull();
    expect(parseOrganizationAccount({ organization: { id: ORG } })).toBeNull();
  });

  it("reads a sparse response as zeros, nulls and off, never as undefined", () => {
    const parsed = parseOrganizationAccount({ organization: { id: ORG, status: "inactive" }, plan: { plan: "full_access", proposals: { created: "3", limit: null } } });
    expect(parsed).toMatchObject({
      organization: { name: "", createdAt: null, country: null, standing: "inactive" },
      owner: null,
      plan: { exempt: false, proposals: { created: 3, limit: null, remaining: null, canCreate: true }, lastChange: null },
      counts: {
        members: { active: 0, deactivated: 0, byRole: { owner: 0, organization_admin: 0, team_manager: 0, planner: 0, viewer: 0, other: 0 } },
        teams: { active: 0, archived: 0 },
        proposals: { total: 0 },
        openSupportTickets: 0,
      },
      security: { requireTwoFactor: false, domains: [], companySso: { configured: false, enabled: false, required: false, type: null } },
      activity: { lastSignInAt: null },
      supportAccess: { active: false },
    });
  });

  it("accepts only a 24-character hex id and keeps an id from changing the path", () => {
    expect(isOrganizationId(ORG)).toBe(true);
    expect(isOrganizationId("abc")).toBe(false);
    expect(isOrganizationId(`${ORG}/../x`)).toBe(false);
    expect(isOrganizationId(undefined)).toBe(false);
    expect(organizationAccountPath(ORG)).toBe(`/organizations/${ORG}`);
    expect(organizationAccountPath("a/b?c")).toBe("/organizations/a%2Fb%3Fc");
  });
});

describe("which backend reads the detail page makes", () => {
  const PLANS = [
    { id: "free_trial", proposalLimit: 2, features: { vendorResponses: false, proposalIntelligence: false } },
    { id: "full_access", proposalLimit: null, features: { vendorResponses: true, proposalIntelligence: true } },
  ];
  const accountWith = (change: (raw: ReturnType<typeof response>) => void = () => {}) => {
    const raw = response();
    change(raw);
    return parseOrganizationAccount(raw)!;
  };
  const reads = (account: OrganizationAccountResult, table: unknown = { ok: true, data: { plans: PLANS } }) => ({
    account: jest.fn(async () => account),
    planTable: jest.fn(async () => table as { ok: true; data: { plans: typeof PLANS } } | { ok: false }),
  });

  it("reads the account once, then the plan table for an organization whose plan can change", async () => {
    const account = accountWith();
    const calls = reads({ ok: true, data: account });
    await expect(loadOrganizationPage(ORG, calls)).resolves.toEqual({ account: { ok: true, data: account }, plans: PLANS });
    expect(calls.account).toHaveBeenCalledTimes(1);
    expect(calls.account).toHaveBeenCalledWith(ORG);
    expect(calls.planTable).toHaveBeenCalledTimes(1);
    expect(calls.planTable).toHaveBeenCalledWith(ORG);
  });

  it("skips the plan table when the organization is exempt from plans or awaiting placement", async () => {
    const exempt = accountWith((raw) => { raw.plan.exempt = true; });
    const awaiting = accountWith((raw) => { raw.organization.standing = "awaiting_placement"; raw.organization.kind = "legacy_holding"; });
    expect(canChangePlan(accountWith())).toBe(true);
    expect(canChangePlan(exempt)).toBe(false);
    expect(canChangePlan(awaiting)).toBe(false);
    for (const account of [exempt, awaiting]) {
      const calls = reads({ ok: true, data: account });
      await expect(loadOrganizationPage(ORG, calls)).resolves.toEqual({ account: { ok: true, data: account }, plans: null });
      expect(calls.account).toHaveBeenCalledTimes(1);
      expect(calls.planTable).not.toHaveBeenCalled();
    }
  });

  it("still offers Change plan for an inactive organization and for RFPilot's own", async () => {
    for (const standing of ["inactive", "platform"]) {
      const calls = reads({ ok: true, data: accountWith((raw) => { raw.organization.standing = standing; }) });
      await expect(loadOrganizationPage(ORG, calls)).resolves.toMatchObject({ plans: PLANS });
    }
  });

  it("makes no second read when the account can't be shown", async () => {
    const refused: OrganizationAccountResult = { ok: false, failure: "not_available", error: "Not yet." };
    const calls = reads(refused);
    await expect(loadOrganizationPage(ORG, calls)).resolves.toEqual({ account: refused, plans: null });
    expect(calls.account).toHaveBeenCalledTimes(1);
    expect(calls.planTable).not.toHaveBeenCalled();
  });

  it("hides Change plan, and keeps the page, when the plan table can't be loaded", async () => {
    const account = accountWith();
    const failed = reads({ ok: true, data: account }, { ok: false, error: "Organization not found." });
    await expect(loadOrganizationPage(ORG, failed)).resolves.toEqual({ account: { ok: true, data: account }, plans: null });

    const empty = reads({ ok: true, data: account }, { ok: true, data: { plans: [] } });
    await expect(loadOrganizationPage(ORG, empty)).resolves.toMatchObject({ account: { ok: true }, plans: null });

    const thrown = reads({ ok: true, data: account });
    thrown.planTable.mockRejectedValue(new Error("boom"));
    await expect(loadOrganizationPage(ORG, thrown)).resolves.toEqual({ account: { ok: true, data: account }, plans: null });
    expect(thrown.account).toHaveBeenCalledTimes(1);
  });
});

describe("why the page can't show an organization", () => {
  it("tells a missing organization from a route the API does not have yet", () => {
    expect(organizationAccountFailure(404, "ORGANIZATION_NOT_FOUND")).toBe("not_found");
    expect(organizationAccountFailure(404, null)).toBe("not_available");
    expect(organizationAccountFailure(404, "SOMETHING_ELSE")).toBe("not_available");
  });

  it("maps each refusal to its own state", () => {
    expect(organizationAccountFailure(400, "INVALID_ORGANIZATION_ID")).toBe("invalid_id");
    expect(organizationAccountFailure(401, null)).toBe("session_ended");
    expect(organizationAccountFailure(403, "PLAN_MANAGEMENT_FORBIDDEN")).toBe("forbidden");
    expect(organizationAccountFailure(403, null)).toBe("forbidden");
    expect(organizationAccountFailure(429, null)).toBe("rate_limited");
    expect(organizationAccountFailure(500, "PLAN_MANAGEMENT_INTERNAL_ERROR")).toBe("unavailable");
    expect(organizationAccountFailure(502, null)).toBe("unavailable");
    expect(organizationAccountFailure(400, null)).toBe("unavailable");
  });

  it("words every state for a person: no error code on screen", () => {
    const failures = Object.keys(ORGANIZATION_ACCOUNT_FAILURES) as OrganizationAccountFailure[];
    expect(failures.sort()).toEqual(["forbidden", "invalid_id", "not_available", "not_found", "rate_limited", "session_ended", "unavailable"]);
    for (const failure of failures) {
      const { title, message } = ORGANIZATION_ACCOUNT_FAILURES[failure];
      expect(`${title} ${message}`).not.toMatch(/[A-Z]{2,}_[A-Z_]+|\b[45]\d\d\b/);
    }
    expect(ORGANIZATION_ACCOUNT_FAILURES.not_available.title).toBe("Organization details are not available yet");
    expect(ORGANIZATION_ACCOUNT_FAILURES.not_available.title).not.toMatch(/not found/i);
  });
});

describe("organization account wording", () => {
  it("labels each standing", () => {
    expect(standingLabel("active")).toBe("Active");
    expect(standingLabel("inactive")).toBe("Inactive");
    expect(standingLabel("platform")).toBe("RFPilot's own");
    expect(standingLabel("awaiting_placement")).toBe("Awaiting placement");
    expect(standingBadge("awaiting_placement").description).toMatch(/not yet placed in an organization/);
    expect(standingBadge("inactive").tone).toBe("danger");
  });

  it("names the plan, or says the organization is outside the plan table", () => {
    expect(accountPlanLabel({ plan: "free_trial", exempt: false })).toBe("Free trial");
    expect(accountPlanLabel({ plan: "full_access", exempt: true })).toBe("Exempt from plans");
  });

  it("hands the plan components a name even when the organization has none", () => {
    const named = parseOrganizationAccount(response())!;
    expect(accountPlanItem(named)).toEqual({
      id: ORG,
      name: "Acme Events",
      slug: "acme-events",
      status: "active",
      createdAt: "2026-03-04T10:00:00.000Z",
      plan: "free_trial",
      proposals: { created: 2, limit: 2, remaining: 0, canCreate: false },
      features: { vendorResponses: false, proposalIntelligence: false },
    });
    const unnamed = parseOrganizationAccount({ ...response(), organization: { ...response().organization, name: "  " } })!;
    expect(accountPlanItem(unnamed).name).toBe("Unnamed organization");
  });

  it("lists role counts with the role names staff know, and Other only when used", () => {
    const byRole = { owner: 1, organization_admin: 2, team_manager: 0, planner: 1234, viewer: 1, other: 0 };
    expect(roleCountRows(byRole).map((row) => [row.label, row.count])).toEqual([
      ["Owner", 1],
      ["Admin", 2],
      ["Team Manager", 0],
      ["Planner", 1234],
      ["Viewer", 1],
    ]);
    expect(roleCountRows({ ...byRole, other: 2 }).at(-1)).toEqual({ role: "other", label: "Other role", count: 2 });
  });

  it("gives every count the right number, zero included", () => {
    expect(memberCountLabels({ active: 0, deactivated: 0 })).toEqual({ active: "0 active members", deactivated: "0 deactivated members" });
    expect(memberCountLabels({ active: 1, deactivated: 1 })).toEqual({ active: "1 active member", deactivated: "1 deactivated member" });
    expect(teamCountLabels({ active: 0, archived: 1 })).toEqual({ active: "0 active teams", archived: "1 archived team" });
    expect(teamCountLabels({ active: 1, archived: 2 })).toEqual({ active: "1 active team", archived: "2 archived teams" });
    expect(proposalsStoredLabel(0)).toBe("0 proposals");
    expect(proposalsStoredLabel(1)).toBe("1 proposal");
    expect(proposalsStoredLabel(1234)).toBe("1,234 proposals");
    expect(openTicketsLabel(0)).toBe("0 open tickets");
    expect(openTicketsLabel(1)).toBe("1 open ticket");
    expect(domainsLabel(0)).toBe("No domains added");
    expect(domainsLabel(1)).toBe("1 domain");
    expect(domainsLabel(2)).toBe("2 domains");
  });

  it("labels domain statuses, and never calls an unknown one verified", () => {
    expect(domainStatusBadge("verified")).toEqual({ label: "Verified", tone: "good" });
    expect(domainStatusBadge("pending")).toEqual({ label: "Verification pending", tone: "warning" });
    expect(domainStatusBadge("unverified")).toEqual({ label: "Not verified", tone: "neutral" });
    expect(domainStatusBadge("on_hold")).toEqual({ label: "On hold", tone: "neutral" });
    expect(domainStatusBadge("")).toEqual({ label: "Unknown status", tone: "neutral" });
  });

  it("describes company single sign-on in each state", () => {
    expect(companySsoLabel({ configured: false, enabled: false, required: false, type: null })).toBe("Not set up");
    expect(companySsoLabel({ configured: false, enabled: false, required: true, type: null })).toBe("Not set up (marked as required)");
    expect(companySsoLabel({ configured: true, enabled: false, required: false, type: "oidc" })).toBe("Set up, turned off");
    expect(companySsoLabel({ configured: true, enabled: true, required: false, type: "oidc" })).toBe(
      "On. Members may sign in with company single sign-on.",
    );
    expect(companySsoLabel({ configured: true, enabled: true, required: true, type: "oidc" })).toBe(
      "On. Members on the organization's domains must sign in with company single sign-on.",
    );
  });

  it("words the settings and support access", () => {
    expect(twoFactorLabel(true)).toBe("Required");
    expect(twoFactorLabel(false)).toBe("Not required");
    expect(autoApproveLabel(false)).toBe("Off");
    expect(autoApproveLabel(true)).toMatch(/^On: /);
    expect(managerInvitesLabel(true)).toBe("Allowed");
    expect(managerInvitesLabel(false)).toBe("Not allowed");
    expect(supportAccessLabel(true)).toBe("Active");
    expect(supportAccessLabel(false)).toBe("None");
  });

  it("shows the Owner as the account contact, and says when there is none", () => {
    expect(ownerContact({ name: "Dana Whitfield", email: "dana@acme.example" })).toEqual({ name: "Dana Whitfield", email: "dana@acme.example" });
    expect(ownerContact({ name: " ", email: "dana@acme.example" })).toEqual({ name: "Name not set", email: "dana@acme.example" });
    expect(ownerContact(null)).toEqual({ name: "No active Owner", email: null });
  });

  it("gives dates and times in UTC, and says when there is none", () => {
    expect(formatAccountDate("2026-03-04T23:30:00.000Z")).toBe("Mar 4, 2026 UTC");
    expect(formatAccountDate("2026-03-04T00:30:00.000Z")).toBe("Mar 4, 2026 UTC");
    expect(formatAccountDate(null)).toBe("Not recorded");
    expect(formatAccountDate("nonsense")).toBe("Not recorded");
    expect(lastSignInLabel("2026-11-16T08:05:00.000Z")).toBe("Nov 16, 2026, 8:05 AM UTC");
    expect(lastSignInLabel(null)).toBe("No sign-in recorded");
    expect(lastSignInLabel("nonsense")).toBe("No sign-in recorded");
  });

  it("names the country, or shows the code it was given", () => {
    expect(countryLabel("US")).toBe("United States (US)");
    expect(countryLabel("bd")).toBe("Bangladesh (BD)");
    expect(countryLabel("Atlantis")).toBe("ATLANTIS");
    expect(countryLabel(null)).toBe("Not set");
    expect(countryLabel("  ")).toBe("Not set");
  });

  it("summarizes the last plan change without its note", () => {
    expect(lastPlanChangeLabel(null)).toEqual({ line: "No plan changes yet", detail: null });
    expect(
      lastPlanChangeLabel({ at: "2026-11-10T15:30:00.000Z", fromPlan: "free_trial", toPlan: "full_access", changedBy: { id: "b".repeat(24), name: "Sam Staff" } }),
    ).toEqual({ line: "Free trial → Full access", detail: "Nov 10, 2026, 3:30 PM UTC · Sam Staff" });
    expect(lastPlanChangeLabel({ at: "2026-11-10T15:30:00.000Z", fromPlan: null, toPlan: "full_access", changedBy: null }).detail).toBe(
      "Nov 10, 2026, 3:30 PM UTC · RFPilot staff",
    );
  });
});

import {
  CONTENT_SECTIONS,
  contentFailure,
  contentFailureCopy,
  isContentId,
  listQueryOf,
  loadMembersPage,
  loadProposalPage,
  loadProposalsPage,
  loadTeamsPage,
  loadTemplatePage,
  loadTemplatesPage,
  loadVendorResponsesPage,
  loadVendorsPage,
  memberStatusBadge,
  organizationMembersPath,
  organizationProposalPath,
  organizationProposalsPath,
  organizationSectionPath,
  organizationTeamsPath,
  organizationTemplatePath,
  organizationTemplatesPath,
  organizationVendorResponsesPath,
  organizationVendorsPath,
  pageOf,
  pageRange,
  parseMembersPage,
  parseProposalDetail,
  parseProposalsPage,
  parseTeams,
  parseTemplateDetail,
  parseTemplatesPage,
  parseVendorResponses,
  parseVendorsPage,
  roleLabel,
  rolesLabel,
  searchOf,
  supportAccessRedirect,
  templateScopeLabel,
  templatesQueryOf,
  vendorsQueryOf,
  withQuery,
  type ContentFailure,
  type ContentKind,
  type ContentReads,
} from "./content";

const ORG = "6a0000000000000000000001";
const OTHER_ORG = "6a0000000000000000000099";
const PROPOSAL = "6b0000000000000000000002";
const TEMPLATE = "6d0000000000000000000004";

describe("ids and addresses", () => {
  it("accepts only lower-case 24-character hex ids, as the backend does", () => {
    expect(isContentId(ORG)).toBe(true);
    expect(isContentId(ORG.toUpperCase())).toBe(false);
    expect(isContentId("6a00")).toBe(false);
    expect(isContentId(`${ORG}/../x`)).toBe(false);
    expect(isContentId(`${ORG}?x=1`)).toBe(false);
    expect(isContentId(undefined)).toBe(false);
    expect(isContentId(123)).toBe(false);
  });

  it("gives each section its own address under the organization", () => {
    expect(CONTENT_SECTIONS).toEqual(["proposals", "members", "teams", "templates", "vendors"]);
    expect(organizationProposalsPath(ORG)).toBe(`/organizations/${ORG}/proposals`);
    expect(organizationProposalPath(ORG, PROPOSAL)).toBe(`/organizations/${ORG}/proposals/${PROPOSAL}`);
    expect(organizationVendorResponsesPath(ORG, PROPOSAL)).toBe(`/organizations/${ORG}/proposals/${PROPOSAL}/vendor-responses`);
    expect(organizationMembersPath(ORG)).toBe(`/organizations/${ORG}/members`);
    expect(organizationTeamsPath(ORG)).toBe(`/organizations/${ORG}/teams`);
    expect(organizationTemplatesPath(ORG)).toBe(`/organizations/${ORG}/templates`);
    expect(organizationTemplatePath(ORG, TEMPLATE)).toBe(`/organizations/${ORG}/templates/${TEMPLATE}`);
    expect(organizationVendorsPath(ORG)).toBe(`/organizations/${ORG}/vendors`);
    // An id can never change the path it is put in.
    expect(organizationSectionPath("a/b?c", "members")).toBe("/organizations/a%2Fb%3Fc/members");
    expect(organizationProposalPath(ORG, "../x")).toBe(`/organizations/${ORG}/proposals/..%2Fx`);
  });

  it("builds list addresses with only what is set", () => {
    expect(withQuery("/x", { search: "", page: 1 })).toBe("/x");
    expect(withQuery("/x", { search: "spring summit", page: 3, status: undefined })).toBe("/x?search=spring+summit&page=3");
  });

  it("reads the page, search and filters from the address bar, never trusting them", () => {
    expect(pageOf("3")).toBe(3);
    expect(pageOf(" 12 ")).toBe(12);
    for (const value of ["0", "-1", "1.5", "abc", "", "1e3", "999999", undefined, null, ["2"]]) expect(pageOf(value)).toBe(1);
    expect(searchOf("  summit ")).toBe("summit");
    expect(searchOf("x".repeat(300))).toHaveLength(200);
    expect(searchOf(["a"])).toBe("");
    expect(listQueryOf({ page: ["2", "3"], search: ["a", "b"] })).toEqual({ page: 1, search: "" });
    expect(listQueryOf(undefined)).toEqual({ page: 1, search: "" });
    expect(templatesQueryOf({ page: "2", search: "kick", scope: "personal", status: "archived" })).toEqual({ page: 2, search: "kick", scope: "personal", status: "archived" });
    // A filter value outside its list is never sent on: the backend would answer 400.
    expect(templatesQueryOf({ scope: "everyone", status: "deleted" })).toEqual({ page: 1, search: "", scope: "all", status: "all" });
    expect(vendorsQueryOf({ status: "active", category: "audio" })).toEqual({ page: 1, search: "", status: "active" });
  });
});

describe("reading the responses", () => {
  const owner = { id: "u1", name: "Pat Planner", email: "pat@acme.example", passwordHash: "x" };

  it("reads a proposal list for the organization asked for, and nothing else", () => {
    const rfps = [
      { id: PROPOSAL, eventName: "Annual Summit", status: "submitted", stage: "sent", isDraft: false, isArchived: false, startDate: "2026-12-01", endDate: null, createdAt: null, updatedAt: null, owner, proposalSettings: { secret: 1 } },
      { id: "bad id", eventName: "Skipped" },
    ];
    const page = parseProposalsPage({ organizationId: ORG, rfps, pagination: { page: 2, perPage: 20, total: 21, totalPages: 2 } }, ORG);
    expect(page).toEqual({
      rfps: [{ id: PROPOSAL, eventName: "Annual Summit", status: "submitted", stage: "sent", isDraft: false, isArchived: false, startDate: "2026-12-01", endDate: null, createdAt: null, updatedAt: null, owner: { id: "u1", name: "Pat Planner", email: "pat@acme.example" } }],
      pagination: { page: 2, perPage: 20, total: 21, totalPages: 2 },
    });
    expect(parseProposalsPage({ organizationId: OTHER_ORG, rfps, pagination: {} }, ORG)).toBeNull();
    expect(parseProposalsPage({ rfps }, ORG)).toBeNull();
    expect(parseProposalsPage({ organizationId: ORG }, ORG)).toBeNull();
    expect(parseProposalsPage(null, ORG)).toBeNull();
    expect(parseProposalsPage({ organizationId: ORG, rfps: [] }, ORG)).toEqual({ rfps: [], pagination: { page: 1, perPage: 1, total: 0, totalPages: 1 } });
  });

  it("shows only the proposal asked for, in the organization asked for", () => {
    expect(parseProposalDetail({ organizationId: ORG, rfp: { id: PROPOSAL, event: { eventName: "Summit" } }, owner }, ORG, PROPOSAL)).toEqual({
      rfp: { id: PROPOSAL, event: { eventName: "Summit" } },
      owner: { id: "u1", name: "Pat Planner", email: "pat@acme.example" },
    });
    expect(parseProposalDetail({ organizationId: ORG, rfp: { id: "6b0000000000000000000009" }, owner: null }, ORG, PROPOSAL)).toBeNull();
    expect(parseProposalDetail({ organizationId: OTHER_ORG, rfp: { id: PROPOSAL }, owner: null }, ORG, PROPOSAL)).toBeNull();
    expect(parseProposalDetail({ organizationId: ORG, owner: null }, ORG, PROPOSAL)).toBeNull();
  });

  it("keeps a vendor response's document count and never its documents", () => {
    const parsed = parseVendorResponses(
      { organizationId: ORG, proposalId: PROPOSAL, vendorResponses: [{ id: "v1", vendorName: "Stagecraft AV", documentCount: 2, currentVersionNumber: 1, documents: [{ url: "https://files.example/x" }] }, null] },
      ORG,
      PROPOSAL,
    );
    expect(parsed).toEqual({
      vendorResponses: [{ id: "v1", vendorName: "Stagecraft AV", submittedBy: null, email: null, message: null, documentCount: 2, currentVersionNumber: 1, createdAt: null, updatedAt: null }],
    });
    expect(JSON.stringify(parsed)).not.toContain("files.example");
    expect(parseVendorResponses({ organizationId: ORG, proposalId: "6b0000000000000000000009", vendorResponses: [] }, ORG, PROPOSAL)).toBeNull();
    expect(parseVendorResponses({ organizationId: ORG, proposalId: PROPOSAL }, ORG, PROPOSAL)).toBeNull();
  });

  it("reads members and pending invitations, dropping everything it has no field for", () => {
    const parsed = parseMembersPage(
      {
        organizationId: ORG,
        members: [
          { userId: "u1", name: "Pat Planner", email: "pat@acme.example", roles: ["owner", 7, ""], status: "active", teams: [{ id: "t1", name: "East", archived: false, isManager: true }, { name: "no id" }], joinedAt: "2026-01-02T00:00:00.000Z", lastSignedInAt: "nonsense", twoFactorSecret: "s3cret", googleId: "g-1" },
          { name: "No id" },
        ],
        pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 },
        pendingInvitations: [{ id: "i1", email: "new@acme.example", role: "planner", status: "pending", expiresAt: "2026-12-01T00:00:00.000Z", createdAt: null, token: "tok", tokenHash: "hash" }, { id: "i2" }],
        pendingInvitationsTotal: 4,
      },
      ORG,
    );
    expect(parsed).toEqual({
      members: [{ userId: "u1", name: "Pat Planner", email: "pat@acme.example", roles: ["owner"], status: "active", teams: [{ id: "t1", name: "East", archived: false, isManager: true }], joinedAt: "2026-01-02T00:00:00.000Z", lastSignedInAt: null }],
      pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 },
      pendingInvitations: [{ id: "i1", email: "new@acme.example", role: "planner", status: "pending", expiresAt: "2026-12-01T00:00:00.000Z", createdAt: null }],
      pendingInvitationsTotal: 4,
    });
    expect(JSON.stringify(parsed)).not.toMatch(/s3cret|g-1|tok|hash/);
    expect(parseMembersPage({ organizationId: OTHER_ORG, members: [] }, ORG)).toBeNull();
    expect(parseMembersPage({ organizationId: ORG }, ORG)).toBeNull();
  });

  it("reads teams with their managers", () => {
    expect(
      parseTeams({ organizationId: ORG, teams: [{ id: "t1", name: "East", archived: true, archivedAt: "2026-05-01T00:00:00.000Z", createdAt: null, memberCount: 3, managers: [{ id: "u1", name: "Pat", email: null }, "x"] }, {}] }, ORG),
    ).toEqual({ teams: [{ id: "t1", name: "East", archived: true, archivedAt: "2026-05-01T00:00:00.000Z", createdAt: null, memberCount: 3, managers: [{ id: "u1", name: "Pat", email: null }] }] });
    expect(parseTeams({ organizationId: ORG }, ORG)).toBeNull();
    expect(parseTeams({ organizationId: OTHER_ORG, teams: [] }, ORG)).toBeNull();
  });

  it("reads templates, and a template only when it is the one asked for", () => {
    const summary = { id: TEMPLATE, scope: "personal", title: "Kick-off", description: "", eventName: "Summit", presentationLayout: null, publishedAt: null, archived: false, archivedAt: null, createdAt: "2026-02-01T00:00:00.000Z", updatedAt: null, owner };
    const expected = { ...summary, description: null, owner: { id: "u1", name: "Pat Planner", email: "pat@acme.example" } };
    expect(parseTemplatesPage({ organizationId: ORG, templates: [summary, { id: "nope" }], pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 } }, ORG)).toEqual({
      templates: [expected],
      pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });
    expect(parseTemplateDetail({ organizationId: ORG, template: { ...summary, content: { event: { eventName: "Summit" } } } }, ORG, TEMPLATE)).toEqual({
      template: { ...expected, content: { event: { eventName: "Summit" } } },
    });
    expect(parseTemplateDetail({ organizationId: ORG, template: { ...summary, content: "text" } }, ORG, TEMPLATE)?.template.content).toEqual({});
    expect(parseTemplateDetail({ organizationId: ORG, template: summary }, ORG, "6d0000000000000000000009")).toBeNull();
    expect(parseTemplateDetail({ organizationId: OTHER_ORG, template: summary }, ORG, TEMPLATE)).toBeNull();
    expect(parseTemplatesPage({ organizationId: ORG }, ORG)).toBeNull();
  });

  it("reads the vendor list", () => {
    expect(
      parseVendorsPage({ organizationId: ORG, vendors: [{ id: "v1", company: "Stage Audio", category: "", contacts: [{ name: "Sam", email: "sam@stage.example" }, {}], addedBy: "u1", archived: false, archivedAt: null, createdAt: null, updatedAt: null }], pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 } }, ORG),
    ).toEqual({
      vendors: [{ id: "v1", company: "Stage Audio", category: null, contacts: [{ name: "Sam", email: "sam@stage.example" }], archived: false, archivedAt: null, createdAt: null, updatedAt: null }],
      pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    });
    expect(parseVendorsPage({ organizationId: ORG }, ORG)).toBeNull();
  });
});

describe("why a page can't show its content", () => {
  it("tells a missing organization and a missing record from a route the API does not have yet", () => {
    expect(contentFailure(404, "ORGANIZATION_NOT_FOUND")).toBe("organization_not_found");
    expect(contentFailure(404, "PROPOSAL_NOT_FOUND")).toBe("record_not_found");
    expect(contentFailure(404, "TEMPLATE_NOT_FOUND")).toBe("record_not_found");
    expect(contentFailure(404, null)).toBe("not_available");
    expect(contentFailure(404, "SOMETHING_ELSE")).toBe("not_available");
  });

  it("maps each refusal to its own state", () => {
    expect(contentFailure(400, "INVALID_ORGANIZATION_ID")).toBe("invalid_id");
    expect(contentFailure(400, "INVALID_PROPOSAL_ID")).toBe("record_not_found");
    expect(contentFailure(400, "INVALID_TEMPLATE_ID")).toBe("record_not_found");
    expect(contentFailure(400, "INVALID_FILTER")).toBe("unavailable");
    expect(contentFailure(401, null)).toBe("session_ended");
    expect(contentFailure(401, "AUTHENTICATION_REQUIRED")).toBe("session_ended");
    expect(contentFailure(403, "STAFF_ACCESS_FORBIDDEN")).toBe("forbidden");
    expect(contentFailure(403, null)).toBe("forbidden");
    expect(contentFailure(429, null)).toBe("rate_limited");
    expect(contentFailure(500, "STAFF_ACCESS_INTERNAL_ERROR")).toBe("unavailable");
    expect(contentFailure(502, null)).toBe("unavailable");
  });

  it("words every state of every page for a person: no error code, no grant", () => {
    const failures: ContentFailure[] = ["invalid_id", "organization_not_found", "record_not_found", "not_available", "forbidden", "session_ended", "rate_limited", "unavailable"];
    const kinds: ContentKind[] = ["proposals", "proposal", "vendor_responses", "members", "teams", "templates", "template", "vendors"];
    for (const failure of failures) {
      for (const kind of kinds) {
        const { title, message } = contentFailureCopy(failure, kind);
        expect(title).toBeTruthy();
        expect(message).toBeTruthy();
        expect(`${title} ${message}`).not.toMatch(/[A-Z]{2,}_[A-Z_]+|\b[45]\d\d\b|grant|permission/i);
      }
    }
    expect(contentFailureCopy("not_available", "members")).toEqual({ title: "Not available yet", message: "Staff can view this organization's members here after the next RFPilot update." });
    expect(contentFailureCopy("not_available", "members").title).not.toMatch(/not found/i);
    expect(contentFailureCopy("record_not_found", "proposal").title).toBe("Proposal not found");
    expect(contentFailureCopy("record_not_found", "template").title).toBe("Template not found");
    expect(contentFailureCopy("rate_limited", "vendors").message).toMatch(/Wait a few minutes/);
  });
});

describe("which backend reads each page makes", () => {
  const ok = { ok: true as const, data: {} as never };
  const NAMES: Array<keyof ContentReads> = ["proposals", "proposal", "vendorResponses", "members", "teams", "templates", "template", "vendors"];
  const allReads = () =>
    Object.fromEntries(NAMES.map((name) => [name, jest.fn(async () => ok)])) as unknown as jest.Mocked<ContentReads>;
  const onlyCalled = (reads: jest.Mocked<ContentReads>, name: keyof ContentReads, ...args: unknown[]) => {
    for (const key of Object.keys(reads) as Array<keyof ContentReads>) {
      expect({ key, calls: reads[key].mock.calls.length }).toEqual({ key, calls: key === name ? 1 : 0 });
    }
    expect(reads[name]).toHaveBeenCalledWith(...args);
  };

  it("proposals: the list once, with the page and search from the address", async () => {
    const reads = allReads();
    await expect(loadProposalsPage(reads, ORG, { page: "2", search: " summit " })).resolves.toEqual({ query: { page: 2, search: "summit" }, result: ok });
    onlyCalled(reads, "proposals", ORG, { page: 2, search: "summit" });
  });

  it("one proposal: the proposal once, and not its vendor responses", async () => {
    const reads = allReads();
    await expect(loadProposalPage(reads, ORG, PROPOSAL)).resolves.toBe(ok);
    onlyCalled(reads, "proposal", ORG, PROPOSAL);
  });

  it("vendor responses: the responses once, and not the proposal", async () => {
    const reads = allReads();
    await expect(loadVendorResponsesPage(reads, ORG, PROPOSAL)).resolves.toBe(ok);
    onlyCalled(reads, "vendorResponses", ORG, PROPOSAL);
  });

  it("members, teams, templates, one template and vendors: one read each", async () => {
    let reads = allReads();
    await loadMembersPage(reads, ORG, { page: "3", search: "ignored" });
    onlyCalled(reads, "members", ORG, { page: 3 });

    reads = allReads();
    await loadTeamsPage(reads, ORG);
    onlyCalled(reads, "teams", ORG);

    reads = allReads();
    await loadTemplatesPage(reads, ORG, { scope: "organization" });
    onlyCalled(reads, "templates", ORG, { page: 1, search: "", scope: "organization", status: "all" });

    reads = allReads();
    await loadTemplatePage(reads, ORG, TEMPLATE);
    onlyCalled(reads, "template", ORG, TEMPLATE);

    reads = allReads();
    await loadVendorsPage(reads, ORG, { status: "archived", search: "audio" });
    onlyCalled(reads, "vendors", ORG, { page: 1, search: "audio", status: "archived" });
  });

  it("asks nothing when the address is not made of ids", async () => {
    const reads = allReads();
    const invalid = { ok: false, failure: "invalid_id" };
    const missing = { ok: false, failure: "record_not_found" };
    for (const bad of ["abc", ORG.toUpperCase(), `${ORG}0`, "../x"]) {
      await expect(loadProposalsPage(reads, bad, {})).resolves.toMatchObject({ result: invalid });
      await expect(loadProposalPage(reads, bad, PROPOSAL)).resolves.toEqual(invalid);
      await expect(loadVendorResponsesPage(reads, bad, PROPOSAL)).resolves.toEqual(invalid);
      await expect(loadMembersPage(reads, bad, {})).resolves.toMatchObject({ result: invalid });
      await expect(loadTeamsPage(reads, bad)).resolves.toEqual(invalid);
      await expect(loadTemplatesPage(reads, bad, {})).resolves.toMatchObject({ result: invalid });
      await expect(loadTemplatePage(reads, bad, TEMPLATE)).resolves.toEqual(invalid);
      await expect(loadVendorsPage(reads, bad, {})).resolves.toMatchObject({ result: invalid });
      await expect(loadProposalPage(reads, ORG, bad)).resolves.toEqual(missing);
      await expect(loadVendorResponsesPage(reads, ORG, bad)).resolves.toEqual(missing);
      await expect(loadTemplatePage(reads, ORG, bad)).resolves.toEqual(missing);
    }
    for (const read of Object.values(reads)) expect(read).not.toHaveBeenCalled();
  });
});

describe("the old Support access addresses", () => {
  it("sends each one to its place in the organization content browser", () => {
    expect(supportAccessRedirect()).toBe("/organizations");
    expect(supportAccessRedirect({ organizationId: ORG })).toBe(`/organizations/${ORG}`);
    expect(supportAccessRedirect({ organizationId: ORG, rfpId: "" })).toBe(`/organizations/${ORG}/proposals`);
    expect(supportAccessRedirect({ organizationId: ORG, rfpId: PROPOSAL })).toBe(`/organizations/${ORG}/proposals/${PROPOSAL}`);
    expect(supportAccessRedirect({ organizationId: ORG, rfpId: PROPOSAL, vendorResponses: true })).toBe(`/organizations/${ORG}/proposals/${PROPOSAL}/vendor-responses`);
  });

  it("never puts something that is not an id into the new address", () => {
    expect(supportAccessRedirect({ organizationId: "../admin" })).toBe("/organizations");
    expect(supportAccessRedirect({ organizationId: "//evil.example", rfpId: PROPOSAL })).toBe("/organizations");
    expect(supportAccessRedirect({ organizationId: ORG, rfpId: "../../users" })).toBe(`/organizations/${ORG}/proposals`);
    expect(supportAccessRedirect({ organizationId: ORG, rfpId: "x", vendorResponses: true })).toBe(`/organizations/${ORG}/proposals`);
  });
});

describe("wording", () => {
  it("names roles, statuses and template kinds the way staff know them", () => {
    expect(roleLabel("organization_admin")).toBe("Admin");
    expect(roleLabel("team_manager")).toBe("Team Manager");
    expect(roleLabel("billing_contact")).toBe("Billing contact");
    expect(rolesLabel(["owner", "planner"])).toBe("Owner, Planner");
    expect(rolesLabel([])).toBe("No role");
    expect(memberStatusBadge("active")).toEqual({ label: "Active", tone: "good" });
    expect(memberStatusBadge("deactivated")).toEqual({ label: "Deactivated", tone: "danger" });
    expect(memberStatusBadge("on_leave")).toEqual({ label: "On leave", tone: "neutral" });
    expect(templateScopeLabel("organization")).toBe("Organization template");
    expect(templateScopeLabel("personal")).toBe("Personal template");
  });

  it("says which rows a list page is on", () => {
    expect(pageRange({ page: 2, perPage: 20, total: 57, totalPages: 3 }, 20)).toEqual({ start: 21, end: 40 });
    expect(pageRange({ page: 3, perPage: 20, total: 57, totalPages: 3 }, 17)).toEqual({ start: 41, end: 57 });
    expect(pageRange({ page: 1, perPage: 20, total: 0, totalPages: 1 }, 0)).toEqual({ start: 0, end: 0 });
  });
});

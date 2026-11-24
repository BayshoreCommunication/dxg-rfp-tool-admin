import {
  BLOCK_EFFECTS,
  checkDraft,
  codeOf,
  confirmationPhrase,
  emptyDraft,
  isManagementId,
  loadMemberPage,
  loadOrganizationWritePage,
  managementFailure,
  managementFailureCopy,
  memberManagementPath,
  memberStanding,
  organizationWritePath,
  organizationWritesFor,
  parseBlockAnswer,
  parseManagedMember,
  reasonLength,
  reasonOf,
  refusalOf,
  refused,
  resultSummary,
  retryAfterSecondsOf,
  reviewLines,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementFailure,
  type ManagementReads,
} from "@/lib/organizationManagement/management";

const ORG = "6b0000000000000000000002";
const USER = "6a0000000000000000000001";
const OTHER = "6a0000000000000000000009";

const memberView = (change: Record<string, unknown> = {}) => ({
  userId: USER,
  name: "Pat Planner",
  email: "pat@acme.example",
  roles: ["planner"],
  status: "active",
  teams: [{ id: "6c0000000000000000000003", name: "West", archived: false, isManager: true }],
  joinedAt: "2026-10-01T00:00:00.000Z",
  lastSignedInAt: "2026-11-16T10:00:00.000Z",
  ...change,
});
const managed = (change: Record<string, unknown> = {}, version = 4): ManagedMember => {
  const view = memberView(change);
  return parseManagedMember({ organizationId: ORG, member: view, version }, ORG, view.userId) as ManagedMember;
};
const organization = (change: Partial<ManagedOrganization> = {}): ManagedOrganization => ({
  id: ORG,
  name: "Acme Events",
  standing: "active",
  blocked: null,
  ...change,
});

describe("ids, paths and what a block or a reactivation carries", () => {
  it("accepts only a 24-character lower-case hex id", () => {
    expect(isManagementId(ORG)).toBe(true);
    for (const value of ["", "abc", ORG.toUpperCase(), `${ORG}0`, `${ORG.slice(0, 23)}g`, `${ORG.slice(0, 23)}/`, 12, null, undefined, {}, [ORG]]) {
      expect(isManagementId(value)).toBe(false);
    }
  });

  it("builds every management address outside the view-only content browser", () => {
    expect(memberManagementPath(ORG, USER)).toBe(`/organization-management/${ORG}/members/${USER}`);
    expect(organizationWritePath(ORG, "block")).toBe(`/organization-management/${ORG}/block`);
    expect(organizationWritePath(ORG, "unblock")).toBe(`/organization-management/${ORG}/reactivate`);
    // An id can't change the path.
    expect(memberManagementPath("a/b", "c?d")).toBe("/organization-management/a%2Fb/members/c%3Fd");
    for (const path of [memberManagementPath(ORG, USER), organizationWritePath(ORG, "block")]) expect(path.startsWith("/organizations/")).toBe(false);
  });

  it("takes a reason of 10 to 500 characters after trimming", () => {
    expect(reasonOf("   ten chars.  ")).toBe("ten chars.");
    expect(reasonOf("nine char")).toBeNull();
    expect(reasonOf(`  ${"x".repeat(9)}          `)).toBeNull();
    expect(reasonOf("x".repeat(500))).toHaveLength(500);
    expect(reasonOf(` ${"x".repeat(500)} `)).toHaveLength(500);
    expect(reasonOf("x".repeat(501))).toBeNull();
    for (const value of [null, undefined, 1234567890, ["a reason of some length"], { reason: "a reason of some length" }]) expect(reasonOf(value)).toBeNull();
    expect(reasonLength("  abc  ")).toBe(3);
  });
});

describe("reading the answers", () => {
  it("reads one member through the members list's allowlist, and hands on nothing else", () => {
    const answer = { organizationId: ORG, member: { ...memberView(), passwordHash: "x", sessions: ["y"] }, version: 4, extra: "z" };
    const parsed = parseManagedMember(answer, ORG, USER);
    expect(parsed).toEqual({ member: memberView() });
    expect(JSON.stringify(parsed)).not.toMatch(/passwordHash|sessions|extra/);
  });

  it("shows nothing for another organization or another member", () => {
    expect(parseManagedMember({ organizationId: OTHER, member: memberView(), version: 4 }, ORG, USER)).toBeNull();
    expect(parseManagedMember({ organizationId: ORG, member: memberView({ userId: OTHER }), version: 4 }, ORG, USER)).toBeNull();
    expect(parseManagedMember({ organizationId: ORG, member: memberView({ userId: "not-an-id" }), version: 4 }, ORG, "not-an-id")).toBeNull();
    for (const value of [null, undefined, "x", [], { organizationId: ORG }]) expect(parseManagedMember(value, ORG, USER)).toBeNull();
  });

  it("reads a block and a reactivation, and refuses an answer that says the opposite of what was asked", () => {
    expect(parseBlockAnswer({ organizationId: ORG, changed: true, blocked: true, blockedAt: "2026-11-20T09:00:00.000Z", sessionsEnded: 7 }, ORG, "block")).toEqual({
      answer: "organization",
      changed: true,
      blocked: true,
      blockedAt: "2026-11-20T09:00:00.000Z",
      sessionsEnded: 7,
    });
    expect(parseBlockAnswer({ organizationId: ORG, changed: false, blocked: true, blockedAt: "not a date", sessionsEnded: 0 }, ORG, "block")).toMatchObject({ changed: false, blockedAt: null, sessionsEnded: 0 });
    expect(parseBlockAnswer({ organizationId: ORG, changed: true, blocked: false, blockedAt: null }, ORG, "unblock")).toEqual({
      answer: "organization",
      changed: true,
      blocked: false,
      blockedAt: null,
      sessionsEnded: null,
    });
    expect(parseBlockAnswer({ organizationId: ORG, changed: true, blocked: false, blockedAt: null }, ORG, "block")).toBeNull();
    expect(parseBlockAnswer({ organizationId: ORG, changed: true, blocked: true, blockedAt: "2026-11-20T09:00:00.000Z" }, ORG, "unblock")).toBeNull();
    expect(parseBlockAnswer({ organizationId: OTHER, changed: true, blocked: true }, ORG, "block")).toBeNull();
    expect(parseBlockAnswer({ organizationId: ORG, blocked: true }, ORG, "block")).toBeNull();
  });
});

describe("the membership version the removed writes needed", () => {
  it("still shows a member whose answer has no version, or one that is not a number", () => {
    // Nothing reads a version now: an answer without one is a member all the same.
    for (const answer of [{ organizationId: ORG, member: memberView() }, { organizationId: ORG, member: memberView(), version: "4" }, { organizationId: ORG, member: memberView(), version: null }]) {
      expect(parseManagedMember(answer, ORG, USER)).toEqual({ member: memberView() });
    }
    // Every other check on the answer stands.
    expect(parseManagedMember({ organizationId: ORG, member: { ...memberView(), userId: undefined } }, ORG, USER)).toBeNull();
    expect(parseManagedMember({ organizationId: ORG }, ORG, USER)).toBeNull();
  });
});

describe("the refusal of every status and code", () => {
  // Every code the member read, the team read and the block routes answer with (backend docs/API.md and source).
  const CODES: Array<[status: number, code: string, failure: ManagementFailure]> = [
    [400, "INVALID_REASON", "invalid_reason"],
    [400, "INVALID_ORGANIZATION_ID", "invalid_id"],
    [400, "INVALID_MEMBER_ID", "invalid_id"],
    [400, "INVALID_TEAM_ID", "invalid_team_id"],
    [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
    [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
    [404, "MEMBER_NOT_FOUND", "member_not_found"],
    [404, "TEAM_NOT_FOUND", "team_not_found"],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable"],
    [500, "STAFF_MEMBERS_INTERNAL_ERROR", "outcome_unknown"],
    [500, "STAFF_TEAMS_INTERNAL_ERROR", "outcome_unknown"],
    [500, "STAFF_ORGANIZATION_BLOCK_INTERNAL_ERROR", "outcome_unknown"],
  ];

  it.each(CODES)("%i %s is %s", (status, code, failure) => {
    expect(managementFailure(status, code, "write")).toBe(failure);
  });

  // The codes of the member and team writes staff no longer make have no wording of their own:
  // if one ever arrived it would be an unknown code, never a change reported as made.
  it.each(["STALE_VERSION", "OWNER_HAS_RFPS", "INVALID_ROLE", "OWNERSHIP_TRANSFER_REQUIRED", "TEAM_ARCHIVED", "TEAM_NAME_TAKEN", "UNKNOWN_TEAMS"])("%s is no longer a known code", (code) => {
    expect(managementFailure(409, code, "write")).toBe("outcome_unknown");
    expect(managementFailure(409, code, "read")).toBe("unavailable");
  });

  it("maps a status without a known code", () => {
    expect(managementFailure(401, null, "write")).toBe("session_ended");
    expect(managementFailure(401, "AUTHENTICATION_REQUIRED", "read")).toBe("session_ended");
    expect(managementFailure(403, null, "write")).toBe("forbidden");
    expect(managementFailure(429, null, "write")).toBe("rate_limited");
    expect(managementFailure(429, null, "read")).toBe("rate_limited");
    // A 404 with no known code: the API does not have the route yet.
    expect(managementFailure(404, null, "write")).toBe("not_available");
    expect(managementFailure(404, "SOMETHING_NEW", "read")).toBe("not_available");
  });

  it("never reports a write that may have been saved as nothing having happened", () => {
    for (const status of [500, 502, 503, 504, 409, 400]) expect(managementFailure(status, null, "write")).toBe("outcome_unknown");
    // A read changes nothing: it is only unavailable.
    for (const status of [500, 502, 503]) expect(managementFailure(status, null, "read")).toBe("unavailable");
    expect(managementFailure(500, "STAFF_MEMBERS_INTERNAL_ERROR", "read")).toBe("unavailable");
  });

  it("keeps the code and the counted details, and never the backend's text", () => {
    const secret = "BACKEND TEXT mongodb://host/secret";
    // The counted details of the removed member writes are not kept either.
    expect(refusalOf(409, { success: false, code: "OWNER_HAS_RFPS", message: secret, ownedRfpCount: 3, reverted: true, stack: secret }, null, "write")).toEqual({ ok: false, failure: "outcome_unknown", code: "OWNER_HAS_RFPS" });
    expect(refusalOf(409, { code: "ORGANIZATION_NOT_MANAGEABLE", standing: "platform", message: secret }, null, "read")).toEqual({
      ok: false,
      failure: "organization_not_manageable",
      code: "ORGANIZATION_NOT_MANAGEABLE",
      standing: "platform",
    });
    expect(refusalOf(409, { code: "ORGANIZATION_NOT_MANAGEABLE", standing: secret }, null, "read")).not.toHaveProperty("standing");
    expect(refusalOf(400, { code: "INVALID_REASON", message: secret, fields: { reason: secret } }, null, "write")).toEqual({ ok: false, failure: "invalid_reason", code: "INVALID_REASON" });
    // A code that is not an identifier is dropped; a body that is not an object is no code at all.
    expect(refusalOf(500, { code: secret }, null, "write")).toEqual({ ok: false, failure: "outcome_unknown", code: null });
    expect(refusalOf(502, "<html>Bad gateway</html>", null, "read")).toEqual({ ok: false, failure: "unavailable", code: null });
    for (const body of [{ code: "OWNER_HAS_RFPS", message: secret }, { code: "X", error: secret }]) {
      expect(JSON.stringify(refusalOf(409, body, null, "write"))).not.toMatch(/BACKEND|mongodb/);
    }
  });

  it("keeps a usable Retry-After on a 429 only", () => {
    expect(refusalOf(429, { message: "Too many requests." }, "120", "write")).toEqual({ ok: false, failure: "rate_limited", code: null, retryAfterSeconds: 120 });
    expect(refusalOf(429, null, null, "write")).toEqual({ ok: false, failure: "rate_limited", code: null });
    expect(refusalOf(409, { code: "STALE_VERSION" }, "120", "write")).not.toHaveProperty("retryAfterSeconds");
    expect(retryAfterSecondsOf("5000")).toBe(900);
    for (const header of ["", "0", "-3", "soon", "1.5", null, undefined]) expect(retryAfterSecondsOf(header)).toBeNull();
  });

  it("shows a code only when it is an identifier", () => {
    expect(codeOf("STALE_VERSION")).toBe("STALE_VERSION");
    for (const value of ["stale_version", "Stale version", "A", "<script>", "", null, 409, { code: "X" }]) expect(codeOf(value)).toBeNull();
  });

  it("words every refusal for a person, in fixed text", () => {
    const failures: ManagementFailure[] = [
      "session_ended", "forbidden", "rate_limited", "not_available", "unavailable", "outcome_unknown", "invalid_id", "invalid_reason",
      "organization_not_found", "member_not_found", "organization_not_manageable", "invalid_team_id", "team_not_found",
    ];
    const titles = new Set<string>();
    for (const failure of failures) {
      const copy = managementFailureCopy(refused(failure));
      expect(copy.title.length).toBeGreaterThan(5);
      expect(copy.message.length).toBeGreaterThan(20);
      expect(`${copy.title} ${copy.message}`).not.toMatch(/[A-Z]{3,}_[A-Z_]+|undefined|null|\bRFPs?\b/);
      titles.add(copy.title);
    }
    // Each has its own wording.
    expect(titles.size).toBe(failures.length);
    expect(managementFailureCopy(refused("not_available")).title).toBe("Not available yet");
    expect(managementFailureCopy(refused("rate_limited")).message).toMatch(/60 per 15 minutes/);
    expect(managementFailureCopy({ failure: "rate_limited", retryAfterSeconds: 45 }).message).toMatch(/Try again in about 45 seconds\./);
    expect(managementFailureCopy({ failure: "rate_limited", retryAfterSeconds: 600 }).message).toMatch(/Try again in about 10 minutes\./);
    expect(managementFailureCopy(refused("outcome_unknown")).message).toMatch(/Check the current state before trying again/);
  });

  it("words a refusal on a view page as a view: nothing there could have been changed", () => {
    const failures: ManagementFailure[] = ["session_ended", "forbidden", "rate_limited", "not_available", "unavailable", "invalid_id", "organization_not_found", "member_not_found", "organization_not_manageable", "invalid_team_id", "team_not_found"];
    for (const failure of failures) {
      const copy = managementFailureCopy(refused(failure), "view");
      expect({ failure, text: `${copy.title} ${copy.message}` }).not.toMatchObject({ text: expect.stringMatching(/Nothing was changed|can't manage|Managing|blocked|undefined|null/) });
      expect(copy.message.length).toBeGreaterThan(20);
      expect(copy.tone).toBe(managementFailureCopy(refused(failure)).tone);
    }
    expect(managementFailureCopy(refused("forbidden"), "view")).toEqual({
      title: "This account can't view customer organizations here",
      message: "Viewing a customer organization's members and teams needs an RFPilot staff account with an admin role.",
      tone: "problem",
    });
    expect(managementFailureCopy(refused("member_not_found"), "view").message).toBe("This person is not a member of this organization.");
    expect(managementFailureCopy({ failure: "rate_limited", retryAfterSeconds: 45 }, "view").message).toBe("Pages opened here count toward the 300 views of customer content per 15 minutes for each staff account. Try again in about 45 seconds.");
    expect(managementFailureCopy({ failure: "organization_not_manageable", standing: "platform" }, "view").title).toBe("RFPilot's own organization can't be viewed here");
    expect(managementFailureCopy({ failure: "organization_not_manageable", standing: "legacy_holding" }, "view").message).toBe("It is awaiting placement, so its members and teams can't be opened here.");
    // The block and reactivate pages keep the wording of a change, which is also what is said when no page is named.
    expect(managementFailureCopy(refused("forbidden"))).toEqual({
      title: "This account can't manage organizations",
      message: "Managing a customer organization needs an RFPilot staff account with an admin role. Nothing was changed.",
      tone: "problem",
    });
    expect(managementFailureCopy(refused("forbidden"), "change")).toEqual(managementFailureCopy(refused("forbidden")));
    expect(managementFailureCopy(refused("organization_not_found")).message).toMatch(/Nothing was changed\.$/);
  });

  it("says why an organization can't be managed, by its standing", () => {
    expect(managementFailureCopy({ failure: "organization_not_manageable", standing: "platform" }).title).toBe("RFPilot's own organization can't be managed here");
    expect(managementFailureCopy({ failure: "organization_not_manageable", standing: "legacy_holding" }).message).toMatch(/awaiting placement/);
  });
});

describe("a member's standing, and when a block is offered", () => {
  it("reads the stored status of a deactivated member as deactivated", () => {
    expect(memberStanding("suspended")).toBe("deactivated");
    expect(memberStanding("deactivated")).toBe("deactivated");
    expect(memberStanding("active")).toBe("active");
    expect(memberStanding("invited")).toBe("invited");
    expect(memberStanding("removed")).toBe("removed");
    expect(memberStanding("something")).toBe("other");
  });

  it("offers a block for a customer organization that is not blocked, and a reactivation for any that is", () => {
    expect(organizationWritesFor({ standing: "active", blocked: null })).toEqual(["block"]);
    expect(organizationWritesFor({ standing: "inactive", blocked: null })).toEqual(["block"]);
    expect(organizationWritesFor({ standing: "platform", blocked: null })).toEqual([]);
    expect(organizationWritesFor({ standing: "awaiting_placement", blocked: null })).toEqual([]);
    for (const standing of ["active", "inactive", "platform", "awaiting_placement"] as const) {
      expect(organizationWritesFor({ standing, blocked: { at: null } })).toEqual(["unblock"]);
    }
  });
});

describe("which backend reads each page makes", () => {
  const reads = (member: ManagedMember | null = managed(), org: ManagedOrganization | null = organization()) => {
    const calls: string[] = [];
    const made: ManagementReads = {
      member: async (organizationId, userId) => {
        calls.push(`member ${organizationId} ${userId}`);
        return member ? { ok: true, data: member } : refused("member_not_found");
      },
      organization: async (organizationId) => {
        calls.push(`organization ${organizationId}`);
        return org ? { ok: true, data: org } : refused("organization_not_found");
      },
    };
    return { made, calls };
  };

  it("reads the member once for the member page, and nothing for an address that is not made of ids", async () => {
    const r = reads();
    await expect(loadMemberPage(r.made, ORG, USER)).resolves.toMatchObject({ ok: true });
    expect(r.calls).toEqual([`member ${ORG} ${USER}`]);
    const bad = reads();
    await expect(loadMemberPage(bad.made, "nope", USER)).resolves.toEqual(refused("invalid_id"));
    await expect(loadMemberPage(bad.made, ORG, "nope")).resolves.toEqual(refused("invalid_id"));
    expect(bad.calls).toEqual([]);
  });

  it("reads the organization once for the block and the reactivate page", async () => {
    const r = reads();
    await expect(loadOrganizationWritePage(r.made, ORG, "block")).resolves.toMatchObject({ state: "ready" });
    await expect(loadOrganizationWritePage(r.made, ORG, "unblock")).resolves.toMatchObject({ state: "not_offered" });
    expect(r.calls).toEqual([`organization ${ORG}`, `organization ${ORG}`]);
    const blocked = reads(managed(), organization({ blocked: { at: "2026-11-20T09:00:00.000Z" } }));
    await expect(loadOrganizationWritePage(blocked.made, ORG, "unblock")).resolves.toMatchObject({ state: "ready" });
    await expect(loadOrganizationWritePage(blocked.made, ORG, "block")).resolves.toMatchObject({ state: "not_offered" });
    const bad = reads();
    await expect(loadOrganizationWritePage(bad.made, "nope", "block")).resolves.toEqual({ state: "failed", refusal: refused("invalid_id") });
    expect(bad.calls).toEqual([]);
  });
});

describe("the form, the review and the result", () => {
  const REASON = "Requested by the account owner in ticket 4411.";

  it("asks for a reason, with the API's own rule", () => {
    expect(checkDraft(emptyDraft())).toMatchObject({ ok: false, errors: { reason: "Give a reason of 10 to 500 characters." } });
    expect(checkDraft({ reason: "too short" }).ok).toBe(false);
    expect(checkDraft({ reason: "x".repeat(501) }).ok).toBe(false);
  });

  it("sends the trimmed reason and nothing else", () => {
    expect(checkDraft({ reason: `  ${REASON}  ` })).toEqual({ ok: true, request: { reason: REASON } });
    expect(checkDraft({ reason: REASON, role: "viewer", target: { userId: OTHER } } as never)).toEqual({ ok: true, request: { reason: REASON } });
  });

  it("says what a block does and does not do, on the block review", () => {
    const lines = reviewLines("block", { organization: organization() });
    expect(lines[0]).toBe("Acme Events is blocked.");
    const text = lines.join(" ");
    expect(text).toMatch(/Ends every member's session at once\./);
    expect(text).toMatch(/Closes sign-in for every member/);
    expect(text).toMatch(/vendor links, shared proposal pages and invitation links/);
    expect(text).toMatch(/all of the organization's data is kept/);
    expect(text).toMatch(/staff can still view the organization and reactivate it/);
    expect(BLOCK_EFFECTS.does).toHaveLength(4);
    // The backend's known limits: a block is not described as more complete than it is.
    expect(text).toMatch(/Pauses background work that has not started/);
    expect(text).not.toMatch(/Pauses the organization's background work/);
    expect(text).toMatch(/already running when the block lands: it runs to the end and may save its result/);
    expect(text).toMatch(/notification connection or a response that is already open when the block lands/);
    expect(text).toMatch(/old \/uploads address/);
    expect(text).toMatch(/Does not pause the escalation of the organization's support tickets to RFPilot staff/);
    expect(BLOCK_EFFECTS.doesNot).toHaveLength(7);
    // Only what the backend documents: file links are not mentioned beyond the /uploads address.
    expect(text).not.toMatch(/expire/);
    expect(reviewLines("unblock", { organization: organization() })[0]).toBe("Acme Events is reactivated.");
  });

  it("asks staff to type the organization's name, or its id when it has none", () => {
    expect(confirmationPhrase(organization())).toBe("Acme Events");
    expect(confirmationPhrase(organization({ name: "  Acme Events " }))).toBe("Acme Events");
    expect(confirmationPhrase(organization({ name: "   " }))).toBe(ORG);
  });

  it("shows a block and a reactivation from the answer, with the date in UTC and labelled", () => {
    const context = { organization: organization() };
    expect(resultSummary(context, { answer: "organization", changed: true, blocked: true, blockedAt: "2026-11-20T23:30:00.000Z", sessionsEnded: 1 })).toEqual({
      title: "Organization blocked",
      lines: ["Acme Events: Blocked since Nov 20, 2026 UTC.", "1 session ended."],
    });
    expect(resultSummary(context, { answer: "organization", changed: true, blocked: true, blockedAt: null, sessionsEnded: 7 }).lines).toEqual([
      "Acme Events: Blocked (the date is not recorded).",
      "7 sessions ended.",
    ]);
    // No count in the answer: nothing is claimed about sessions.
    expect(resultSummary(context, { answer: "organization", changed: true, blocked: true, blockedAt: "2026-11-20T23:30:00.000Z", sessionsEnded: null }).lines).toEqual([
      "Acme Events: Blocked since Nov 20, 2026 UTC.",
      "The block is in place.",
    ]);
    const again = (sessionsEnded: number | null) => resultSummary(context, { answer: "organization", changed: false, blocked: true, blockedAt: "2026-11-20T23:30:00.000Z", sessionsEnded });
    expect(again(0)).toEqual({
      title: "Already blocked",
      lines: ["Acme Events was already blocked: Blocked since Nov 20, 2026 UTC. The block itself did not change; the request is still recorded on the RFPilot side."],
    });
    expect(again(null).lines).toHaveLength(1);
    // A repeated block also ends sessions that began meanwhile: the answer's count is shown.
    expect(again(2).lines[1]).toBe("2 sessions ended with this request.");
    expect(again(1).lines[1]).toBe("1 session ended with this request.");
    for (const count of [0, 2, null]) expect(again(count).lines.join(" ")).not.toMatch(/Nothing changed|Every member's session/);
    expect(resultSummary(context, { answer: "organization", changed: true, blocked: false, blockedAt: null, sessionsEnded: null }).title).toBe("Organization reactivated");
    expect(resultSummary(context, { answer: "organization", changed: false, blocked: false, blockedAt: null, sessionsEnded: null }).title).toBe("Not blocked");
  });
});

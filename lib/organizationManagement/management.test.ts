import {
  ASSIGNABLE_ROLES,
  BLOCK_EFFECTS,
  canReceiveProposals,
  checkDraft,
  codeOf,
  confirmationPhrase,
  currentOwnerLine,
  emptyDraft,
  flowKey,
  isAssignableRole,
  isManagementId,
  loadMemberPage,
  loadMemberWritePage,
  loadOrganizationWritePage,
  managementFailure,
  managementFailureCopy,
  memberManagementPath,
  memberStanding,
  memberWritePath,
  memberWritesFor,
  organizationWritePath,
  organizationWritesFor,
  parseBlockAnswer,
  parseManagedMember,
  parseMemberChange,
  parseReassignment,
  parseTransfer,
  reasonLength,
  reasonOf,
  reassignBeforeDeactivatePath,
  refusalOf,
  refused,
  resultSummary,
  retryAfterSecondsOf,
  reviewLines,
  roleChoicesFor,
  unknownOutcomeFollowUp,
  versionOf,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementFailure,
  type ManagementReads,
  type MemberWrite,
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
  owner: { name: "Olive Owner", email: "olive@acme.example" },
  ...change,
});

describe("ids, paths and what a write carries", () => {
  it("accepts only a 24-character lower-case hex id", () => {
    expect(isManagementId(ORG)).toBe(true);
    for (const value of ["", "abc", ORG.toUpperCase(), `${ORG}0`, `${ORG.slice(0, 23)}g`, `${ORG.slice(0, 23)}/`, 12, null, undefined, {}, [ORG]]) {
      expect(isManagementId(value)).toBe(false);
    }
  });

  it("builds every management address outside the view-only content browser", () => {
    expect(memberManagementPath(ORG, USER)).toBe(`/organization-management/${ORG}/members/${USER}`);
    const segments: Record<MemberWrite, string> = { role: "role", deactivate: "deactivate", reactivate: "reactivate", reassign: "reassign-proposals", transfer: "transfer-ownership" };
    for (const [write, segment] of Object.entries(segments)) {
      expect(memberWritePath(ORG, USER, write as MemberWrite)).toBe(`/organization-management/${ORG}/members/${USER}/${segment}`);
    }
    expect(reassignBeforeDeactivatePath(ORG, USER)).toBe(`/organization-management/${ORG}/members/${USER}/reassign-proposals?then=deactivate`);
    expect(organizationWritePath(ORG, "block")).toBe(`/organization-management/${ORG}/block`);
    expect(organizationWritePath(ORG, "unblock")).toBe(`/organization-management/${ORG}/reactivate`);
    // An id can't change the path.
    expect(memberManagementPath("a/b", "c?d")).toBe("/organization-management/a%2Fb/members/c%3Fd");
    for (const path of [memberManagementPath(ORG, USER), organizationWritePath(ORG, "block")]) expect(path.startsWith("/organizations/")).toBe(false);
  });

  it("accepts the four roles the API accepts, and never Owner", () => {
    expect([...ASSIGNABLE_ROLES]).toEqual(["organization_admin", "team_manager", "planner", "viewer"]);
    for (const role of ASSIGNABLE_ROLES) expect(isAssignableRole(role)).toBe(true);
    for (const role of ["owner", "Owner", "super_admin", "dxg_admin", "admin", "", "Planner", null, 1, ["planner"]]) expect(isAssignableRole(role)).toBe(false);
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

  it("takes a version that is a whole number from 1, never a string", () => {
    expect(versionOf(1)).toBe(1);
    expect(versionOf(27)).toBe(27);
    for (const value of [0, -1, 1.5, "3", null, undefined, Number.NaN, Infinity, [3]]) expect(versionOf(value)).toBeNull();
  });
});

describe("reading the answers", () => {
  it("reads one member through the members list's allowlist, with its version", () => {
    const answer = { organizationId: ORG, member: { ...memberView(), passwordHash: "x", sessions: ["y"] }, version: 4, extra: "z" };
    const parsed = parseManagedMember(answer, ORG, USER);
    expect(parsed).toEqual({ member: memberView(), version: 4 });
    expect(JSON.stringify(parsed)).not.toMatch(/passwordHash|sessions|extra/);
  });

  it("shows nothing for another organization, another member, or an answer without a version", () => {
    expect(parseManagedMember({ organizationId: OTHER, member: memberView(), version: 4 }, ORG, USER)).toBeNull();
    expect(parseManagedMember({ organizationId: ORG, member: memberView({ userId: OTHER }), version: 4 }, ORG, USER)).toBeNull();
    expect(parseManagedMember({ organizationId: ORG, member: memberView(), version: "4" }, ORG, USER)).toBeNull();
    expect(parseManagedMember({ organizationId: ORG, member: memberView() }, ORG, USER)).toBeNull();
    expect(parseManagedMember({ organizationId: ORG, member: memberView({ userId: "not-an-id" }), version: 4 }, ORG, "not-an-id")).toBeNull();
    for (const value of [null, undefined, "x", [], { organizationId: ORG }]) expect(parseManagedMember(value, ORG, USER)).toBeNull();
  });

  it("reads a member change with whether anything changed", () => {
    expect(parseMemberChange({ organizationId: ORG, changed: true, member: memberView({ roles: ["viewer"] }), version: 5 }, ORG, USER)).toEqual({
      answer: "member",
      changed: true,
      member: memberView({ roles: ["viewer"] }),
      version: 5,
    });
    expect(parseMemberChange({ organizationId: ORG, changed: false, member: memberView(), version: 4 }, ORG, USER)).toMatchObject({ changed: false, version: 4 });
    expect(parseMemberChange({ organizationId: ORG, member: memberView(), version: 4 }, ORG, USER)).toBeNull();
    expect(parseMemberChange({ organizationId: ORG, changed: "yes", member: memberView(), version: 4 }, ORG, USER)).toBeNull();
    expect(parseMemberChange({ organizationId: OTHER, changed: true, member: memberView(), version: 4 }, ORG, USER)).toBeNull();
  });

  it("reads a reassignment as its count, without the proposal ids", () => {
    const parsed = parseReassignment({ organizationId: ORG, reassignedCount: 3, rfpIds: ["6d0000000000000000000001"] }, ORG);
    expect(parsed).toEqual({ answer: "reassign", reassignedCount: 3 });
    expect(parseReassignment({ organizationId: ORG, reassignedCount: 0, rfpIds: [] }, ORG)).toEqual({ answer: "reassign", reassignedCount: 0 });
    expect(parseReassignment({ organizationId: ORG, reassignedCount: "3" }, ORG)).toBeNull();
    expect(parseReassignment({ organizationId: OTHER, reassignedCount: 3 }, ORG)).toBeNull();
  });

  it("reads a transfer as the new Owner and the previous one", () => {
    const answer = {
      organizationId: ORG,
      previousOwner: { member: memberView({ userId: OTHER, name: "Olive Owner", email: "olive@acme.example", roles: ["organization_admin"] }), version: 9 },
      owner: { member: memberView({ roles: ["owner"] }), version: 5 },
    };
    const parsed = parseTransfer(answer, ORG, USER);
    expect(parsed?.answer).toBe("transfer");
    expect(parsed?.owner).toEqual({ member: memberView({ roles: ["owner"] }), version: 5 });
    expect(parsed?.previousOwner.member.roles).toEqual(["organization_admin"]);
    // The new Owner must be the member the transfer named.
    expect(parseTransfer(answer, ORG, OTHER)).toBeNull();
    expect(parseTransfer({ ...answer, previousOwner: null }, ORG, USER)).toBeNull();
    expect(parseTransfer({ ...answer, organizationId: OTHER }, ORG, USER)).toBeNull();
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

describe("the refusal of every status and code", () => {
  // Every code the member, ownership and block routes answer with (backend docs/API.md and source).
  const CODES: Array<[status: number, code: string, failure: ManagementFailure]> = [
    [400, "INVALID_REASON", "invalid_reason"],
    [400, "INVALID_ROLE", "invalid_role"],
    [400, "VERSION_REQUIRED", "version_required"],
    [400, "INVALID_ORGANIZATION_ID", "invalid_id"],
    [400, "INVALID_MEMBER_ID", "invalid_id"],
    [400, "MEMBER_REQUIRED", "invalid_request"],
    [400, "REASSIGN_TARGET_REQUIRED", "invalid_request"],
    [400, "INVALID_RFP_SELECTION", "invalid_request"],
    [400, "REASSIGN_TO_SELF", "reassign_to_self"],
    [400, "ALREADY_OWNER", "already_owner"],
    [409, "ALREADY_OWNER", "already_owner"],
    [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
    [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
    [404, "MEMBER_NOT_FOUND", "member_not_found"],
    [404, "REASSIGN_TARGET_NOT_FOUND", "reassign_target_not_found"],
    [409, "STALE_VERSION", "stale_version"],
    [409, "OWNERSHIP_TRANSFER_REQUIRED", "ownership_transfer_required"],
    [409, "OWNER_HAS_RFPS", "owner_has_proposals"],
    [409, "LAST_OWNER", "last_owner"],
    [409, "MEMBER_REMOVED", "member_removed"],
    [409, "MEMBER_NOT_DEACTIVATED", "member_not_deactivated"],
    [409, "MEMBER_INACTIVE", "member_inactive"],
    [409, "OWNER_CHANGED", "owner_changed"],
    [409, "OWNER_NOT_FOUND", "owner_not_found"],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable"],
    [409, "REASSIGN_TARGET_INELIGIBLE", "reassign_target_ineligible"],
    [409, "RFPS_NOT_OWNED_BY_MEMBER", "proposals_not_owned"],
    [500, "STAFF_MEMBERS_INTERNAL_ERROR", "outcome_unknown"],
    [500, "STAFF_ORGANIZATION_BLOCK_INTERNAL_ERROR", "outcome_unknown"],
  ];

  it.each(CODES)("%i %s is %s", (status, code, failure) => {
    expect(managementFailure(status, code, "write")).toBe(failure);
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
    const refusal = refusalOf(409, { success: false, code: "OWNER_HAS_RFPS", message: secret, ownedRfpCount: 3, reverted: true, stack: secret }, null, "write");
    expect(refusal).toEqual({ ok: false, failure: "owner_has_proposals", code: "OWNER_HAS_RFPS", ownedProposalCount: 3, reverted: true });
    expect(refusalOf(409, { code: "OWNER_HAS_RFPS", ownedRfpCount: 1 }, null, "write")).toEqual({ ok: false, failure: "owner_has_proposals", code: "OWNER_HAS_RFPS", ownedProposalCount: 1 });
    expect(refusalOf(409, { code: "ORGANIZATION_NOT_MANAGEABLE", standing: "platform", message: secret }, null, "read")).toEqual({
      ok: false,
      failure: "organization_not_manageable",
      code: "ORGANIZATION_NOT_MANAGEABLE",
      standing: "platform",
    });
    expect(refusalOf(409, { code: "ORGANIZATION_NOT_MANAGEABLE", standing: secret }, null, "read")).not.toHaveProperty("standing");
    expect(refusalOf(409, { code: "RFPS_NOT_OWNED_BY_MEMBER", notOwnedCount: 2 }, null, "write")).toMatchObject({ failure: "proposals_not_owned", notOwnedCount: 2 });
    expect(refusalOf(400, { code: "INVALID_REASON", message: secret, fields: { reason: secret } }, null, "write")).toEqual({ ok: false, failure: "invalid_reason", code: "INVALID_REASON" });
    expect(refusalOf(409, { code: "STALE_VERSION", currentVersion: 9, message: secret }, null, "write")).toEqual({ ok: false, failure: "stale_version", code: "STALE_VERSION" });
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
      "session_ended", "forbidden", "rate_limited", "not_available", "unavailable", "outcome_unknown", "invalid_id", "invalid_request", "invalid_reason",
      "invalid_role", "version_required", "organization_not_found", "member_not_found", "reassign_target_not_found", "stale_version",
      "ownership_transfer_required", "owner_has_proposals", "last_owner", "member_removed", "member_not_deactivated", "member_inactive", "already_owner",
      "owner_changed", "owner_not_found", "organization_not_manageable", "reassign_target_ineligible", "reassign_to_self", "proposals_not_owned",
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
    expect(managementFailureCopy(refused("stale_version")).message).toMatch(/Load the current member/);
    // The API says only that the version moved, not who moved it.
    expect(managementFailureCopy(refused("stale_version")).message).toMatch(/^This member changed after this page loaded it, so the change was not made\./);
    expect(managementFailureCopy(refused("stale_version")).message).not.toMatch(/Someone else/);
    expect(managementFailureCopy(refused("rate_limited")).message).toMatch(/60 per 15 minutes/);
    expect(managementFailureCopy({ failure: "rate_limited", retryAfterSeconds: 45 }).message).toMatch(/Try again in about 45 seconds\./);
    expect(managementFailureCopy({ failure: "rate_limited", retryAfterSeconds: 600 }).message).toMatch(/Try again in about 10 minutes\./);
    expect(managementFailureCopy(refused("outcome_unknown")).message).toMatch(/Check the current state before trying again/);
  });

  it("counts the proposals a member still owns, in the right number", () => {
    expect(managementFailureCopy({ failure: "owner_has_proposals", ownedProposalCount: 1 }).title).toBe("This member still owns 1 proposal");
    expect(managementFailureCopy({ failure: "owner_has_proposals", ownedProposalCount: 12 }).title).toBe("This member still owns 12 proposals");
    expect(managementFailureCopy({ failure: "owner_has_proposals" }).title).toBe("This member still owns proposals");
    expect(managementFailureCopy({ failure: "owner_has_proposals", ownedProposalCount: 1, reverted: true }).message).toMatch(/put back: the member is still active/);
    expect(managementFailureCopy({ failure: "proposals_not_owned", notOwnedCount: 1 }).message).toMatch(/^1 proposal named in the request is not owned/);
    expect(managementFailureCopy({ failure: "proposals_not_owned", notOwnedCount: 2 }).message).toMatch(/^2 proposals named in the request are not owned/);
    expect(managementFailureCopy({ failure: "organization_not_manageable", standing: "platform" }).title).toBe("RFPilot's own organization can't be managed here");
    expect(managementFailureCopy({ failure: "organization_not_manageable", standing: "legacy_holding" }).message).toMatch(/awaiting placement/);
  });
});

describe("which writes a member's state offers", () => {
  // Role x status x Owner. `suspended` is the stored status of a deactivated member, which is
  // what the staff routes return; `deactivated` is the customer-facing name of the same state.
  const TABLE: Array<[roles: string[], status: string, writes: MemberWrite[]]> = [
    [["planner"], "active", ["role", "deactivate", "reassign", "transfer"]],
    [["viewer"], "active", ["role", "deactivate", "reassign", "transfer"]],
    [["team_manager"], "active", ["role", "deactivate", "reassign", "transfer"]],
    [["organization_admin"], "active", ["role", "deactivate", "reassign", "transfer"]],
    [["organization_admin", "knowledge_editor"], "active", ["role", "deactivate", "reassign", "transfer"]],
    [[], "active", ["role", "deactivate", "reassign", "transfer"]],
    [["owner"], "active", ["reassign"]],
    [["owner", "planner"], "active", ["reassign"]],
    [["planner"], "suspended", ["role", "reactivate", "reassign"]],
    [["planner"], "deactivated", ["role", "reactivate", "reassign"]],
    [["organization_admin"], "suspended", ["role", "reactivate", "reassign"]],
    [["owner"], "suspended", ["reactivate", "reassign"]],
    [["planner"], "invited", ["role"]],
    [["owner"], "invited", []],
    [["planner"], "removed", []],
    [["owner"], "removed", []],
    [["planner"], "", []],
    [["planner"], "pending", []],
    [["planner"], "ACTIVE", []],
  ];

  it.each(TABLE)("roles %j, status %j: %j", (roles, status, writes) => {
    expect(memberWritesFor({ roles, status })).toEqual(writes);
  });

  it("never offers the Owner a role change, a deactivation or a transfer to themselves, in any status", () => {
    for (const status of ["active", "suspended", "deactivated", "invited", "removed", "other"]) {
      const writes = memberWritesFor({ roles: ["owner"], status });
      for (const write of ["role", "deactivate", "transfer"] as const) expect({ status, write, offered: writes.includes(write) }).toEqual({ status, write, offered: false });
    }
  });

  it("reads the stored status of a deactivated member as deactivated", () => {
    expect(memberStanding("suspended")).toBe("deactivated");
    expect(memberStanding("deactivated")).toBe("deactivated");
    expect(memberStanding("active")).toBe("active");
    expect(memberStanding("invited")).toBe("invited");
    expect(memberStanding("removed")).toBe("removed");
    expect(memberStanding("something")).toBe("other");
  });

  it("offers the roles the API accepts without the one the member has, and never Owner", () => {
    expect(roleChoicesFor({ roles: ["planner"] })).toEqual(["organization_admin", "team_manager", "viewer"]);
    expect(roleChoicesFor({ roles: ["viewer", "knowledge_editor"] })).toEqual(["organization_admin", "team_manager", "planner"]);
    expect(roleChoicesFor({ roles: [] })).toEqual(["organization_admin", "team_manager", "planner", "viewer"]);
    for (const roles of [["planner"], ["owner"], []]) expect(roleChoicesFor({ roles })).not.toContain("owner");
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

  it("lets only an active member who isn't a Viewer, and isn't the member themselves, receive proposals", () => {
    const candidate = (change: Record<string, unknown> = {}) => ({ userId: OTHER, name: "Vic", email: "vic@acme.example", roles: ["planner"], status: "active", ...change });
    expect(canReceiveProposals(candidate(), USER)).toBe(true);
    for (const roles of [["owner"], ["organization_admin"], ["team_manager"], ["viewer", "planner"]]) expect(canReceiveProposals(candidate({ roles }), USER)).toBe(true);
    expect(canReceiveProposals(candidate({ roles: ["viewer"] }), USER)).toBe(false);
    expect(canReceiveProposals(candidate({ roles: [] }), USER)).toBe(false);
    expect(canReceiveProposals(candidate({ roles: ["knowledge_editor"] }), USER)).toBe(false);
    for (const status of ["suspended", "deactivated", "invited", "removed", ""]) expect(canReceiveProposals(candidate({ status }), USER)).toBe(false);
    expect(canReceiveProposals(candidate({ userId: USER }), USER)).toBe(false);
    expect(canReceiveProposals(candidate({ userId: "nope" }), USER)).toBe(false);
  });
});

describe("which backend reads each management page makes", () => {
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

  it("reads the member, then the organization, for a write the member's state offers", async () => {
    const r = reads();
    const load = await loadMemberWritePage(r.made, ORG, USER, "role");
    expect(load).toMatchObject({ state: "ready", member: { version: 4 }, organization: { name: "Acme Events" } });
    expect(r.calls).toEqual([`member ${ORG} ${USER}`, `organization ${ORG}`]);
  });

  it("does not read the organization when the flow will not be shown", async () => {
    // The member could not be read.
    const missing = reads(null);
    await expect(loadMemberWritePage(missing.made, ORG, USER, "deactivate")).resolves.toEqual({ state: "failed", refusal: refused("member_not_found") });
    expect(missing.calls).toEqual([`member ${ORG} ${USER}`]);
    // The write is not one the member's state offers: the Owner is never deactivated.
    const owner = reads(managed({ roles: ["owner"] }));
    await expect(loadMemberWritePage(owner.made, ORG, USER, "deactivate")).resolves.toMatchObject({ state: "not_offered" });
    await expect(loadMemberWritePage(owner.made, ORG, USER, "role")).resolves.toMatchObject({ state: "not_offered" });
    await expect(loadMemberWritePage(owner.made, ORG, USER, "transfer")).resolves.toMatchObject({ state: "not_offered" });
    expect(owner.calls).toEqual([`member ${ORG} ${USER}`, `member ${ORG} ${USER}`, `member ${ORG} ${USER}`]);
    // Nothing at all for a malformed address.
    const bad = reads();
    await expect(loadMemberWritePage(bad.made, ORG, "nope", "role")).resolves.toEqual({ state: "failed", refusal: refused("invalid_id") });
    expect(bad.calls).toEqual([]);
  });

  it("keys a write flow by the write, the member and the version read, so a new read starts it again", () => {
    expect(flowKey("transfer", managed({}, 4))).toBe(`transfer:${USER}:4`);
    expect(flowKey("transfer", managed({}, 5))).not.toBe(flowKey("transfer", managed({}, 4)));
    expect(flowKey("transfer", managed({ userId: OTHER }, 4))).not.toBe(flowKey("transfer", managed({}, 4)));
    expect(flowKey("role", managed({}, 4))).not.toBe(flowKey("transfer", managed({}, 4)));
  });

  it("fails the write page when the organization can't be read", async () => {
    const r = reads(managed(), null);
    await expect(loadMemberWritePage(r.made, ORG, USER, "transfer")).resolves.toEqual({ state: "failed", refusal: refused("organization_not_found") });
    expect(r.calls).toHaveLength(2);
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
  const target = { userId: OTHER, name: "Vic Vendor-Lead", email: "vic@acme.example", roles: ["team_manager"], status: "active" };

  it("asks for a reason on every write, with the API's own rule", () => {
    for (const kind of ["role", "deactivate", "reactivate", "reassign", "transfer", "block", "unblock"] as const) {
      const checked = checkDraft(kind, { ...emptyDraft(), role: "viewer", target }, managed().member);
      expect(checked).toMatchObject({ ok: false, errors: { reason: "Give a reason of 10 to 500 characters." } });
      expect(checkDraft(kind, { ...emptyDraft(), reason: "too short", role: "viewer", target }, managed().member).ok).toBe(false);
      expect(checkDraft(kind, { ...emptyDraft(), reason: "x".repeat(501), role: "viewer", target }, managed().member).ok).toBe(false);
    }
  });

  it("sends the trimmed reason and only what the write names", () => {
    expect(checkDraft("deactivate", { reason: `  ${REASON}  `, role: "viewer", target }, managed().member)).toEqual({ ok: true, request: { reason: REASON } });
    expect(checkDraft("role", { reason: REASON, role: "viewer", target }, managed().member)).toEqual({ ok: true, request: { reason: REASON, role: "viewer" } });
    expect(checkDraft("reassign", { reason: REASON, role: "viewer", target }, managed().member)).toEqual({ ok: true, request: { reason: REASON, target } });
    expect(checkDraft("block", { reason: REASON, role: "viewer", target })).toEqual({ ok: true, request: { reason: REASON } });
  });

  it("refuses Owner, an unknown role and the role the member already has", () => {
    for (const role of ["owner", "", "super_admin"]) {
      expect(checkDraft("role", { reason: REASON, role, target: null }, managed().member)).toEqual({ ok: false, errors: { role: "Choose the new role." } });
    }
    expect(checkDraft("role", { reason: REASON, role: "planner", target: null }, managed().member)).toMatchObject({ ok: false, errors: { role: expect.stringMatching(/already has that role/) } });
  });

  it("refuses a reassignment with no receiver, or one who can't receive proposals", () => {
    expect(checkDraft("reassign", { reason: REASON, role: "", target: null }, managed().member)).toMatchObject({ ok: false, errors: { target: expect.any(String) } });
    expect(checkDraft("reassign", { reason: REASON, role: "", target: { ...target, roles: ["viewer"] } }, managed().member).ok).toBe(false);
    expect(checkDraft("reassign", { reason: REASON, role: "", target: { ...target, userId: USER } }, managed().member).ok).toBe(false);
  });

  it("states in plain words who and what changes", () => {
    const context = { organization: organization(), member: managed().member };
    expect(reviewLines("role", context, { reason: REASON, role: "viewer" })[0]).toBe("Pat Planner (pat@acme.example) in Acme Events: the role changes from Planner to Viewer.");
    expect(reviewLines("deactivate", context, { reason: REASON })[0]).toBe("Pat Planner (pat@acme.example) in Acme Events is deactivated.");
    expect(reviewLines("reactivate", context, { reason: REASON })[0]).toBe("Pat Planner (pat@acme.example) in Acme Events is reactivated, with the role Planner.");
    expect(reviewLines("reassign", context, { reason: REASON, target })[0]).toBe(
      "Every proposal Pat Planner (pat@acme.example) owns in Acme Events moves to Vic Vendor-Lead (vic@acme.example).",
    );
    const transfer = reviewLines("transfer", context, { reason: REASON });
    expect(transfer[0]).toBe("Pat Planner (pat@acme.example) becomes the Owner of Acme Events. Their role changes from Planner to Owner.");
    // The request binds only the new Owner: the Owner read at page load is named as that, never as who is demoted.
    expect(transfer[1]).toBe(
      "The organization's current Owner becomes an Admin and is signed out everywhere at once: Olive Owner (olive@acme.example) when this page loaded, or whoever holds the role when the transfer is saved.",
    );
    expect(transfer.join(" ")).not.toMatch(/The current Owner, Olive Owner/);
    for (const owner of [null, { name: "", email: "" }]) {
      const line = reviewLines("transfer", { ...context, organization: organization({ owner }) }, { reason: REASON })[1];
      expect(line).toBe("The organization's current Owner, whoever holds the role when the transfer is saved, becomes an Admin and is signed out everywhere at once.");
    }
    expect(currentOwnerLine(organization({ owner: { name: "", email: "olive@acme.example" } }))).toMatch(/: olive@acme\.example when this page loaded, or whoever/);
    // Nobody is named "null", and an unnamed organization still reads as one.
    const bare = { organization: organization({ name: "  " }), member: managed({ name: null, email: null }).member };
    expect(reviewLines("deactivate", bare, { reason: REASON })[0]).toBe("A member with no name or email on file in Unnamed organization is deactivated.");
  });

  it("says what a block does and does not do, on the block review", () => {
    const lines = reviewLines("block", { organization: organization() }, { reason: REASON });
    expect(lines[0]).toBe("Acme Events is blocked.");
    const text = lines.join(" ");
    expect(text).toMatch(/Ends every member's session at once\./);
    expect(text).toMatch(/Closes sign-in for every member/);
    expect(text).toMatch(/vendor links, shared proposal pages and invitation links/);
    expect(text).toMatch(/all of the organization's data is kept/);
    expect(text).toMatch(/staff can still view and manage the organization/);
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
    expect(reviewLines("unblock", { organization: organization() }, { reason: REASON })[0]).toBe("Acme Events is reactivated.");
  });

  it("asks staff to type the organization's name, or its id when it has none", () => {
    expect(confirmationPhrase(organization())).toBe("Acme Events");
    expect(confirmationPhrase(organization({ name: "  Acme Events " }))).toBe("Acme Events");
    expect(confirmationPhrase(organization({ name: "   " }))).toBe(ORG);
  });

  it("shows the result from the API's own answer", () => {
    const context = { organization: organization(), member: managed().member };
    const request = { reason: REASON };
    expect(resultSummary("role", context, request, { answer: "member", changed: true, member: managed({ roles: ["viewer"] }).member, version: 5 })).toEqual({
      title: "Role changed",
      lines: ["Pat Planner (pat@acme.example) is active in Acme Events, with the role Viewer."],
    });
    expect(resultSummary("deactivate", context, request, { answer: "member", changed: true, member: managed({ status: "suspended" }).member, version: 5 })).toEqual({
      title: "Member deactivated",
      lines: ["Pat Planner (pat@acme.example) is deactivated in Acme Events, with the role Planner."],
    });
    expect(resultSummary("reactivate", context, request, { answer: "member", changed: true, member: managed().member, version: 5 }).title).toBe("Member reactivated");
    expect(resultSummary("deactivate", context, request, { answer: "member", changed: false, member: managed({ status: "suspended" }).member, version: 4 }).title).toBe("Nothing needed changing");
    expect(resultSummary("reassign", context, { reason: REASON, target }, { answer: "reassign", reassignedCount: 1 }).lines).toEqual([
      "1 proposal moved from Pat Planner (pat@acme.example) to Vic Vendor-Lead (vic@acme.example) in Acme Events.",
    ]);
    expect(resultSummary("reassign", context, { reason: REASON, target }, { answer: "reassign", reassignedCount: 12 }).lines[0]).toMatch(/^12 proposals moved/);
    const none = { answer: "reassign" as const, reassignedCount: 0 };
    expect(resultSummary("reassign", context, { reason: REASON, target }, none)).toEqual({
      title: "No proposals to move",
      lines: ["Pat Planner (pat@acme.example) owns no proposals in Acme Events. Nothing was moved."],
    });
    // After an attempt whose outcome was unknown, "nothing was moved" is only true of this request.
    expect(resultSummary("reassign", context, { reason: REASON, target }, none, { afterUnknownOutcome: true }).lines).toEqual([
      "Pat Planner (pat@acme.example) owns no proposals in Acme Events now. This request moved nothing.",
      "An earlier attempt from this page was not confirmed by the server and may already have moved them to the member chosen then.",
    ]);
    expect(resultSummary("reassign", context, { reason: REASON, target }, { answer: "reassign", reassignedCount: 2 }, { afterUnknownOutcome: true }).lines[0]).toMatch(/^2 proposals moved/);
    const transferred = resultSummary("transfer", context, request, {
      answer: "transfer",
      owner: { member: managed({ roles: ["owner"] }).member, version: 5 },
      previousOwner: { member: managed({ userId: OTHER, name: "Olive Owner", email: "olive@acme.example", roles: ["organization_admin"] }).member, version: 9 },
    });
    expect(transferred).toEqual({
      title: "Ownership transferred",
      lines: ["Pat Planner (pat@acme.example) is now the Owner of Acme Events.", "Olive Owner (olive@acme.example) now has the role Admin."],
    });
  });

  it("shows a block and a reactivation from the answer, with the date in UTC and labelled", () => {
    const context = { organization: organization() };
    const request = { reason: REASON };
    expect(resultSummary("block", context, request, { answer: "organization", changed: true, blocked: true, blockedAt: "2026-11-20T23:30:00.000Z", sessionsEnded: 1 })).toEqual({
      title: "Organization blocked",
      lines: ["Acme Events: Blocked since Nov 20, 2026 UTC.", "1 session ended."],
    });
    expect(resultSummary("block", context, request, { answer: "organization", changed: true, blocked: true, blockedAt: null, sessionsEnded: 7 }).lines).toEqual([
      "Acme Events: Blocked (the date is not recorded).",
      "7 sessions ended.",
    ]);
    // No count in the answer: nothing is claimed about sessions.
    expect(resultSummary("block", context, request, { answer: "organization", changed: true, blocked: true, blockedAt: "2026-11-20T23:30:00.000Z", sessionsEnded: null }).lines).toEqual([
      "Acme Events: Blocked since Nov 20, 2026 UTC.",
      "The block is in place.",
    ]);
    const again = (sessionsEnded: number | null) => resultSummary("block", context, request, { answer: "organization", changed: false, blocked: true, blockedAt: "2026-11-20T23:30:00.000Z", sessionsEnded });
    expect(again(0)).toEqual({
      title: "Already blocked",
      lines: ["Acme Events was already blocked: Blocked since Nov 20, 2026 UTC. The block itself did not change; the request is still recorded on the RFPilot side."],
    });
    expect(again(null).lines).toHaveLength(1);
    // A repeated block also ends sessions that began meanwhile: the answer's count is shown.
    expect(again(2).lines[1]).toBe("2 sessions ended with this request.");
    expect(again(1).lines[1]).toBe("1 session ended with this request.");
    for (const count of [0, 2, null]) expect(again(count).lines.join(" ")).not.toMatch(/Nothing changed|Every member's session/);
    expect(resultSummary("unblock", context, request, { answer: "organization", changed: true, blocked: false, blockedAt: null, sessionsEnded: null }).title).toBe("Organization reactivated");
    expect(resultSummary("unblock", context, request, { answer: "organization", changed: false, blocked: false, blockedAt: null, sessionsEnded: null }).title).toBe("Not blocked");
  });
});

describe("after a write whose outcome is unknown, once the member is loaded again", () => {
  const REASON = "Requested by the account owner in ticket 4411.";
  const context = (change: Record<string, unknown> = {}) => ({ organization: organization(), member: managed(change, 5).member });

  it("deactivate: says the change was saved, that the sign-out may not have completed, and offers the one resend", () => {
    // The backend answers a deactivation of a suspended member `changed: false` and ends the sessions again.
    for (const status of ["suspended", "deactivated"]) {
      const followUp = unknownOutcomeFollowUp("deactivate", context({ status }), { reason: REASON });
      expect(followUp).toMatchObject({ title: "The deactivation was saved", resend: { label: "Finish signing this member out" } });
      expect(followUp?.lines[0]).toBe("Pat Planner (pat@acme.example) is deactivated in Acme Events.");
      expect(followUp?.lines.join(" ")).toMatch(/signing the member out everywhere may not have completed/);
      expect(followUp?.lines.join(" ")).toMatch(/changes nothing about the member/);
    }
    // Still active: the outcome is not shown, so the form and the review come back as before.
    expect(unknownOutcomeFollowUp("deactivate", context(), { reason: REASON })).toBeNull();
    expect(unknownOutcomeFollowUp("deactivate", context({ status: "removed" }), { reason: REASON })).toBeNull();
  });

  it("role: offers the resend only when the member has the requested role, and says what it can and can't do", () => {
    const followUp = unknownOutcomeFollowUp("role", context({ roles: ["viewer"] }), { reason: REASON, role: "viewer" });
    expect(followUp).toMatchObject({ title: "The role change was saved", resend: { label: "Finish signing this member out" } });
    expect(followUp?.lines[0]).toBe("Pat Planner (pat@acme.example) has the role Viewer in Acme Events.");
    // The backend's retry cannot tell which way the role moved: it never promises a full sign-out.
    expect(followUp?.lines.join(" ")).toMatch(/end the member's other sessions on their next request/);
    expect(followUp?.lines.join(" ")).toMatch(/can't sign the member out everywhere at once/);
    expect(unknownOutcomeFollowUp("role", context({ roles: ["viewer"], status: "suspended" }), { reason: REASON, role: "viewer" })?.resend).not.toBeNull();
    // Another role, no role in the request, a removed member (409 MEMBER_REMOVED) or the Owner: nothing is offered.
    expect(unknownOutcomeFollowUp("role", context(), { reason: REASON, role: "viewer" })).toBeNull();
    expect(unknownOutcomeFollowUp("role", context({ roles: ["viewer"] }), { reason: REASON })).toBeNull();
    expect(unknownOutcomeFollowUp("role", context({ roles: ["viewer"], status: "removed" }), { reason: REASON, role: "viewer" })).toBeNull();
    expect(unknownOutcomeFollowUp("role", context({ roles: ["owner", "viewer"] }), { reason: REASON, role: "viewer" })).toBeNull();
  });

  it("reactivate: says it was saved and offers no resend, because a reactivation signs nobody out", () => {
    const followUp = unknownOutcomeFollowUp("reactivate", context(), { reason: REASON });
    expect(followUp).toEqual({
      title: "The reactivation was saved",
      lines: ["Pat Planner (pat@acme.example) is active in Acme Events, with the role Planner.", "A reactivation signs nobody out, so nothing more is needed."],
      resend: null,
    });
    expect(unknownOutcomeFollowUp("reactivate", context({ status: "suspended" }), { reason: REASON })).toBeNull();
  });

  it("transfer: says it was saved and offers no resend, because the backend answers ALREADY_OWNER", () => {
    const followUp = unknownOutcomeFollowUp("transfer", context({ roles: ["owner"] }), { reason: REASON });
    expect(followUp).toMatchObject({ title: "The transfer was saved", resend: null });
    expect(followUp?.lines[0]).toBe("Pat Planner (pat@acme.example) is the Owner of Acme Events.");
    expect(followUp?.lines.join(" ")).toMatch(/signing the previous Owner out everywhere may not have completed/);
    expect(followUp?.lines.join(" ")).toMatch(/can't be sent again.*Nothing more can be done from this page/);
    expect(unknownOutcomeFollowUp("transfer", context(), { reason: REASON })).toBeNull();
  });

  it("reassign, block and reactivate organization: the member read shows nothing of the outcome, so nothing is claimed", () => {
    expect(unknownOutcomeFollowUp("reassign", context(), { reason: REASON })).toBeNull();
    expect(unknownOutcomeFollowUp("block", context(), { reason: REASON })).toBeNull();
    expect(unknownOutcomeFollowUp("unblock", context(), { reason: REASON })).toBeNull();
    expect(unknownOutcomeFollowUp("deactivate", { organization: organization() }, { reason: REASON })).toBeNull();
  });

  it("never says a write was not saved, and never names an identifier", () => {
    const all = [
      unknownOutcomeFollowUp("deactivate", context({ status: "suspended" }), { reason: REASON }),
      unknownOutcomeFollowUp("role", context({ roles: ["viewer"] }), { reason: REASON, role: "viewer" }),
      unknownOutcomeFollowUp("reactivate", context(), { reason: REASON }),
      unknownOutcomeFollowUp("transfer", context({ roles: ["owner"] }), { reason: REASON }),
    ];
    for (const followUp of all) expect(`${followUp?.title} ${followUp?.lines.join(" ")}`).not.toMatch(/[A-Z]{3,}_[A-Z_]+|undefined|null|was not saved|nothing happened/i);
  });

  it("words the answer to the resend as a sign-out asked for again, not as nothing having happened", () => {
    const ctx = context({ status: "suspended" });
    const again = { answer: "member" as const, changed: false, member: managed({ status: "suspended" }).member, version: 5 };
    expect(resultSummary("deactivate", ctx, { reason: REASON }, again, { finishingSignOut: true })).toEqual({
      title: "Sign-out asked for again",
      lines: [
        "Pat Planner (pat@acme.example) is deactivated in Acme Events, with the role Planner.",
        "Nothing about the member changed. The server ended all of the member's sessions again and confirmed it.",
      ],
    });
    const role = { answer: "member" as const, changed: false, member: managed({ roles: ["viewer"] }).member, version: 5 };
    expect(resultSummary("role", ctx, { reason: REASON, role: "viewer" }, role, { finishingSignOut: true }).lines[1]).toBe(
      "Nothing about the member changed. The server confirmed that the member's other sessions end on their next request.",
    );
    // Without the resend, and for a reactivation, the wording is the ordinary one.
    expect(resultSummary("deactivate", ctx, { reason: REASON }, again).title).toBe("Nothing needed changing");
    expect(resultSummary("reactivate", ctx, { reason: REASON }, { ...again, member: managed().member }, { finishingSignOut: true }).title).toBe("Nothing needed changing");
  });
});

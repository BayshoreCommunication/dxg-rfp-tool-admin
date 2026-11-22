jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { auth } from "@/auth";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import * as actions from "./organizationManagement";

const {
  blockOrganizationAction,
  changeMemberRoleAction,
  deactivateMemberAction,
  getManagedMemberAction,
  getManagedOrganizationAction,
  listReassignCandidatesAction,
  reactivateMemberAction,
  reactivateOrganizationAction,
  reassignMemberProposalsAction,
  transferOwnershipAction,
} = actions;

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedAuth = auth as unknown as jest.Mock;

const ORG = "6b0000000000000000000002";
const USER = "6a0000000000000000000001";
const OTHER = "6a0000000000000000000009";
const API = `/api/v1/admin/organizations/${ORG}`;
const REASON = "Requested by the account owner in ticket 4411.";
const SECRET = "BACKEND TEXT mongodb://host/secret";

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
  }) as unknown as Response;
const ok = (data: unknown) => jsonResponse(200, { success: true, data });
// The message is what the backend would say. No test may find it in a result.
const refusal = (status: number, code?: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  jsonResponse(status, { success: false, ...(code ? { code } : {}), message: SECRET, ...extra }, headers);
const urlOf = (call = 0) => String(mockedFetch.mock.calls[call][0]);
const initOf = (call = 0) => mockedFetch.mock.calls[call][1] as RequestInit & { headers: Record<string, string> };
const bodyOf = (call = 0) => JSON.parse(String(initOf(call).body));

const member = (change: Record<string, unknown> = {}) => ({
  userId: USER,
  name: "Pat Planner",
  email: "pat@acme.example",
  roles: ["planner"],
  status: "active",
  teams: [],
  joinedAt: "2026-10-01T00:00:00.000Z",
  lastSignedInAt: null,
  ...change,
});
const changed = (change: Record<string, unknown> = {}) => ok({ organizationId: ORG, changed: true, member: member(change), version: 5 });
const account = (organization: Record<string, unknown> = {}) =>
  ok({
    organization: { id: ORG, name: "Acme Events", slug: "acme", createdAt: null, country: null, status: "active", kind: "customer", standing: "active", ...organization },
    owner: { name: "Olive Owner", email: "olive@acme.example" },
    plan: { plan: "free_trial", exempt: false, proposals: { created: 0, limit: 2, remaining: 2, canCreate: true }, features: {}, lastChange: null },
    counts: {},
    security: {},
    activity: {},
  });

type Case = { name: string; run: (organizationId?: string, userId?: string) => Promise<{ ok: boolean }>; method: string; url: string; body?: Record<string, unknown>; answer: () => Response };

/** Every write with valid arguments, the request it makes and an answer that satisfies it. */
const WRITES: Case[] = [
  {
    name: "role",
    run: (o = ORG, u = USER) => changeMemberRoleAction(o, u, { role: "viewer", version: 4, reason: REASON }),
    method: "PATCH",
    url: `${API}/members/${USER}/role`,
    body: { role: "viewer", version: 4, reason: REASON },
    answer: () => changed({ roles: ["viewer"] }),
  },
  {
    name: "deactivate",
    run: (o = ORG, u = USER) => deactivateMemberAction(o, u, { version: 4, reason: REASON }),
    method: "POST",
    url: `${API}/members/${USER}/deactivate`,
    body: { version: 4, reason: REASON },
    answer: () => changed({ status: "suspended" }),
  },
  {
    name: "reactivate member",
    run: (o = ORG, u = USER) => reactivateMemberAction(o, u, { version: 4, reason: REASON }),
    method: "POST",
    url: `${API}/members/${USER}/reactivate`,
    body: { version: 4, reason: REASON },
    answer: () => changed(),
  },
  {
    name: "reassign",
    run: (o = ORG, u = USER) => reassignMemberProposalsAction(o, u, { toUserId: OTHER, reason: REASON }),
    method: "POST",
    url: `${API}/members/${USER}/reassign-rfps`,
    body: { toUserId: OTHER, reason: REASON },
    answer: () => ok({ organizationId: ORG, reassignedCount: 2, rfpIds: ["6d0000000000000000000001", "6d0000000000000000000002"] }),
  },
  {
    name: "transfer",
    run: (o = ORG, u = USER) => transferOwnershipAction(o, { toUserId: u, version: 4, reason: REASON }),
    method: "POST",
    url: `${API}/ownership/transfer`,
    body: { toUserId: USER, version: 4, reason: REASON },
    answer: () =>
      ok({
        organizationId: ORG,
        previousOwner: { member: member({ userId: OTHER, name: "Olive Owner", roles: ["organization_admin"] }), version: 9 },
        owner: { member: member({ roles: ["owner"] }), version: 5 },
      }),
  },
  {
    name: "block",
    run: (o = ORG) => blockOrganizationAction(o, { reason: REASON }),
    method: "POST",
    url: `${API}/block`,
    body: { reason: REASON },
    answer: () => ok({ organizationId: ORG, changed: true, blocked: true, blockedAt: "2026-11-20T09:00:00.000Z", sessionsEnded: 3 }),
  },
  {
    name: "reactivate organization",
    run: (o = ORG) => reactivateOrganizationAction(o, { reason: REASON }),
    method: "POST",
    url: `${API}/reactivate`,
    body: { reason: REASON },
    answer: () => ok({ organizationId: ORG, changed: true, blocked: false, blockedAt: null }),
  },
];

const READS: Case[] = [
  { name: "member", run: (o = ORG, u = USER) => getManagedMemberAction(o, u), method: "GET", url: `${API}/members/${USER}`, answer: () => ok({ organizationId: ORG, member: member(), version: 4 }) },
  { name: "organization", run: (o = ORG) => getManagedOrganizationAction(o), method: "GET", url: API, answer: () => account() },
  {
    name: "candidates",
    run: (o = ORG) => listReassignCandidatesAction(o, 1),
    method: "GET",
    url: `${API}/members`,
    answer: () => ok({ organizationId: ORG, members: [member()], pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 }, pendingInvitations: [], pendingInvitationsTotal: 0 }),
  },
];
const ALL = [...READS, ...WRITES];

beforeEach(() => {
  mockedFetch.mockReset();
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue({ user: { role: "admin" } });
});

describe("organization management actions", () => {
  it("covers every action the file exports", () => {
    expect(Object.keys(actions).sort()).toEqual([
      "blockOrganizationAction",
      "changeMemberRoleAction",
      "deactivateMemberAction",
      "getManagedMemberAction",
      "getManagedOrganizationAction",
      "listReassignCandidatesAction",
      "reactivateMemberAction",
      "reactivateOrganizationAction",
      "reassignMemberProposalsAction",
      "transferOwnershipAction",
    ]);
    expect(ALL).toHaveLength(10);
  });

  it.each(ALL)("$name: makes exactly one request, to its own route, uncached", async ({ run, method, url, body, answer }) => {
    mockedFetch.mockResolvedValue(answer());
    await expect(run()).resolves.toMatchObject({ ok: true });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(urlOf().endsWith(url)).toBe(true);
    expect(initOf().method).toBe(method);
    expect(initOf().cache).toBe("no-store");
    if (body) expect(bodyOf()).toEqual(body);
    else expect(initOf().body).toBeUndefined();
  });
});

describe("the staff check comes first", () => {
  it.each(ALL)("$name: asks nothing when nobody is signed in, the session has ended, or the account is not staff", async ({ run }) => {
    mockedAuth.mockResolvedValue(null);
    await expect(run()).resolves.toEqual({ ok: false, failure: "session_ended", code: null });
    mockedAuth.mockResolvedValue({ user: { role: "admin" }, authError: "SessionExpired" });
    await expect(run()).resolves.toMatchObject({ ok: false });
    mockedAuth.mockRejectedValue(new Error("no session store"));
    await expect(run()).resolves.toEqual({ ok: false, failure: "session_ended", code: null });
    for (const role of ["user", "owner", "organization_admin", "planner", "", undefined]) {
      mockedAuth.mockResolvedValue({ user: { role } });
      await expect(run()).resolves.toEqual({ ok: false, failure: "forbidden", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(ALL)("$name: checks the session before the ids", async ({ run }) => {
    mockedAuth.mockResolvedValue({ user: { role: "planner" } });
    await expect(run("not-an-id", "not-an-id")).resolves.toEqual({ ok: false, failure: "forbidden", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("lets each admin role through", async () => {
    for (const role of ["admin", "super_admin", "superadmin", "ADMIN"]) {
      mockedAuth.mockResolvedValue({ user: { role } });
      mockedFetch.mockResolvedValue(READS[0].answer());
      await expect(getManagedMemberAction(ORG, USER)).resolves.toMatchObject({ ok: true });
    }
  });
});

describe("every id is checked before the backend is asked", () => {
  const BAD = ["", "abc", ORG.toUpperCase(), `${ORG}0`, `${ORG.slice(0, 23)}/`, `../${ORG.slice(0, 21)}`, `${ORG.slice(0, 20)}%2F..`];

  it.each(ALL)("$name: refuses an organization id that is not 24 lower-case hex", async ({ run }) => {
    for (const id of BAD) await expect(run(id, USER)).resolves.toEqual({ ok: false, failure: "invalid_id", code: null });
    // (`undefined` would take the helper's default id, so it is not in this list.)
    for (const id of [null, 12, {}, [ORG]]) await expect(run(id as unknown as string, USER)).resolves.toMatchObject({ ok: false, failure: "invalid_id" });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(ALL.filter(({ name }) => !["organization", "candidates", "block", "reactivate organization"].includes(name)))("$name: refuses a member id that is not one", async ({ run }) => {
    for (const id of BAD) await expect(run(ORG, id)).resolves.toMatchObject({ ok: false, failure: "invalid_id" });
    for (const id of [null, 12, {}]) await expect(run(ORG, id as unknown as string)).resolves.toMatchObject({ ok: false, failure: "invalid_id" });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refuses a receiving member that is not an id, or is the member themselves", async () => {
    for (const toUserId of ["", "abc", OTHER.toUpperCase(), null, undefined, 7, { $ne: null }, [OTHER]]) {
      await expect(reassignMemberProposalsAction(ORG, USER, { toUserId, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_request", code: null });
    }
    await expect(reassignMemberProposalsAction(ORG, USER, { toUserId: USER, reason: REASON })).resolves.toEqual({ ok: false, failure: "reassign_to_self", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("the body is rebuilt field by field", () => {
  it.each(WRITES)("$name: drops every field the route does not take", async ({ name, answer, body }) => {
    mockedFetch.mockResolvedValue(answer());
    const extras = { organizationId: OTHER, userId: OTHER, memberUserId: OTHER, rfpIds: ["6d0000000000000000000001"], status: "removed", roles: ["owner"], actor: "someone", __proto__: { polluted: true }, $where: "1" };
    const input = { ...extras, role: "viewer", version: 4, reason: `   ${REASON}  `, toUserId: name === "transfer" ? USER : OTHER };
    const run: Record<string, () => Promise<{ ok: boolean }>> = {
      role: () => changeMemberRoleAction(ORG, USER, input),
      deactivate: () => deactivateMemberAction(ORG, USER, input),
      "reactivate member": () => reactivateMemberAction(ORG, USER, input),
      reassign: () => reassignMemberProposalsAction(ORG, USER, input),
      transfer: () => transferOwnershipAction(ORG, input),
      block: () => blockOrganizationAction(ORG, input),
      "reactivate organization": () => reactivateOrganizationAction(ORG, input),
    };
    await expect(run[name]()).resolves.toMatchObject({ ok: true });
    // Exactly the documented fields, the reason trimmed.
    expect(bodyOf()).toEqual(body);
    expect(Object.keys(bodyOf()).sort()).toEqual(Object.keys(body ?? {}).sort());
  });

  it("never sends rfpIds: without it the API moves every proposal the member owns", async () => {
    mockedFetch.mockResolvedValue(WRITES[3].answer());
    await reassignMemberProposalsAction(ORG, USER, { toUserId: OTHER, reason: REASON, rfpIds: "all" });
    expect(bodyOf()).not.toHaveProperty("rfpIds");
    expect(String(initOf().body)).not.toMatch(/rfpIds/);
  });

  it("refuses Owner and any role outside the list before any backend call", async () => {
    for (const role of ["owner", "Owner", "OWNER", "super_admin", "dxg_admin", "admin", "Planner", "", " planner", null, undefined, 3, ["planner"], { role: "planner" }]) {
      await expect(changeMemberRoleAction(ORG, USER, { role, version: 4, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_role", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
    for (const role of ["organization_admin", "team_manager", "planner", "viewer"]) {
      mockedFetch.mockResolvedValue(changed({ roles: [role] }));
      await expect(changeMemberRoleAction(ORG, USER, { role, version: 4, reason: REASON })).resolves.toMatchObject({ ok: true });
    }
    expect(mockedFetch).toHaveBeenCalledTimes(4);
  });

  it.each(WRITES)("$name: refuses a reason that is too short, too long or not text before any backend call", async ({ name }) => {
    const withReason = (reason: unknown): Promise<{ ok: boolean }> => {
      const input = { role: "viewer", version: 4, reason, toUserId: name === "transfer" ? USER : OTHER };
      switch (name) {
        case "role":
          return changeMemberRoleAction(ORG, USER, input);
        case "deactivate":
          return deactivateMemberAction(ORG, USER, input);
        case "reactivate member":
          return reactivateMemberAction(ORG, USER, input);
        case "reassign":
          return reassignMemberProposalsAction(ORG, USER, input);
        case "transfer":
          return transferOwnershipAction(ORG, input);
        case "block":
          return blockOrganizationAction(ORG, input);
        default:
          return reactivateOrganizationAction(ORG, input);
      }
    };
    for (const reason of ["", "too short", `   ${"x".repeat(9)}                `, "x".repeat(501), null, undefined, 1234567890123, ["a reason long enough"], { text: "a reason long enough" }]) {
      await expect(withReason(reason)).resolves.toEqual({ ok: false, failure: "invalid_reason", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
    // The limits themselves are accepted: 10 and 500 characters after trimming.
    for (const reason of ["x".repeat(10), ` ${"x".repeat(500)} `]) {
      mockedFetch.mockResolvedValue(WRITES.find((write) => write.name === name)!.answer());
      await expect(withReason(reason)).resolves.toMatchObject({ ok: true });
      expect(bodyOf(mockedFetch.mock.calls.length - 1).reason).toBe(reason.trim());
    }
  });

  it("refuses a version that is not a whole number from 1 before any backend call", async () => {
    for (const version of ["4", 0, -1, 1.5, null, undefined, Number.NaN, [4], { $gt: 0 }]) {
      await expect(changeMemberRoleAction(ORG, USER, { role: "viewer", version, reason: REASON })).resolves.toEqual({ ok: false, failure: "version_required", code: null });
      await expect(deactivateMemberAction(ORG, USER, { version, reason: REASON })).resolves.toMatchObject({ failure: "version_required" });
      await expect(reactivateMemberAction(ORG, USER, { version, reason: REASON })).resolves.toMatchObject({ failure: "version_required" });
      await expect(transferOwnershipAction(ORG, { toUserId: USER, version, reason: REASON })).resolves.toMatchObject({ failure: "version_required" });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(WRITES)("$name: refuses an input that is not an object", async ({ name }) => {
    for (const input of [null, undefined, "role=viewer", 4, [{ role: "viewer", version: 4, reason: REASON }]]) {
      const result =
        name === "role" ? changeMemberRoleAction(ORG, USER, input)
        : name === "deactivate" ? deactivateMemberAction(ORG, USER, input)
        : name === "reactivate member" ? reactivateMemberAction(ORG, USER, input)
        : name === "reassign" ? reassignMemberProposalsAction(ORG, USER, input)
        : name === "transfer" ? transferOwnershipAction(ORG, input)
        : name === "block" ? blockOrganizationAction(ORG, input)
        : reactivateOrganizationAction(ORG, input);
      await expect(result).resolves.toMatchObject({ ok: false });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("every status and refusal code becomes a fixed kind, never the backend's text", () => {
  const CODES: Array<[status: number, code: string | undefined, failure: string, extra?: Record<string, unknown>, kept?: Record<string, unknown>]> = [
    [400, "INVALID_REASON", "invalid_reason", { fields: { reason: SECRET } }],
    [400, "INVALID_ROLE", "invalid_role"],
    [400, "VERSION_REQUIRED", "version_required"],
    [400, "INVALID_ORGANIZATION_ID", "invalid_id"],
    [400, "INVALID_MEMBER_ID", "invalid_id"],
    [400, "MEMBER_REQUIRED", "invalid_request"],
    [400, "REASSIGN_TARGET_REQUIRED", "invalid_request"],
    [400, "INVALID_RFP_SELECTION", "invalid_request"],
    [400, "REASSIGN_TO_SELF", "reassign_to_self"],
    [400, "ALREADY_OWNER", "already_owner"],
    [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
    [404, "MEMBER_NOT_FOUND", "member_not_found"],
    [404, "REASSIGN_TARGET_NOT_FOUND", "reassign_target_not_found"],
    [409, "STALE_VERSION", "stale_version", { currentVersion: 9 }],
    [409, "OWNERSHIP_TRANSFER_REQUIRED", "ownership_transfer_required"],
    [409, "OWNER_HAS_RFPS", "owner_has_proposals", { ownedRfpCount: 3 }, { ownedProposalCount: 3 }],
    [409, "OWNER_HAS_RFPS", "owner_has_proposals", { ownedRfpCount: 1, reverted: true }, { ownedProposalCount: 1, reverted: true }],
    [409, "LAST_OWNER", "last_owner"],
    [409, "MEMBER_REMOVED", "member_removed"],
    [409, "MEMBER_NOT_DEACTIVATED", "member_not_deactivated"],
    [409, "MEMBER_INACTIVE", "member_inactive"],
    [409, "ALREADY_OWNER", "already_owner"],
    [409, "OWNER_CHANGED", "owner_changed"],
    [409, "OWNER_NOT_FOUND", "owner_not_found"],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable", { standing: "legacy_holding" }, { standing: "legacy_holding" }],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable", { standing: "platform" }, { standing: "platform" }],
    [409, "REASSIGN_TARGET_INELIGIBLE", "reassign_target_ineligible"],
    [409, "RFPS_NOT_OWNED_BY_MEMBER", "proposals_not_owned", { notOwnedCount: 2 }, { notOwnedCount: 2 }],
    [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
    [403, undefined, "forbidden"],
    [401, undefined, "session_ended"],
    [401, "AUTHENTICATION_REQUIRED", "session_ended"],
    [429, undefined, "rate_limited"],
    [404, undefined, "not_available"],
    [500, "STAFF_MEMBERS_INTERNAL_ERROR", "outcome_unknown"],
    [500, "STAFF_ORGANIZATION_BLOCK_INTERNAL_ERROR", "outcome_unknown"],
    [502, undefined, "outcome_unknown"],
  ];

  it.each(CODES)("a write answered %i %s is %s", async (status, code, failure, extra = {}, kept = {}) => {
    for (const write of WRITES) {
      mockedFetch.mockReset();
      mockedFetch.mockResolvedValue(refusal(status, code, extra));
      const result = await write.run();
      expect(result).toEqual({ ok: false, failure, code: code ?? null, ...kept });
      expect(JSON.stringify(result)).not.toMatch(/BACKEND|mongodb|secret/);
      // A refusal is never retried by the action.
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    }
  });

  it("maps the member read's refusals, and never calls a failed read a change that may be saved", async () => {
    const READ_CODES: Array<[number, string | undefined, string]> = [
      [404, "MEMBER_NOT_FOUND", "member_not_found"],
      [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
      [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable"],
      [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
      [401, undefined, "session_ended"],
      [429, undefined, "rate_limited"],
      [404, undefined, "not_available"],
      [500, "STAFF_MEMBERS_INTERNAL_ERROR", "unavailable"],
      [503, undefined, "unavailable"],
    ];
    for (const [status, code, failure] of READ_CODES) {
      mockedFetch.mockResolvedValue(refusal(status, code));
      const result = await getManagedMemberAction(ORG, USER);
      expect(result).toMatchObject({ ok: false, failure, code: code ?? null });
      expect(JSON.stringify(result)).not.toMatch(/BACKEND|mongodb/);
    }
  });

  it("keeps the wait of a 429 that names one", async () => {
    mockedFetch.mockResolvedValue(refusal(429, undefined, {}, { "Retry-After": "240" }));
    await expect(blockOrganizationAction(ORG, { reason: REASON })).resolves.toEqual({ ok: false, failure: "rate_limited", code: null, retryAfterSeconds: 240 });
  });

  it.each(WRITES)("$name: a write that got no readable answer may have been saved, and says so", async ({ run }) => {
    mockedFetch.mockRejectedValue(new Error(SECRET));
    await expect(run()).resolves.toEqual({ ok: false, failure: "outcome_unknown", code: null });
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { organizationId: OTHER } }));
    await expect(run()).resolves.toEqual({ ok: false, failure: "outcome_unknown", code: null });
    mockedFetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("not json"); }, headers: { get: () => null } } as unknown as Response);
    await expect(run()).resolves.toEqual({ ok: false, failure: "outcome_unknown", code: null });
  });

  it("reports a read that can't be made or understood as unavailable", async () => {
    mockedFetch.mockRejectedValue(new Error(SECRET));
    await expect(getManagedMemberAction(ORG, USER)).resolves.toEqual({ ok: false, failure: "unavailable", code: null });
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, member: member({ userId: OTHER }), version: 4 }));
    await expect(getManagedMemberAction(ORG, USER)).resolves.toEqual({ ok: false, failure: "unavailable", code: null });
  });
});

describe("what the answers hand on", () => {
  it("returns the member through the allowlist, with the version", async () => {
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, member: { ...member(), passwordHash: "x", twoFactorSecret: "y" }, version: 4, internal: SECRET }));
    const result = await getManagedMemberAction(ORG, USER);
    expect(result).toEqual({ ok: true, data: { member: member(), version: 4 } });
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|twoFactorSecret|BACKEND/);
  });

  it("hands on five facts of the organization, with the block only while blocked", async () => {
    mockedFetch.mockResolvedValue(account());
    await expect(getManagedOrganizationAction(ORG)).resolves.toEqual({
      ok: true,
      data: { id: ORG, name: "Acme Events", standing: "active", blocked: null, owner: { name: "Olive Owner", email: "olive@acme.example" } },
    });
    mockedFetch.mockResolvedValue(account({ blocked: true, blockedAt: "2026-11-20T09:00:00.000Z" }));
    await expect(getManagedOrganizationAction(ORG)).resolves.toMatchObject({ ok: true, data: { blocked: { at: "2026-11-20T09:00:00.000Z" } } });
    // `blocked` must be the API's own true: a date alone, or any other value, is not a block.
    for (const organization of [{ blockedAt: "2026-11-20T09:00:00.000Z" }, { blocked: "true" }, { blocked: 1 }, { blocked: false, blockedAt: "2026-11-20T09:00:00.000Z" }]) {
      mockedFetch.mockResolvedValue(account(organization));
      await expect(getManagedOrganizationAction(ORG)).resolves.toMatchObject({ ok: true, data: { blocked: null } });
    }
    mockedFetch.mockResolvedValue(account({ blocked: true }));
    await expect(getManagedOrganizationAction(ORG)).resolves.toMatchObject({ ok: true, data: { blocked: { at: null } } });
  });

  it("maps the organization read's refusals", async () => {
    const cases: Array<[number, string | undefined, string]> = [
      [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
      [404, undefined, "not_available"],
      [401, undefined, "session_ended"],
      [403, undefined, "forbidden"],
      [429, undefined, "rate_limited"],
      [500, undefined, "unavailable"],
    ];
    for (const [status, code, failure] of cases) {
      mockedFetch.mockResolvedValue(refusal(status, code));
      await expect(getManagedOrganizationAction(ORG)).resolves.toEqual({ ok: false, failure, code: null });
    }
    // An answer for another organization is never shown.
    mockedFetch.mockResolvedValue(account({ id: OTHER }));
    await expect(getManagedOrganizationAction(ORG)).resolves.toEqual({ ok: false, failure: "unavailable", code: null });
  });

  it("lists one page of members to choose from, with only what the choice shows", async () => {
    mockedFetch.mockResolvedValue(
      ok({
        organizationId: ORG,
        members: [member({ teams: [{ id: "6c0000000000000000000003", name: "West", archived: false, isManager: true }] }), member({ userId: OTHER, name: "Vic", roles: ["viewer"] })],
        pagination: { page: 2, perPage: 50, total: 120, totalPages: 3 },
        pendingInvitations: [{ id: "6e0000000000000000000001", email: "new@acme.example", role: "planner", status: "pending" }],
        pendingInvitationsTotal: 1,
      }),
    );
    const result = await listReassignCandidatesAction(ORG, 2);
    expect(result).toEqual({
      ok: true,
      data: {
        candidates: [
          { userId: USER, name: "Pat Planner", email: "pat@acme.example", roles: ["planner"], status: "active" },
          { userId: OTHER, name: "Vic", email: "pat@acme.example", roles: ["viewer"], status: "active" },
        ],
        pagination: { page: 2, perPage: 50, total: 120, totalPages: 3 },
      },
    });
    expect(urlOf().endsWith(`${API}/members?page=2`)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/new@acme\.example|West|joinedAt/);
  });

  it("asks for page 1 when the page is not a whole number, and never puts anything else in the address", async () => {
    for (const page of [undefined, null, "2", 0, -1, 1.5, "1&search=x", { page: 2 }]) {
      mockedFetch.mockReset();
      mockedFetch.mockResolvedValue(READS[2].answer());
      await listReassignCandidatesAction(ORG, page);
      expect(urlOf().endsWith(`${API}/members`)).toBe(true);
    }
    mockedFetch.mockResolvedValue(refusal(429));
    await expect(listReassignCandidatesAction(ORG, 1)).resolves.toEqual({ ok: false, failure: "rate_limited", code: null });
    mockedFetch.mockResolvedValue(refusal(404));
    await expect(listReassignCandidatesAction(ORG, 1)).resolves.toEqual({ ok: false, failure: "not_available", code: null });
  });

  it("returns each write's answer as the result the screen shows", async () => {
    mockedFetch.mockResolvedValue(changed({ roles: ["viewer"] }));
    await expect(changeMemberRoleAction(ORG, USER, { role: "viewer", version: 4, reason: REASON })).resolves.toEqual({
      ok: true,
      data: { answer: "member", changed: true, member: member({ roles: ["viewer"] }), version: 5 },
    });
    mockedFetch.mockResolvedValue(WRITES[3].answer());
    await expect(WRITES[3].run()).resolves.toEqual({ ok: true, data: { answer: "reassign", reassignedCount: 2 } });
    mockedFetch.mockResolvedValue(WRITES[5].answer());
    await expect(WRITES[5].run()).resolves.toEqual({ ok: true, data: { answer: "organization", changed: true, blocked: true, blockedAt: "2026-11-20T09:00:00.000Z", sessionsEnded: 3 } });
    // Idempotent: nothing to change is still a success.
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, changed: false, blocked: false, blockedAt: null }));
    await expect(reactivateOrganizationAction(ORG, { reason: REASON })).resolves.toMatchObject({ ok: true, data: { changed: false, blocked: false } });
  });
});

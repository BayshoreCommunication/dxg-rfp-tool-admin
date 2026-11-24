jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { auth } from "@/auth";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import * as actions from "./organizationManagement";

const { blockOrganizationAction, getManagedMemberAction, getManagedOrganizationAction, getManagedTeamAction, reactivateOrganizationAction } = actions;

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedAuth = auth as unknown as jest.Mock;

const ORG = "6b0000000000000000000002";
const USER = "6a0000000000000000000001";
const OTHER = "6a0000000000000000000009";
const TEAM = "6c0000000000000000000003";
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
const team = (change: Record<string, unknown> = {}) => ({ id: TEAM, name: "West", archived: false, archivedAt: null, createdAt: "2026-10-01T00:00:00.000Z", memberCount: 1, managers: [], ...change });
const row = (change: Record<string, unknown> = {}, isManager = false) => ({ member: member(change), version: 4, isManager });
const teamAnswer = (teamChange: Record<string, unknown> = {}, members: unknown[] = [row()]) => ok({ organizationId: ORG, team: team(teamChange), members });
const account = (organization: Record<string, unknown> = {}) =>
  ok({
    organization: { id: ORG, name: "Acme Events", slug: "acme", createdAt: null, country: null, status: "active", kind: "customer", standing: "active", ...organization },
    owner: { name: "Olive Owner", email: "olive@acme.example" },
    plan: { plan: "free_trial", exempt: false, proposals: { created: 0, limit: 2, remaining: 2, canCreate: true }, features: {}, lastChange: null },
    counts: {},
    security: {},
    activity: {},
  });

type Case = { name: string; run: (organizationId?: string, secondId?: string) => Promise<{ ok: boolean }>; method: string; url: string; body?: Record<string, unknown>; answer: () => Response };

/** The two writes left, a block and a reactivation of the organization: each with valid arguments, the request it makes and an answer that satisfies it. */
const WRITES: Case[] = [
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
  { name: "team", run: (o = ORG, t = TEAM) => getManagedTeamAction(o, t), method: "GET", url: `${API}/teams/${TEAM}`, answer: () => teamAnswer() },
];
const ALL = [...READS, ...WRITES];

beforeEach(() => {
  mockedFetch.mockReset();
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue({ user: { role: "admin" } });
});

describe("organization management actions", () => {
  it("covers every action the file exports", () => {
    expect(Object.keys(actions).sort()).toEqual(["blockOrganizationAction", "getManagedMemberAction", "getManagedOrganizationAction", "getManagedTeamAction", "reactivateOrganizationAction"]);
    expect(ALL).toHaveLength(5);
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

  it.each(ALL.filter(({ name }) => name === "member"))("$name: refuses a member id that is not one", async ({ run }) => {
    for (const id of BAD) await expect(run(ORG, id)).resolves.toMatchObject({ ok: false, failure: "invalid_id" });
    for (const id of [null, 12, {}]) await expect(run(ORG, id as unknown as string)).resolves.toMatchObject({ ok: false, failure: "invalid_id" });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("team: refuses a team id that is not one", async () => {
    for (const bad of BAD) await expect(getManagedTeamAction(ORG, bad)).resolves.toEqual({ ok: false, failure: "invalid_team_id", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("the body is rebuilt field by field", () => {
  it.each(WRITES)("$name: drops every field the route does not take", async ({ name, answer, body }) => {
    mockedFetch.mockResolvedValue(answer());
    const extras = { organizationId: OTHER, userId: OTHER, memberUserId: OTHER, rfpIds: ["6d0000000000000000000001"], status: "removed", roles: ["owner"], actor: "someone", __proto__: { polluted: true }, $where: "1" };
    const input = { ...extras, role: "viewer", version: 4, reason: `   ${REASON}  `, toUserId: OTHER };
    const run: Record<string, () => Promise<{ ok: boolean }>> = {
      block: () => blockOrganizationAction(ORG, input),
      "reactivate organization": () => reactivateOrganizationAction(ORG, input),
    };
    await expect(run[name]()).resolves.toMatchObject({ ok: true });
    // Exactly the documented fields, the reason trimmed.
    expect(bodyOf()).toEqual(body);
    expect(Object.keys(bodyOf()).sort()).toEqual(Object.keys(body ?? {}).sort());
  });

  it.each(WRITES)("$name: refuses a reason that is too short, too long or not text before any backend call", async ({ name }) => {
    const withReason = (reason: unknown): Promise<{ ok: boolean }> => {
      const input = { role: "viewer", version: 4, reason, toUserId: OTHER };
      return name === "block" ? blockOrganizationAction(ORG, input) : reactivateOrganizationAction(ORG, input);
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

  it.each(WRITES)("$name: refuses an input that is not an object", async ({ name }) => {
    for (const input of [null, undefined, "role=viewer", 4, [{ role: "viewer", version: 4, reason: REASON }]]) {
      const result = name === "block" ? blockOrganizationAction(ORG, input) : reactivateOrganizationAction(ORG, input);
      await expect(result).resolves.toMatchObject({ ok: false });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("every status and refusal code becomes a fixed kind, never the backend's text", () => {
  const CODES: Array<[status: number, code: string | undefined, failure: string, extra?: Record<string, unknown>, kept?: Record<string, unknown>]> = [
    [400, "INVALID_REASON", "invalid_reason", { fields: { reason: SECRET } }],
    [400, "INVALID_ORGANIZATION_ID", "invalid_id"],
    [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable", { standing: "legacy_holding" }, { standing: "legacy_holding" }],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable", { standing: "platform" }, { standing: "platform" }],
    [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
    [403, undefined, "forbidden"],
    [401, undefined, "session_ended"],
    [401, "AUTHENTICATION_REQUIRED", "session_ended"],
    [429, undefined, "rate_limited"],
    [404, undefined, "not_available"],
    [500, "STAFF_MEMBERS_INTERNAL_ERROR", "outcome_unknown"],
    [500, "STAFF_ORGANIZATION_BLOCK_INTERNAL_ERROR", "outcome_unknown"],
    [502, undefined, "outcome_unknown"],
    // A code of a member or team write staff no longer make is an unknown code: never a change reported as made, and its details are not kept.
    [409, "STALE_VERSION", "outcome_unknown", { currentVersion: 9 }],
    [409, "OWNER_HAS_RFPS", "outcome_unknown", { ownedRfpCount: 3, reverted: true }],
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

  it("maps the team read's refusals, and never calls a failed read a change that may be saved", async () => {
    const reads: Array<[number, string | undefined, string]> = [
      [404, "TEAM_NOT_FOUND", "team_not_found"],
      [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
      [404, undefined, "not_available"],
      [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable"],
      [400, "INVALID_TEAM_ID", "invalid_team_id"],
      [401, undefined, "session_ended"],
      [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
      [429, undefined, "rate_limited"],
      [500, "STAFF_TEAMS_INTERNAL_ERROR", "unavailable"],
      [502, undefined, "unavailable"],
    ];
    for (const [status, code, failure] of reads) {
      mockedFetch.mockResolvedValue(refusal(status, code));
      const result = await getManagedTeamAction(ORG, TEAM);
      expect(result).toMatchObject({ ok: false, failure, code: code ?? null });
      expect(JSON.stringify(result)).not.toMatch(/BACKEND|mongodb/);
    }
    mockedFetch.mockRejectedValue(new Error("ECONNRESET"));
    await expect(getManagedTeamAction(ORG, TEAM)).resolves.toEqual({ ok: false, failure: "unavailable", code: null });
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
  it("returns the member through the allowlist, and nothing else of the answer", async () => {
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, member: { ...member(), passwordHash: "x", twoFactorSecret: "y" }, version: 4, internal: SECRET }));
    const result = await getManagedMemberAction(ORG, USER);
    expect(result).toEqual({ ok: true, data: { member: member() } });
    // An answer without a version is a member all the same: nothing reads one now.
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, member: member() }));
    await expect(getManagedMemberAction(ORG, USER)).resolves.toEqual({ ok: true, data: { member: member() } });
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|twoFactorSecret|BACKEND/);
  });

  it("returns the team and its members through the allowlists, each member with their manager setting", async () => {
    mockedFetch.mockResolvedValue(
      ok({
        organizationId: ORG,
        team: { ...team({ memberCount: 250, managers: [{ id: USER, name: "Pat Planner", email: "pat@acme.example", passwordHash: SECRET }] }), createdBy: OTHER, secret: SECRET },
        members: [{ member: { ...member(), passwordHash: SECRET }, version: 4, isManager: true, token: SECRET }, { member: member({ userId: "not-an-id" }), version: 4 }, { member: member({ userId: OTHER }), version: "7" }],
      }),
    );
    const result = await getManagedTeamAction(ORG, TEAM);
    expect(result).toEqual({
      ok: true,
      data: {
        managersListed: 1,
        team: { id: TEAM, name: "West", archived: false, archivedAt: null, createdAt: "2026-10-01T00:00:00.000Z", memberCount: 250, managers: [{ id: USER, name: "Pat Planner", email: "pat@acme.example" }] },
        // A row without a usable id is left out; the count stays the backend's. A row's version is not read.
        members: [{ member: member(), isManager: true }, { member: member({ userId: OTHER }), isManager: false }],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/BACKEND|createdBy/);
  });

  it("never hands on the Owner, whatever the caller passes", async () => {
    mockedFetch.mockResolvedValue(account());
    for (const write of [undefined, "transfer", "block", "unblock", ["transfer"], { write: "transfer" }, true, 1, null]) {
      const result = await (getManagedOrganizationAction as (organizationId: string, extra?: unknown) => Promise<unknown>)(ORG, write);
      expect(result).toEqual({ ok: true, data: { id: ORG, name: "Acme Events", standing: "active", blocked: null } });
      expect(JSON.stringify(result)).not.toMatch(/Olive|olive@/);
    }
    expect(mockedFetch).toHaveBeenCalledTimes(9);
  });

  it("hands on the facts of the organization, with the block only while blocked", async () => {
    mockedFetch.mockResolvedValue(account());
    await expect(getManagedOrganizationAction(ORG)).resolves.toEqual({
      ok: true,
      data: { id: ORG, name: "Acme Events", standing: "active", blocked: null },
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

  it("returns each write's answer as the result the screen shows", async () => {
    mockedFetch.mockResolvedValue(WRITES[0].answer());
    await expect(WRITES[0].run()).resolves.toEqual({ ok: true, data: { answer: "organization", changed: true, blocked: true, blockedAt: "2026-11-20T09:00:00.000Z", sessionsEnded: 3 } });
    // Idempotent: nothing to change is still a success.
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, changed: false, blocked: false, blockedAt: null }));
    await expect(reactivateOrganizationAction(ORG, { reason: REASON })).resolves.toMatchObject({ ok: true, data: { changed: false, blocked: false } });
  });
});

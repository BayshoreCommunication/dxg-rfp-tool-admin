jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { auth } from "@/auth";
import type { ManagementFailure } from "@/lib/organizationManagement/management";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import {
  addTeamMemberAction,
  archiveTeamAction,
  createTeamAction,
  getManagedTeamAction,
  listActiveTeamsAction,
  listTeamCandidatesAction,
  removeTeamMemberAction,
  renameTeamAction,
  setMemberTeamsAction,
  setTeamManagerAction,
} from "./organizationManagement";

// The team half of app/actions/organizationManagement.ts (the member half is organizationManagement.test.ts).

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedAuth = auth as unknown as jest.Mock;

const ORG = "6b0000000000000000000002";
const USER = "6a0000000000000000000001";
const OTHER = "6a0000000000000000000009";
const TEAM = "6c0000000000000000000003";
const TEAM_B = "6c0000000000000000000004";
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
const ok = (data: unknown, status = 200) => jsonResponse(status, { success: true, data });
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
  roles: ["team_manager"],
  status: "active",
  teams: [],
  joinedAt: "2026-10-01T00:00:00.000Z",
  lastSignedInAt: null,
  ...change,
});
const team = (change: Record<string, unknown> = {}) => ({ id: TEAM, name: "West", archived: false, archivedAt: null, createdAt: "2026-10-01T00:00:00.000Z", memberCount: 1, managers: [], ...change });
const row = (change: Record<string, unknown> = {}, isManager = false) => ({ member: member(change), version: 4, isManager });
const teamAnswer = (teamChange: Record<string, unknown> = {}, members: unknown[] = [row()], status = 200) => ok({ organizationId: ORG, team: team(teamChange), members }, status);

type Case = { name: string; run: (organizationId?: string, teamId?: string, userId?: string) => Promise<{ ok: boolean }>; method: string; url: string; body?: Record<string, unknown>; answer: () => Response; ids: Array<"team" | "member"> };

/** Every team write with valid arguments, the request it makes and an answer that satisfies it. */
const WRITES: Case[] = [
  {
    name: "create",
    run: (o = ORG) => createTeamAction(o, { name: "  North  ", reason: REASON }),
    method: "POST",
    url: `${API}/teams`,
    body: { name: "North", reason: REASON },
    answer: () => teamAnswer({ name: "North", memberCount: 0 }, [], 201),
    ids: [],
  },
  {
    name: "rename",
    run: (o = ORG, t = TEAM) => renameTeamAction(o, t, { name: "North", reason: REASON }),
    method: "PATCH",
    url: `${API}/teams/${TEAM}`,
    body: { name: "North", reason: REASON },
    answer: () => teamAnswer({ name: "North" }),
    ids: ["team"],
  },
  {
    name: "archive",
    run: (o = ORG, t = TEAM) => archiveTeamAction(o, t, { reason: REASON }),
    method: "POST",
    url: `${API}/teams/${TEAM}/archive`,
    body: { reason: REASON },
    answer: () => teamAnswer({ archived: true, archivedAt: "2026-11-22T09:00:00.000Z" }),
    ids: ["team"],
  },
  {
    name: "add member",
    run: (o = ORG, t = TEAM) => addTeamMemberAction(o, t, { userId: USER, isManager: true, reason: REASON }),
    method: "POST",
    url: `${API}/teams/${TEAM}/members`,
    body: { userId: USER, isManager: true, reason: REASON },
    answer: () => teamAnswer({}, [row({}, true)], 201),
    ids: ["team"],
  },
  {
    name: "set manager",
    run: (o = ORG, t = TEAM, u = USER) => setTeamManagerAction(o, t, u, { isManager: false, reason: REASON }),
    method: "PATCH",
    url: `${API}/teams/${TEAM}/members/${USER}`,
    body: { isManager: false, reason: REASON },
    answer: () => teamAnswer(),
    ids: ["team", "member"],
  },
  {
    name: "remove member",
    run: (o = ORG, t = TEAM, u = USER) => removeTeamMemberAction(o, t, u, { reason: REASON }),
    method: "DELETE",
    url: `${API}/teams/${TEAM}/members/${USER}`,
    body: { reason: REASON },
    answer: () => teamAnswer({ memberCount: 0 }, []),
    ids: ["team", "member"],
  },
  {
    name: "member teams",
    run: (o = ORG, _t = TEAM, u = USER) => setMemberTeamsAction(o, u, { teamIds: [TEAM, TEAM_B], version: 4, reason: REASON }),
    method: "PUT",
    url: `${API}/members/${USER}/teams`,
    body: { teamIds: [TEAM, TEAM_B], version: 4, reason: REASON },
    answer: () => ok({ organizationId: ORG, changed: true, member: member({ teams: [{ id: TEAM, name: "West", archived: false, isManager: false }] }), version: 5 }),
    ids: ["member"],
  },
];

const membersPage = (members: unknown[]) => ok({ organizationId: ORG, members, pagination: { page: 1, perPage: 50, total: members.length, totalPages: 1 }, pendingInvitations: [], pendingInvitationsTotal: 0 });

const READS: Case[] = [
  { name: "team", run: (o = ORG, t = TEAM) => getManagedTeamAction(o, t), method: "GET", url: `${API}/teams/${TEAM}`, answer: () => teamAnswer(), ids: ["team"] },
  { name: "active teams", run: (o = ORG) => listActiveTeamsAction(o), method: "GET", url: `${API}/teams`, answer: () => ok({ organizationId: ORG, teams: [team()] }), ids: [] },
  { name: "candidates", run: (o = ORG, t = TEAM) => listTeamCandidatesAction(o, t, 1), method: "GET", url: `${API}/members`, answer: () => membersPage([member()]), ids: ["team"] },
];
const ALL = [...READS, ...WRITES];

beforeEach(() => {
  mockedFetch.mockReset();
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue({ user: { role: "admin" } });
});

describe("team management actions", () => {
  it("covers every team action", () => {
    expect(ALL).toHaveLength(10);
  });

  it.each(ALL)("$name: makes exactly one request, to its own route, uncached", async ({ run, method, url, body, answer }) => {
    mockedFetch.mockResolvedValue(answer());
    await expect(run()).resolves.toMatchObject({ ok: true });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(urlOf().endsWith(url)).toBe(true);
    expect(urlOf()).not.toMatch(/\?/);
    expect(initOf().method).toBe(method);
    expect(initOf().cache).toBe("no-store");
    if (body) expect(bodyOf()).toEqual(body);
    else expect(initOf().body).toBeUndefined();
  });

  it("removes a team member with a DELETE whose reason is in a JSON body, never in the address", async () => {
    mockedFetch.mockResolvedValue(teamAnswer({ memberCount: 0 }, []));
    await expect(removeTeamMemberAction(ORG, TEAM, USER, { reason: `  ${REASON}  ` })).resolves.toMatchObject({ ok: true });
    const init = initOf();
    expect(init.method).toBe("DELETE");
    expect(init.headers).toEqual({ Accept: "application/json", "Content-Type": "application/json" });
    expect(typeof init.body).toBe("string");
    expect(JSON.parse(String(init.body))).toEqual({ reason: REASON });
    expect(urlOf()).toMatch(new RegExp(`/teams/${TEAM}/members/${USER}$`));
    expect(urlOf()).not.toMatch(/reason|ticket/i);
  });
});

describe("the staff check comes first", () => {
  it.each(ALL)("$name: asks nothing when nobody is signed in, the session has ended, or the account is not staff", async ({ run }) => {
    mockedAuth.mockResolvedValue(null);
    await expect(run()).resolves.toEqual({ ok: false, failure: "session_ended", code: null });
    mockedAuth.mockResolvedValue({ user: { role: "admin" }, authError: "SessionExpired" });
    await expect(run()).resolves.toMatchObject({ ok: false });
    mockedAuth.mockResolvedValue({ user: { role: "user" } });
    await expect(run()).resolves.toEqual({ ok: false, failure: "forbidden", code: null });
    mockedAuth.mockRejectedValue(new Error("no session store"));
    await expect(run()).resolves.toEqual({ ok: false, failure: "session_ended", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(ALL)("$name: checks the session before the ids", async ({ run }) => {
    mockedAuth.mockResolvedValue({ user: { role: "user" } });
    await expect(run("not-an-id", "not-an-id", "not-an-id")).resolves.toEqual({ ok: false, failure: "forbidden", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("every id is checked before the backend is asked", () => {
  const BAD = ["", "abc", "6B0000000000000000000002", "6b000000000000000000000g", "6b00000000000000000000022", "../6b0000000000000000000002", `${ORG}/x`];

  it.each(ALL)("$name: refuses an organization id that is not 24 lower-case hex", async ({ run }) => {
    for (const bad of BAD) await expect(run(bad)).resolves.toEqual({ ok: false, failure: "invalid_id", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(ALL.filter(({ ids }) => ids.includes("team")))("$name: refuses a team id that is not one", async ({ run }) => {
    for (const bad of BAD) await expect(run(ORG, bad)).resolves.toEqual({ ok: false, failure: "invalid_team_id", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(WRITES.filter(({ ids }) => ids.includes("member")))("$name: refuses a member id that is not one", async ({ run }) => {
    for (const bad of BAD) await expect(run(ORG, TEAM, bad)).resolves.toEqual({ ok: false, failure: "invalid_id", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refuses a member to add that is not an id", async () => {
    for (const userId of [...BAD, undefined, 7, { $ne: null }]) {
      await expect(addTeamMemberAction(ORG, TEAM, { userId, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_request", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("checks every id in teamIds: one that is not an id refuses the whole request", async () => {
    for (const teamIds of [[TEAM, "abc"], [TEAM.toUpperCase()], [TEAM, 7], [TEAM, null], [{ $ne: null }], [`${TEAM}/x`], "all", undefined, null, { 0: TEAM }, Array.from({ length: 101 }, (_, index) => `6c${String(index).padStart(22, "0")}`)]) {
      await expect(setMemberTeamsAction(ORG, USER, { teamIds, version: 4, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_teams", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
    // An empty list is a list: the member is taken off every active team. A repeated id is sent once.
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, changed: true, member: member(), version: 5 }));
    await expect(setMemberTeamsAction(ORG, USER, { teamIds: [], version: 4, reason: REASON })).resolves.toMatchObject({ ok: true });
    expect(bodyOf().teamIds).toEqual([]);
    await setMemberTeamsAction(ORG, USER, { teamIds: [TEAM, TEAM_B, TEAM], version: 4, reason: REASON });
    expect(bodyOf(1).teamIds).toEqual([TEAM, TEAM_B]);
    // Exactly 100 is accepted.
    await setMemberTeamsAction(ORG, USER, { teamIds: Array.from({ length: 100 }, (_, index) => `6c${String(index).padStart(22, "0")}`), version: 4, reason: REASON });
    expect(bodyOf(2).teamIds).toHaveLength(100);
  });
});

describe("the body is rebuilt field by field", () => {
  const INPUTS: Record<string, Record<string, unknown>> = {
    create: { name: "North" },
    rename: { name: "North" },
    archive: {},
    "add member": { userId: USER, isManager: true },
    "set manager": { isManager: false },
    "remove member": {},
    "member teams": { teamIds: [TEAM, TEAM_B], version: 4 },
  };
  const send = (name: string, input: unknown) => {
    switch (name) {
      case "create":
        return createTeamAction(ORG, input);
      case "rename":
        return renameTeamAction(ORG, TEAM, input);
      case "archive":
        return archiveTeamAction(ORG, TEAM, input);
      case "add member":
        return addTeamMemberAction(ORG, TEAM, input);
      case "set manager":
        return setTeamManagerAction(ORG, TEAM, USER, input);
      case "remove member":
        return removeTeamMemberAction(ORG, TEAM, USER, input);
      default:
        return setMemberTeamsAction(ORG, USER, input);
    }
  };

  it.each(WRITES)("$name: drops every field the route does not take", async ({ name, answer, body }) => {
    mockedFetch.mockResolvedValue(answer());
    const extra = { organizationId: OTHER, teamId: TEAM_B, rfpIds: ["x"], proposalId: "y", createdBy: OTHER, archived: true, role: "owner", status: "active", $where: "1", __proto__: { admin: true } };
    await expect(send(name, { ...extra, ...INPUTS[name], reason: `  ${REASON}  ` })).resolves.toMatchObject({ ok: true });
    expect(bodyOf()).toEqual(body);
    expect(Object.keys(bodyOf()).sort()).toEqual(Object.keys(body ?? {}).sort());
  });

  it.each(WRITES)("$name: refuses a reason that is too short, too long or not text before any backend call", async ({ name }) => {
    for (const reason of ["", "too short", "   nine ch   ", "x".repeat(501), undefined, null, 12345678901, ["a reason in a list"]]) {
      await expect(send(name, { ...INPUTS[name], reason })).resolves.toEqual({ ok: false, failure: "invalid_reason", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(WRITES)("$name: refuses an input that is not an object", async ({ name }) => {
    for (const input of [undefined, null, "reason", 5, [{ reason: REASON }]]) await expect(send(name, input)).resolves.toMatchObject({ ok: false });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refuses a team name that is empty, too long or not text before any backend call", async () => {
    for (const name of ["", "   ", "x".repeat(121), undefined, null, 5, ["North"]]) {
      await expect(createTeamAction(ORG, { name, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_team_name", code: null });
      await expect(renameTeamAction(ORG, TEAM, { name, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_team_name", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
    mockedFetch.mockResolvedValue(teamAnswer({ name: "x".repeat(120) }));
    await expect(renameTeamAction(ORG, TEAM, { name: "x".repeat(120), reason: REASON })).resolves.toMatchObject({ ok: true });
  });

  it("sends isManager as a boolean only: true makes a manager, anything that is not a boolean is refused", async () => {
    for (const isManager of ["true", 1, null, {}, "yes"]) {
      await expect(addTeamMemberAction(ORG, TEAM, { userId: USER, isManager, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_request", code: null });
      await expect(setTeamManagerAction(ORG, TEAM, USER, { isManager, reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_request", code: null });
    }
    // The manager setting has no default on the route that sets it.
    await expect(setTeamManagerAction(ORG, TEAM, USER, { reason: REASON })).resolves.toEqual({ ok: false, failure: "invalid_request", code: null });
    expect(mockedFetch).not.toHaveBeenCalled();
    // Left out on an add, the member joins as a plain member.
    mockedFetch.mockResolvedValue(teamAnswer({}, [row()], 201));
    await expect(addTeamMemberAction(ORG, TEAM, { userId: USER, reason: REASON })).resolves.toMatchObject({ ok: true });
    expect(bodyOf()).toEqual({ userId: USER, isManager: false, reason: REASON });
  });

  it("refuses a version that is not a whole number from 1 before any backend call", async () => {
    for (const version of [undefined, null, "4", 0, -1, 1.5, Number.NaN]) {
      await expect(setMemberTeamsAction(ORG, USER, { teamIds: [TEAM], version, reason: REASON })).resolves.toEqual({ ok: false, failure: "version_required", code: null });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe("every status and refusal code becomes a fixed kind, never the backend's text", () => {
  // Every code the staff team routes answer with (backend docs/API.md, "Staff team management",
  // and manageOrganizationTeams.ts, manageTeams.ts, memberPolicy.ts), as a write gets it.
  const CODES: Array<[status: number, code: string | undefined, failure: ManagementFailure, extra?: Record<string, unknown>, kept?: Record<string, unknown>]> = [
    [400, "INVALID_ORGANIZATION_ID", "invalid_id"],
    [400, "INVALID_TEAM_ID", "invalid_team_id"],
    [400, "INVALID_MEMBER_ID", "invalid_id"],
    [400, "INVALID_REASON", "invalid_reason", { fields: { reason: SECRET } }],
    [400, "INVALID_TEAM_NAME", "invalid_team_name"],
    [400, "INVALID_TEAM_MANAGER", "invalid_request"],
    [400, "INVALID_TEAMS", "invalid_teams"],
    [400, "VERSION_REQUIRED", "version_required"],
    [400, "UNKNOWN_TEAMS", "unknown_teams", { unknownTeamIds: [TEAM_B, SECRET, 7] }, { unknownTeamIds: [TEAM_B] }],
    [401, "AUTHENTICATION_REQUIRED", "session_ended"],
    [401, undefined, "session_ended"],
    [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
    [403, undefined, "forbidden"],
    [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
    [404, "TEAM_NOT_FOUND", "team_not_found"],
    [404, "MEMBER_NOT_FOUND", "member_not_found"],
    [404, "TEAM_MEMBER_NOT_FOUND", "team_member_not_found"],
    [404, undefined, "not_available"],
    [409, "TEAM_NAME_TAKEN", "team_name_taken"],
    [409, "TEAM_ARCHIVED", "team_archived"],
    [409, "TEAM_MEMBER_EXISTS", "team_member_exists"],
    [409, "STALE_VERSION", "stale_version", { currentVersion: 9 }],
    [409, "MEMBER_REMOVED", "member_removed"],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable", { standing: "legacy_holding" }, { standing: "legacy_holding" }],
    [422, "TEAM_MANAGER_ROLE_REQUIRED", "team_manager_role_required"],
    [429, undefined, "rate_limited"],
    [503, "TEAMS_UNAVAILABLE", "teams_unavailable"],
    [500, "STAFF_TEAMS_INTERNAL_ERROR", "outcome_unknown"],
    [500, undefined, "outcome_unknown"],
    [502, undefined, "outcome_unknown"],
    [503, undefined, "outcome_unknown"],
  ];

  it.each(CODES)("a write answered %i %s is %s", async (status, code, failure, extra = {}, kept = {}) => {
    mockedFetch.mockResolvedValue(refusal(status, code, extra));
    // The member's teams route answers with every one of these but the team codes; the mapping is one table.
    const result = await setMemberTeamsAction(ORG, USER, { teamIds: [TEAM], version: 4, reason: REASON });
    expect(result).toEqual({ ok: false, failure, code: code ?? null, ...kept });
    expect(JSON.stringify(result)).not.toMatch(/BACKEND|mongodb/);
  });

  it.each(WRITES)("$name: every code maps the same way on this route, and its text is never passed on", async ({ run }) => {
    for (const [status, code, failure] of CODES) {
      mockedFetch.mockResolvedValue(refusal(status, code));
      const result = await run();
      // MEMBER_NOT_FOUND has its own wording where it means "not an active member" (below).
      if (code === "MEMBER_NOT_FOUND") expect(result).toMatchObject({ ok: false, code });
      else expect(result).toMatchObject({ ok: false, failure, code: code ?? null });
      expect(JSON.stringify(result)).not.toMatch(/BACKEND|mongodb/);
    }
  });

  it("words MEMBER_NOT_FOUND as 'not an active member' where the backend means that, keeping its code", async () => {
    mockedFetch.mockResolvedValue(refusal(404, "MEMBER_NOT_FOUND"));
    await expect(addTeamMemberAction(ORG, TEAM, { userId: USER, reason: REASON })).resolves.toEqual({ ok: false, failure: "member_not_active", code: "MEMBER_NOT_FOUND" });
    await expect(setTeamManagerAction(ORG, TEAM, USER, { isManager: true, reason: REASON })).resolves.toEqual({ ok: false, failure: "member_not_active", code: "MEMBER_NOT_FOUND" });
    // On a member's teams it means the person is not a member at all.
    await expect(setMemberTeamsAction(ORG, USER, { teamIds: [TEAM], version: 4, reason: REASON })).resolves.toEqual({ ok: false, failure: "member_not_found", code: "MEMBER_NOT_FOUND" });
  });

  it("maps the team read's refusals, and never calls a failed read a change that may be saved", async () => {
    const reads: Array<[number, string | undefined, ManagementFailure]> = [
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
    mockedFetch.mockResolvedValue(refusal(429, undefined, {}, { "Retry-After": "120" }));
    await expect(archiveTeamAction(ORG, TEAM, { reason: REASON })).resolves.toEqual({ ok: false, failure: "rate_limited", code: null, retryAfterSeconds: 120 });
  });

  it.each(WRITES)("$name: a write that got no readable answer may have been saved, and says so", async ({ run }) => {
    mockedFetch.mockRejectedValue(new Error("ECONNRESET"));
    await expect(run()).resolves.toEqual({ ok: false, failure: "outcome_unknown", code: null });
    mockedFetch.mockResolvedValue(jsonResponse(200, "<html>ok</html>"));
    await expect(run()).resolves.toEqual({ ok: false, failure: "outcome_unknown", code: null });
    mockedFetch.mockResolvedValue(ok({ organizationId: OTHER, team: team(), members: [], changed: true, member: member(), version: 5 }));
    await expect(run()).resolves.toEqual({ ok: false, failure: "outcome_unknown", code: null });
    mockedFetch.mockResolvedValue({ ok: true, status: 200, json: async () => Promise.reject(new Error("not json")), headers: { get: () => null } } as unknown as Response);
    await expect(run()).resolves.toEqual({ ok: false, failure: "outcome_unknown", code: null });
  });

  it("treats an answer that says the opposite of what was asked as not confirmed", async () => {
    const unknown = { ok: false, failure: "outcome_unknown", code: null };
    // Another team, another name, a team that is not archived, a member still listed, the other manager setting.
    mockedFetch.mockResolvedValue(teamAnswer({ id: TEAM_B }));
    await expect(archiveTeamAction(ORG, TEAM, { reason: REASON })).resolves.toEqual(unknown);
    mockedFetch.mockResolvedValue(teamAnswer({ name: "South" }));
    await expect(renameTeamAction(ORG, TEAM, { name: "North", reason: REASON })).resolves.toEqual(unknown);
    await expect(createTeamAction(ORG, { name: "North", reason: REASON })).resolves.toEqual(unknown);
    mockedFetch.mockResolvedValue(teamAnswer({ archived: false }));
    await expect(archiveTeamAction(ORG, TEAM, { reason: REASON })).resolves.toEqual(unknown);
    mockedFetch.mockResolvedValue(teamAnswer({}, [row()]));
    await expect(removeTeamMemberAction(ORG, TEAM, USER, { reason: REASON })).resolves.toEqual(unknown);
    mockedFetch.mockResolvedValue(teamAnswer({}, [row({}, false)]));
    await expect(setTeamManagerAction(ORG, TEAM, USER, { isManager: true, reason: REASON })).resolves.toEqual(unknown);
    await expect(addTeamMemberAction(ORG, TEAM, { userId: USER, isManager: true, reason: REASON })).resolves.toEqual(unknown);
    // A member the answer does not list (a team of more than 200) is not a contradiction.
    mockedFetch.mockResolvedValue(teamAnswer({ memberCount: 250 }, [row({ userId: OTHER })]));
    await expect(setTeamManagerAction(ORG, TEAM, USER, { isManager: true, reason: REASON })).resolves.toMatchObject({ ok: true });
    // Another member's answer to a member's teams.
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, changed: true, member: member({ userId: OTHER }), version: 5 }));
    await expect(setMemberTeamsAction(ORG, USER, { teamIds: [TEAM], version: 4, reason: REASON })).resolves.toEqual(unknown);
  });
});

describe("what the answers hand on", () => {
  it("returns the team and its members through the allowlists, each member with their version and manager setting", async () => {
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
        // A row without a usable id or version is left out; the count stays the backend's.
        members: [{ member: member(), version: 4, isManager: true }],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/BACKEND|createdBy/);
  });

  it("hands on only the id and the name of each active team, from the content browser's teams read", async () => {
    mockedFetch.mockResolvedValue(
      ok({ organizationId: ORG, teams: [team({ managers: [{ id: USER, name: "Pat", email: "pat@acme.example" }] }), team({ id: TEAM_B, name: "Old", archived: true }), team({ id: "not-an-id", name: "Odd" })] }),
    );
    await expect(listActiveTeamsAction(ORG)).resolves.toEqual({ ok: true, data: { choices: [{ id: TEAM, name: "West" }], cut: false } });
    // A list at the backend's bound is handed on as one that may be cut, whatever is left of it after the archived teams go.
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, teams: Array.from({ length: 500 }, (_, index) => team({ id: `6c${String(index).padStart(22, "0")}`, name: `T ${index}`, archived: index > 0 })) }));
    await expect(listActiveTeamsAction(ORG)).resolves.toMatchObject({ ok: true, data: { choices: [{ name: "T 0" }], cut: true } });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    mockedFetch.mockClear();
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, teams: [team()] }));
    await listActiveTeamsAction(ORG);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    for (const [status, code, failure] of [[404, "ORGANIZATION_NOT_FOUND", "organization_not_found"], [404, undefined, "not_available"], [429, undefined, "rate_limited"], [401, undefined, "session_ended"], [500, undefined, "unavailable"]] as const) {
      mockedFetch.mockResolvedValue(refusal(status, code));
      await expect(listActiveTeamsAction(ORG)).resolves.toEqual({ ok: false, failure, code: null });
    }
  });

  it("lists only the members of one page who can join the team, and counts the rest without naming them", async () => {
    const onTeam = [{ id: TEAM, name: "West", archived: false, isManager: false }];
    mockedFetch.mockResolvedValue(
      membersPage([
        member(),
        member({ userId: OTHER, name: "Already Here", teams: onTeam }),
        member({ userId: "6a0000000000000000000003", name: "Dee Deactivated", status: "suspended" }),
        member({ userId: "6a0000000000000000000004", name: "Ivy Invited", status: "invited" }),
        member({ userId: "6a0000000000000000000005", name: "Vic Viewer", roles: ["viewer"], teams: [{ id: TEAM_B, name: "East", archived: false, isManager: false }] }),
      ]),
    );
    const result = await listTeamCandidatesAction(ORG, TEAM, 2);
    expect(urlOf()).toMatch(/\/members\?page=2$/);
    expect(result).toEqual({
      ok: true,
      data: {
        candidates: [
          { userId: USER, name: "Pat Planner", email: "pat@acme.example", roles: ["team_manager"], status: "active" },
          { userId: "6a0000000000000000000005", name: "Vic Viewer", email: "pat@acme.example", roles: ["viewer"], status: "active" },
        ],
        notEligibleCount: 3,
        pagination: { page: 1, perPage: 50, total: 5, totalPages: 1 },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/Already Here|Dee|Ivy|teams/);
    // Anything but a whole page number asks for page 1, and nothing else reaches the address.
    for (const page of ["2", 0, -1, 1.5, null, undefined, { page: 3 }, "1&search=x"]) {
      mockedFetch.mockClear();
      await listTeamCandidatesAction(ORG, TEAM, page);
      expect(urlOf().endsWith(`${API}/members`)).toBe(true);
    }
  });

  it("returns each write's answer as the result the screen shows", async () => {
    mockedFetch.mockResolvedValue(teamAnswer({ name: "North", memberCount: 0 }, [], 201));
    await expect(createTeamAction(ORG, { name: "North", reason: REASON })).resolves.toMatchObject({ ok: true, data: { answer: "team", team: { team: { id: TEAM, name: "North", memberCount: 0 }, members: [] } } });
    mockedFetch.mockResolvedValue(ok({ organizationId: ORG, changed: false, member: member({ teams: [{ id: TEAM, name: "West", archived: false, isManager: true }] }), version: 5 }));
    await expect(setMemberTeamsAction(ORG, USER, { teamIds: [TEAM], version: 4, reason: REASON })).resolves.toMatchObject({
      ok: true,
      data: { answer: "member", changed: false, version: 5, member: { userId: USER, teams: [{ id: TEAM, name: "West", archived: false, isManager: true }] } },
    });
  });
});

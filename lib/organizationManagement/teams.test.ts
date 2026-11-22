import type { Member } from "@/lib/organizationContent/content";
import { createWriteGate, type WriteGateState } from "@/lib/organizationManagement/confirmGate";
import {
  managementFailure,
  managementFailureCopy,
  parseManagedMember,
  refusalOf,
  refused,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementFailure,
  type ManagementResult,
} from "@/lib/organizationManagement/management";
import {
  activeTeamChoices,
  ARCHIVE_EFFECTS,
  ARCHIVED_TEAM_NOTE,
  canJoinTeam,
  checkTeamDraft,
  currentTeams,
  emptyTeamDraft,
  holdsTeamManagerRole,
  initialTeamIds,
  isTeamCandidate,
  loadCreateTeamPage,
  loadMemberTeamsPage,
  loadTeamMemberWritePage,
  loadTeamPage,
  loadTeamWritePage,
  managerListNote,
  managerNote,
  MANAGER_REACH,
  MEMBER_TEAMS_EFFECTS,
  memberListNote,
  memberTeamsNote,
  memberTeamsOffered,
  memberTeamsPath,
  NO_SESSION_ENDED,
  parseManagedTeam,
  parseTeamAnswer,
  TEAM_WRITE_COPY,
  TEAM_WRITE_HINTS,
  TEAM_WRITES,
  teamCreatePath,
  teamFlowKey,
  teamIdsOf,
  teamManagementPath,
  teamMemberWritePath,
  teamMemberWritesFor,
  teamNameOf,
  teamResultSummary,
  teamReviewLines,
  teamsChange,
  teamWritePath,
  teamWritesFor,
  type ManagedTeam,
  type TeamAnswer,
  type TeamChoice,
  type TeamMemberWrite,
  type TeamOnlyWrite,
  type TeamReads,
  type TeamWrite,
} from "@/lib/organizationManagement/teams";

const ORG = "6b0000000000000000000002";
const USER = "6a0000000000000000000001";
const OTHER = "6a0000000000000000000009";
const TEAM = "6c0000000000000000000003";
const TEAM_B = "6c0000000000000000000004";
const TEAM_OLD = "6c0000000000000000000005";
const REASON = "Requested by the account owner in ticket 4411.";

const memberView = (change: Record<string, unknown> = {}) => ({
  userId: USER,
  name: "Pat Planner",
  email: "pat@acme.example",
  roles: ["team_manager"],
  status: "active",
  teams: [
    { id: TEAM, name: "West", archived: false, isManager: true },
    { id: TEAM_OLD, name: "Old Guard", archived: true, isManager: false },
  ],
  joinedAt: "2026-10-01T00:00:00.000Z",
  lastSignedInAt: null,
  ...change,
});
const managed = (change: Record<string, unknown> = {}, version = 4): ManagedMember => {
  const view = memberView(change);
  return parseManagedMember({ organizationId: ORG, member: view, version }, ORG, view.userId) as ManagedMember;
};
const teamView = (change: Record<string, unknown> = {}) => ({ id: TEAM, name: "West", archived: false, archivedAt: null, createdAt: "2026-10-01T00:00:00.000Z", memberCount: 1, managers: [], ...change });
const teamData = (teamChange: Record<string, unknown> = {}, members: unknown[] = [{ member: memberView(), version: 4, isManager: true }]) => ({ organizationId: ORG, team: teamView(teamChange), members });
const managedTeam = (teamChange: Record<string, unknown> = {}, members?: unknown[]): ManagedTeam => parseManagedTeam(teamData(teamChange, members), ORG, TEAM) as ManagedTeam;
const organization = (change: Partial<ManagedOrganization> = {}): ManagedOrganization => ({ id: ORG, name: "Acme Events", standing: "active", blocked: null, owner: null, ...change });
const CHOICES: TeamChoice[] = [
  { id: TEAM, name: "West" },
  { id: TEAM_B, name: "East" },
];

describe("addresses and what a team write carries", () => {
  it("builds every team address outside the view-only content browser", () => {
    expect(teamCreatePath(ORG)).toBe(`/organization-management/${ORG}/teams/new`);
    expect(teamManagementPath(ORG, TEAM)).toBe(`/organization-management/${ORG}/teams/${TEAM}`);
    expect(teamWritePath(ORG, TEAM, "rename")).toBe(`/organization-management/${ORG}/teams/${TEAM}/rename`);
    expect(teamWritePath(ORG, TEAM, "archive")).toBe(`/organization-management/${ORG}/teams/${TEAM}/archive`);
    expect(teamWritePath(ORG, TEAM, "addMember")).toBe(`/organization-management/${ORG}/teams/${TEAM}/members/add`);
    expect(teamMemberWritePath(ORG, TEAM, USER, "removeMember")).toBe(`/organization-management/${ORG}/teams/${TEAM}/members/${USER}/remove`);
    expect(teamMemberWritePath(ORG, TEAM, USER, "makeManager")).toBe(`/organization-management/${ORG}/teams/${TEAM}/members/${USER}/make-manager`);
    expect(teamMemberWritePath(ORG, TEAM, USER, "removeManager")).toBe(`/organization-management/${ORG}/teams/${TEAM}/members/${USER}/remove-manager`);
    expect(memberTeamsPath(ORG, USER)).toBe(`/organization-management/${ORG}/members/${USER}/teams`);
    for (const path of [teamCreatePath(ORG), teamManagementPath(ORG, TEAM), memberTeamsPath(ORG, USER)]) expect(path.startsWith("/organizations/")).toBe(false);
    // Nothing typed into an address reaches it unescaped.
    expect(teamManagementPath("a/b", "c?d")).toBe("/organization-management/a%2Fb/teams/c%3Fd");
  });

  it("takes a team name of 1 to 120 characters after trimming", () => {
    expect(teamNameOf("  North  ")).toBe("North");
    expect(teamNameOf("x".repeat(120))).toHaveLength(120);
    for (const value of ["", "   ", "x".repeat(121), null, undefined, 7, ["North"]]) expect(teamNameOf(value)).toBeNull();
  });

  it("takes a list of at most 100 team ids, each a real id, each once", () => {
    expect(teamIdsOf([])).toEqual([]);
    expect(teamIdsOf([TEAM, TEAM_B, TEAM])).toEqual([TEAM, TEAM_B]);
    const many = (count: number) => Array.from({ length: count }, (_, index) => `6c${String(index).padStart(22, "0")}`);
    expect(teamIdsOf(many(100))).toHaveLength(100);
    for (const value of [many(101), [TEAM, "abc"], [TEAM.toUpperCase()], [TEAM, 7], "all", null, undefined, { 0: TEAM }]) expect(teamIdsOf(value)).toBeNull();
  });
});

describe("reading a team", () => {
  it("reads the team through the Teams list's allowlist and each member through the member read's", () => {
    const team = parseManagedTeam(
      {
        organizationId: ORG,
        team: { ...teamView({ memberCount: 2, managers: [{ id: USER, name: "Pat Planner", email: "pat@acme.example", hash: "x" }] }), createdBy: OTHER },
        members: [
          { member: { ...memberView(), passwordHash: "x" }, version: 4, isManager: true, token: "x" },
          { member: memberView({ userId: OTHER, name: "Vic Viewer", roles: ["viewer"], teams: [] }), version: 2 },
        ],
      },
      ORG,
      TEAM,
    );
    expect(team?.team).toEqual({ id: TEAM, name: "West", archived: false, archivedAt: null, createdAt: "2026-10-01T00:00:00.000Z", memberCount: 2, managers: [{ id: USER, name: "Pat Planner", email: "pat@acme.example" }] });
    expect(team?.members.map((entry) => [entry.member.userId, entry.version, entry.isManager])).toEqual([[USER, 4, true], [OTHER, 2, false]]);
    expect(JSON.stringify(team)).not.toMatch(/passwordHash|token|createdBy|hash/);
  });

  it("shows nothing for another organization, another team, or an answer without a team or a member list", () => {
    expect(parseManagedTeam(teamData(), OTHER.replace("6a", "6b"), TEAM)).toBeNull();
    expect(parseManagedTeam(teamData({ id: TEAM_B }), ORG, TEAM)).toBeNull();
    expect(parseManagedTeam(teamData({ id: "not-an-id" }), ORG)).toBeNull();
    expect(parseManagedTeam({ organizationId: ORG, members: [] }, ORG, TEAM)).toBeNull();
    expect(parseManagedTeam({ organizationId: ORG, team: teamView() }, ORG, TEAM)).toBeNull();
    for (const data of [null, undefined, "team", [], 5]) expect(parseManagedTeam(data, ORG, TEAM)).toBeNull();
    // A create has no team id to hold the answer to: any team of the organization is read.
    expect(parseManagedTeam(teamData({ id: TEAM_B }), ORG)?.team.id).toBe(TEAM_B);
  });

  it("leaves out a member row it cannot read, and keeps the backend's count", () => {
    const team = managedTeam({ memberCount: 3 }, [{ member: memberView(), version: 4, isManager: false }, { member: memberView({ userId: "x" }), version: 4 }, { member: memberView({ userId: OTHER }), version: "2" }, null]);
    expect(team.members).toHaveLength(1);
    expect(team.team.memberCount).toBe(3);
  });

  it("refuses an answer to a write that says the opposite of what was asked", () => {
    expect(parseTeamAnswer(teamData({ name: "North" }), ORG, { teamId: TEAM, name: "North" })).toMatchObject({ answer: "team" });
    expect(parseTeamAnswer(teamData({ name: "South" }), ORG, { teamId: TEAM, name: "North" })).toBeNull();
    expect(parseTeamAnswer(teamData({ archived: true }), ORG, { teamId: TEAM, archived: true })).toMatchObject({ answer: "team" });
    expect(parseTeamAnswer(teamData(), ORG, { teamId: TEAM, archived: true })).toBeNull();
    expect(parseTeamAnswer(teamData(), ORG, { teamId: TEAM, absent: USER })).toBeNull();
    expect(parseTeamAnswer(teamData(), ORG, { teamId: TEAM, absent: OTHER })).toMatchObject({ answer: "team" });
    expect(parseTeamAnswer(teamData(), ORG, { teamId: TEAM, listed: { userId: USER, isManager: false } })).toBeNull();
    expect(parseTeamAnswer(teamData(), ORG, { teamId: TEAM, listed: { userId: USER, isManager: true } })).toMatchObject({ answer: "team" });
    // A member the answer does not list (it lists at most 200) contradicts nothing.
    expect(parseTeamAnswer(teamData(), ORG, { teamId: TEAM, listed: { userId: OTHER, isManager: true } })).toMatchObject({ answer: "team" });
  });
});

describe("the team refusals", () => {
  // Every code the staff team routes answer with (backend docs/API.md, "Staff team management", and source).
  const CODES: Array<[status: number, code: string, failure: ManagementFailure]> = [
    [400, "INVALID_ORGANIZATION_ID", "invalid_id"],
    [400, "INVALID_TEAM_ID", "invalid_team_id"],
    [400, "INVALID_MEMBER_ID", "invalid_id"],
    [400, "INVALID_REASON", "invalid_reason"],
    [400, "INVALID_TEAM_NAME", "invalid_team_name"],
    [400, "INVALID_TEAM_MANAGER", "invalid_request"],
    [400, "INVALID_TEAMS", "invalid_teams"],
    [400, "VERSION_REQUIRED", "version_required"],
    [400, "UNKNOWN_TEAMS", "unknown_teams"],
    [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
    [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
    [404, "TEAM_NOT_FOUND", "team_not_found"],
    [404, "MEMBER_NOT_FOUND", "member_not_found"],
    [404, "TEAM_MEMBER_NOT_FOUND", "team_member_not_found"],
    [409, "TEAM_NAME_TAKEN", "team_name_taken"],
    [409, "TEAM_ARCHIVED", "team_archived"],
    [409, "TEAM_MEMBER_EXISTS", "team_member_exists"],
    [409, "STALE_VERSION", "stale_version"],
    [409, "MEMBER_REMOVED", "member_removed"],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable"],
    [422, "TEAM_MANAGER_ROLE_REQUIRED", "team_manager_role_required"],
    [503, "TEAMS_UNAVAILABLE", "teams_unavailable"],
    [500, "STAFF_TEAMS_INTERNAL_ERROR", "outcome_unknown"],
  ];

  it.each(CODES)("%i %s is %s", (status, code, failure) => {
    expect(managementFailure(status, code, "write")).toBe(failure);
  });

  it("calls a server error on a team write 'may have been saved', and on the team read only 'unavailable'", () => {
    expect(managementFailure(500, "STAFF_TEAMS_INTERNAL_ERROR", "read")).toBe("unavailable");
    for (const status of [500, 502, 503, 504]) expect(managementFailure(status, null, "write")).toBe("outcome_unknown");
    // The one 503 with a code is answered before anything is written.
    expect(managementFailureCopy(refused("teams_unavailable")).message).toMatch(/it changed nothing/);
    expect(managementFailure(429, null, "write")).toBe("rate_limited");
    expect(managementFailure(401, null, "write")).toBe("session_ended");
  });

  it("keeps the ids of UNKNOWN_TEAMS that are ids, and nothing else the backend wrote", () => {
    const secret = "BACKEND TEXT mongodb://host/secret";
    expect(refusalOf(400, { code: "UNKNOWN_TEAMS", message: secret, unknownTeamIds: [TEAM_B, secret, 5, null, TEAM_OLD] }, null, "write")).toEqual({
      ok: false,
      failure: "unknown_teams",
      code: "UNKNOWN_TEAMS",
      unknownTeamIds: [TEAM_B, TEAM_OLD],
    });
    expect(refusalOf(400, { code: "UNKNOWN_TEAMS", unknownTeamIds: secret }, null, "write")).toEqual({ ok: false, failure: "unknown_teams", code: "UNKNOWN_TEAMS" });
    // Only that code carries them.
    expect(refusalOf(409, { code: "TEAM_ARCHIVED", unknownTeamIds: [TEAM_B] }, null, "write")).toEqual({ ok: false, failure: "team_archived", code: "TEAM_ARCHIVED" });
  });

  it("words every team refusal for a person, in fixed text of its own", () => {
    const failures: ManagementFailure[] = [
      "invalid_team_id", "invalid_team_name", "invalid_teams", "unknown_teams", "team_not_found", "team_member_not_found", "member_not_active",
      "team_name_taken", "team_archived", "team_member_exists", "team_manager_role_required", "teams_unavailable",
    ];
    const titles = new Set<string>();
    for (const failure of failures) {
      const copy = managementFailureCopy(refused(failure));
      expect(copy.title.length).toBeGreaterThan(5);
      expect(copy.message.length).toBeGreaterThan(20);
      expect(`${copy.title} ${copy.message}`).not.toMatch(/[A-Z]{3,}_[A-Z_]+|undefined|null|\bRFPs?\b/);
      expect(copy.title).not.toBe("Unable to load this page");
      titles.add(copy.title);
    }
    expect(titles.size).toBe(failures.length);
    // Each says nothing was changed, except the one that is about an address.
    for (const failure of failures.filter((entry) => entry !== "invalid_team_id" && entry !== "teams_unavailable")) expect(managementFailureCopy(refused(failure)).message).toMatch(/Nothing was changed/);
    expect(managementFailureCopy(refused("team_archived")).message).toMatch(/no un-archive/);
    expect(managementFailureCopy(refused("team_manager_role_required")).title).toMatch(/Team Manager role/);
    expect(managementFailureCopy(refused("member_not_active")).title).toBe("Not an active member of this organization");
  });
});

describe("which writes a team's state offers", () => {
  const TABLE: Array<[archived: boolean, writes: TeamOnlyWrite[]]> = [
    [false, ["rename", "addMember", "archive"]],
    [true, []],
  ];
  it.each(TABLE)("archived %j: %j", (archived, writes) => {
    expect(teamWritesFor({ archived })).toEqual(writes);
  });

  it("offers an archived team nothing, and says it cannot be changed or un-archived", () => {
    expect(teamWritesFor({ archived: true })).toEqual([]);
    expect(ARCHIVED_TEAM_NOTE).toMatch(/can't be renamed, archived again or have its members changed/);
    expect(ARCHIVED_TEAM_NOTE).toMatch(/can't be un-archived/);
  });
});

describe("which writes a member of a team offers", () => {
  // [is manager of the team, roles, status, team archived] -> the writes offered, in order.
  const TABLE: Array<[isManager: boolean, roles: string[], status: string, archived: boolean, writes: TeamMemberWrite[]]> = [
    // An active member with the Team Manager role who is not a manager: can be made one.
    [false, ["team_manager"], "active", false, ["makeManager", "removeMember"]],
    // Without the role: never offered (422 TEAM_MANAGER_ROLE_REQUIRED), whatever else they hold.
    [false, ["planner"], "active", false, ["removeMember"]],
    [false, ["viewer"], "active", false, ["removeMember"]],
    [false, ["organization_admin"], "active", false, ["removeMember"]],
    [false, ["owner"], "active", false, ["removeMember"]],
    [false, [], "active", false, ["removeMember"]],
    // A manager: can stop being one, with or without the role now, active or not.
    [true, ["team_manager"], "active", false, ["removeManager", "removeMember"]],
    [true, ["planner"], "active", false, ["removeManager", "removeMember"]],
    [true, ["team_manager"], "suspended", false, ["removeManager", "removeMember"]],
    [true, ["team_manager"], "removed", false, ["removeManager", "removeMember"]],
    // Not active: can't be made a manager (404 MEMBER_NOT_FOUND), can still be taken off the team.
    [false, ["team_manager"], "suspended", false, ["removeMember"]],
    [false, ["team_manager"], "deactivated", false, ["removeMember"]],
    [false, ["team_manager"], "invited", false, ["removeMember"]],
    [false, ["team_manager"], "removed", false, ["removeMember"]],
    [false, ["team_manager"], "something_new", false, ["removeMember"]],
    // An archived team: nothing, for anyone.
    [false, ["team_manager"], "active", true, []],
    [true, ["team_manager"], "active", true, []],
    [false, ["planner"], "suspended", true, []],
  ];

  it.each(TABLE)("manager %j, roles %j, status %j, team archived %j: %j", (isManager, roles, status, archived, writes) => {
    expect(teamMemberWritesFor({ isManager, roles, status }, { archived })).toEqual(writes);
  });

  it("never offers both manager writes, and never 'make manager' without the Team Manager role", () => {
    for (const [isManager, roles, status, archived] of TABLE) {
      const writes = teamMemberWritesFor({ isManager, roles, status }, { archived });
      expect(writes.includes("makeManager") && writes.includes("removeManager")).toBe(false);
      if (writes.includes("makeManager")) expect(holdsTeamManagerRole(roles) && status === "active" && !isManager).toBe(true);
    }
  });

  it("says why a member can't be made a manager, and nothing when they can or already are", () => {
    expect(managerNote({ isManager: false, roles: ["planner"], status: "active" })).toMatch(/does not hold the Team Manager role/i);
    expect(managerNote({ isManager: false, roles: ["team_manager"], status: "suspended" })).toMatch(/Not an active member/);
    expect(managerNote({ isManager: false, roles: ["team_manager"], status: "active" })).toBeNull();
    expect(managerNote({ isManager: true, roles: ["planner"], status: "suspended" })).toBeNull();
  });

  it("sets a member's teams for every member but a removed one, a deactivated one included", () => {
    expect(["active", "suspended", "deactivated", "invited", "removed", "something_new", ""].map((status) => memberTeamsOffered({ status }))).toEqual([true, true, true, true, false, false, false]);
  });
});

describe("who can join a team, and which teams can be chosen", () => {
  const candidate = (change: Partial<Member> = {}) => ({ ...managed().member, teams: [], ...change });

  it("lets only an active member who is not on the team already join it", () => {
    expect(canJoinTeam(candidate(), TEAM)).toBe(true);
    expect(canJoinTeam(candidate({ roles: ["viewer"] }), TEAM)).toBe(true);
    expect(canJoinTeam(candidate({ teams: [{ id: TEAM_B, name: "East", archived: false, isManager: false }] }), TEAM)).toBe(true);
    expect(canJoinTeam(candidate({ teams: [{ id: TEAM, name: "West", archived: false, isManager: false }] }), TEAM)).toBe(false);
    for (const status of ["suspended", "deactivated", "invited", "removed", "other"]) expect(canJoinTeam(candidate({ status }), TEAM)).toBe(false);
    expect(canJoinTeam(candidate({ userId: "not-an-id" }), TEAM)).toBe(false);
    expect(isTeamCandidate(candidate())).toBe(true);
    expect(isTeamCandidate(candidate({ status: "suspended" }))).toBe(false);
  });

  it("offers 'make manager' only for a member who holds the Team Manager role", () => {
    expect(holdsTeamManagerRole(["team_manager"])).toBe(true);
    for (const roles of [["planner"], ["owner"], ["organization_admin"], ["viewer"], []]) expect(holdsTeamManagerRole(roles)).toBe(false);
    const draft = { ...emptyTeamDraft(), reason: REASON, makeManager: true };
    const withRole = checkTeamDraft("addMember", { ...draft, target: candidate() });
    expect(withRole).toMatchObject({ ok: true, request: { isManager: true } });
    // Ticked for someone without the role (the choice changed after the tick): never sent as a manager.
    const withoutRole = checkTeamDraft("addMember", { ...draft, target: candidate({ roles: ["planner"] }) });
    expect(withoutRole).toMatchObject({ ok: true, request: { isManager: false } });
  });

  it("chooses a member's teams only from the organization's active teams", () => {
    const list = { teams: [managedTeam().team, { ...managedTeam().team, id: TEAM_OLD, name: "Old Guard", archived: true }, { ...managedTeam().team, id: "x", name: "Odd" }] };
    expect(activeTeamChoices(list)).toEqual([{ id: TEAM, name: "West" }]);
    const member = managed().member;
    expect(currentTeams(member).active.map((team) => team.name)).toEqual(["West"]);
    expect(currentTeams(member).archived.map((team) => team.name)).toEqual(["Old Guard"]);
    expect(initialTeamIds(member, CHOICES)).toEqual([TEAM]);
    // A team the member read names but the list no longer offers is not ticked.
    expect(initialTeamIds(member, [{ id: TEAM_B, name: "East" }])).toEqual([]);
    expect(teamsChange(member, [TEAM_B], CHOICES)).toEqual({ joins: ["East"], leaves: ["West"], stays: [] });
    expect(teamsChange(member, [TEAM, TEAM_B], CHOICES)).toEqual({ joins: ["East"], leaves: [], stays: ["West"] });
    expect(teamsChange(member, [], CHOICES)).toEqual({ joins: [], leaves: ["West"], stays: [] });
  });
});

describe("lists the backend cuts short", () => {
  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ member: memberView({ userId: `6a${String(index).padStart(22, "0")}` }), version: 1, isManager: false }));

  it("says 'showing the first N' when the member list is shorter than the count, and nothing when it is whole", () => {
    expect(memberListNote(managedTeam({ memberCount: 1 }))).toBeNull();
    expect(memberListNote(managedTeam({ memberCount: 0 }, []))).toBeNull();
    expect(memberListNote(managedTeam({ memberCount: 1234 }, rows(200)))).toBe("Showing the first 200 of 1,234 members. The server lists at most 200 members of a team.");
    expect(memberListNote(managedTeam({ memberCount: 3 }, rows(2)))).toMatch(/^Showing the first 2 of 3 members\./);
  });

  it("says the manager list may be cut when it reaches the bound, since no count of managers is sent", () => {
    const managers = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `6a${String(index).padStart(22, "0")}`, name: `M ${index}`, email: null }));
    expect(managerListNote(managedTeam({ managers: managers(3) }).team)).toBeNull();
    expect(managerListNote(managedTeam({ managers: managers(199) }).team)).toBeNull();
    expect(managerListNote(managedTeam({ managers: managers(200) }).team)).toMatch(/^Showing the first 200 managers\. .* there may be more\.$/);
  });

  it("says a member's team list may be cut when it reaches the member read's bound", () => {
    expect(memberTeamsNote(managed().member)).toBeNull();
    const teams = Array.from({ length: 500 }, (_, index) => ({ id: `6c${String(index).padStart(22, "0")}`, name: `T ${index}`, archived: false, isManager: false }));
    expect(memberTeamsNote({ teams })).toMatch(/^Showing the first 500 team memberships\. .* there may be more\.$/);
  });
});

describe("which backend reads each team page makes", () => {
  const reads = (answers: { team?: ManagementResult<ManagedTeam>; member?: ManagementResult<ManagedMember>; organization?: ManagementResult<ManagedOrganization>; activeTeams?: ManagementResult<TeamChoice[]> } = {}) => {
    const calls: string[] = [];
    const made: TeamReads = {
      team: async (organizationId, teamId) => {
        calls.push(`team ${organizationId} ${teamId}`);
        return answers.team ?? { ok: true, data: managedTeam() };
      },
      member: async (organizationId, userId) => {
        calls.push(`member ${organizationId} ${userId}`);
        return answers.member ?? { ok: true, data: managed() };
      },
      organization: async (organizationId) => {
        calls.push(`organization ${organizationId}`);
        return answers.organization ?? { ok: true, data: organization() };
      },
      activeTeams: async (organizationId) => {
        calls.push(`teams ${organizationId}`);
        return answers.activeTeams ?? { ok: true, data: CHOICES };
      },
    };
    return { made, calls };
  };

  it("reads the team once for the team page, and nothing for an address that is not made of ids", async () => {
    const { made, calls } = reads();
    await expect(loadTeamPage(made, ORG, TEAM)).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([`team ${ORG} ${TEAM}`]);
    await expect(loadTeamPage(made, "nope", TEAM)).resolves.toEqual(refused("invalid_id"));
    await expect(loadTeamPage(made, ORG, "new")).resolves.toEqual(refused("invalid_team_id"));
    expect(calls).toHaveLength(1);
  });

  it("reads the organization once for the create page", async () => {
    const { made, calls } = reads();
    await expect(loadCreateTeamPage(made, ORG)).resolves.toMatchObject({ state: "ready", organization: { name: "Acme Events" } });
    expect(calls).toEqual([`organization ${ORG}`]);
    await expect(loadCreateTeamPage(made, "nope")).resolves.toEqual({ state: "failed", refusal: refused("invalid_id") });
    expect(calls).toHaveLength(1);
    const failing = reads({ organization: refused("organization_not_found") });
    await expect(loadCreateTeamPage(failing.made, ORG)).resolves.toEqual({ state: "failed", refusal: refused("organization_not_found") });
  });

  it.each(["rename", "archive", "addMember"] as const)("%s: reads the team, then the organization", async (write) => {
    const { made, calls } = reads();
    await expect(loadTeamWritePage(made, ORG, TEAM, write)).resolves.toMatchObject({ state: "ready", team: { team: { id: TEAM } }, organization: { id: ORG } });
    expect(calls).toEqual([`team ${ORG} ${TEAM}`, `organization ${ORG}`]);
  });

  it.each(["rename", "archive", "addMember"] as const)("%s: does not read the organization for an archived team, a team that can't be read, or a bad address", async (write) => {
    const archived = reads({ team: { ok: true, data: managedTeam({ archived: true }) } });
    await expect(loadTeamWritePage(archived.made, ORG, TEAM, write)).resolves.toMatchObject({ state: "not_offered", team: { team: { archived: true } } });
    expect(archived.calls).toEqual([`team ${ORG} ${TEAM}`]);
    const missing = reads({ team: { ok: false, failure: "team_not_found", code: "TEAM_NOT_FOUND" } });
    await expect(loadTeamWritePage(missing.made, ORG, TEAM, write)).resolves.toEqual({ state: "failed", refusal: { ok: false, failure: "team_not_found", code: "TEAM_NOT_FOUND" } });
    expect(missing.calls).toHaveLength(1);
    const bad = reads();
    await expect(loadTeamWritePage(bad.made, ORG, "nope", write)).resolves.toEqual({ state: "failed", refusal: refused("invalid_team_id") });
    await expect(loadTeamWritePage(bad.made, "nope", TEAM, write)).resolves.toEqual({ state: "failed", refusal: refused("invalid_id") });
    expect(bad.calls).toEqual([]);
    const noOrganization = reads({ organization: refused("rate_limited") });
    await expect(loadTeamWritePage(noOrganization.made, ORG, TEAM, write)).resolves.toEqual({ state: "failed", refusal: refused("rate_limited") });
  });

  it("a page about a member of a team reads the member, then the organization, and never the team", async () => {
    const { made, calls } = reads();
    await expect(loadTeamMemberWritePage(made, ORG, TEAM, USER, "removeManager")).resolves.toMatchObject({ state: "ready", membership: { id: TEAM, name: "West", isManager: true }, member: { version: 4 } });
    expect(calls).toEqual([`member ${ORG} ${USER}`, `organization ${ORG}`]);
    const remove = reads();
    await expect(loadTeamMemberWritePage(remove.made, ORG, TEAM, USER, "removeMember")).resolves.toMatchObject({ state: "ready" });
  });

  it("does not read the organization when the member is not on the team, the team is archived, or the write does not fit", async () => {
    const notOn = reads();
    await expect(loadTeamMemberWritePage(notOn.made, ORG, TEAM_B, USER, "removeMember")).resolves.toMatchObject({ state: "not_offered", membership: null });
    expect(notOn.calls).toEqual([`member ${ORG} ${USER}`]);
    const archived = reads();
    await expect(loadTeamMemberWritePage(archived.made, ORG, TEAM_OLD, USER, "removeMember")).resolves.toMatchObject({ state: "not_offered", membership: { archived: true } });
    expect(archived.calls).toHaveLength(1);
    // Already a manager: "make manager" is not offered.
    const already = reads();
    await expect(loadTeamMemberWritePage(already.made, ORG, TEAM, USER, "makeManager")).resolves.toMatchObject({ state: "not_offered", membership: { isManager: true } });
    expect(already.calls).toHaveLength(1);
    // On the team without the Team Manager role: "make manager" is not offered.
    const planner = reads({ member: { ok: true, data: managed({ roles: ["planner"], teams: [{ id: TEAM, name: "West", archived: false, isManager: false }] }) } });
    await expect(loadTeamMemberWritePage(planner.made, ORG, TEAM, USER, "makeManager")).resolves.toMatchObject({ state: "not_offered" });
    await expect(loadTeamMemberWritePage(planner.made, ORG, TEAM, USER, "removeManager")).resolves.toMatchObject({ state: "not_offered" });
    expect(planner.calls).toEqual([`member ${ORG} ${USER}`, `member ${ORG} ${USER}`]);
    const bad = reads();
    await expect(loadTeamMemberWritePage(bad.made, ORG, "nope", USER, "removeMember")).resolves.toEqual({ state: "failed", refusal: refused("invalid_team_id") });
    await expect(loadTeamMemberWritePage(bad.made, ORG, TEAM, "nope", "removeMember")).resolves.toEqual({ state: "failed", refusal: refused("invalid_id") });
    expect(bad.calls).toEqual([]);
  });

  it("a member's teams: the member, then the active teams once, then the organization", async () => {
    const { made, calls } = reads();
    await expect(loadMemberTeamsPage(made, ORG, USER)).resolves.toMatchObject({ state: "ready", choices: CHOICES, member: { version: 4 }, organization: { id: ORG } });
    expect(calls).toEqual([`member ${ORG} ${USER}`, `teams ${ORG}`, `organization ${ORG}`]);
    // A removed member: nothing else is read.
    const removed = reads({ member: { ok: true, data: managed({ status: "removed" }) } });
    await expect(loadMemberTeamsPage(removed.made, ORG, USER)).resolves.toMatchObject({ state: "not_offered" });
    expect(removed.calls).toEqual([`member ${ORG} ${USER}`]);
    const noTeams = reads({ activeTeams: refused("rate_limited") });
    await expect(loadMemberTeamsPage(noTeams.made, ORG, USER)).resolves.toEqual({ state: "failed", refusal: refused("rate_limited") });
    expect(noTeams.calls).toEqual([`member ${ORG} ${USER}`, `teams ${ORG}`]);
    const bad = reads();
    await expect(loadMemberTeamsPage(bad.made, ORG, "nope")).resolves.toEqual({ state: "failed", refusal: refused("invalid_id") });
    expect(bad.calls).toEqual([]);
  });

  it("keys a flow by the write, the team, the member and the version read", () => {
    expect(teamFlowKey("rename", { teamId: TEAM })).toBe(`rename:${TEAM}::`);
    expect(teamFlowKey("memberTeams", { member: managed({}, 4) })).not.toBe(teamFlowKey("memberTeams", { member: managed({}, 5) }));
    expect(teamFlowKey("removeMember", { teamId: TEAM, member: managed() })).not.toBe(teamFlowKey("removeMember", { teamId: TEAM_B, member: managed() }));
  });
});

describe("the form, the review and the result", () => {
  const context = { organization: organization(), team: { id: TEAM, name: "West" }, member: managed().member, isManager: true, choices: CHOICES };
  const draft = (change = {}) => ({ ...emptyTeamDraft(), reason: `  ${REASON}  `, ...change });

  it("asks for a reason on every team write, with the API's own rule", () => {
    for (const kind of TEAM_WRITES) {
      const checked = checkTeamDraft(kind, { ...emptyTeamDraft(), reason: "too short" }, { teamName: "West", member: managed().member, choices: CHOICES });
      expect(checked).toMatchObject({ ok: false, errors: { reason: "Give a reason of 10 to 500 characters." } });
    }
  });

  it("sends the trimmed values and only what the write names", () => {
    expect(checkTeamDraft("create", draft({ name: "  North " }))).toEqual({ ok: true, request: { reason: REASON, name: "North" } });
    expect(checkTeamDraft("rename", draft({ name: "North" }), { teamName: "West" })).toEqual({ ok: true, request: { reason: REASON, name: "North" } });
    expect(checkTeamDraft("archive", draft({ name: "ignored", teamIds: [TEAM] }))).toEqual({ ok: true, request: { reason: REASON } });
    expect(checkTeamDraft("removeMember", draft())).toEqual({ ok: true, request: { reason: REASON } });
    expect(checkTeamDraft("makeManager", draft())).toEqual({ ok: true, request: { reason: REASON, isManager: true } });
    expect(checkTeamDraft("removeManager", draft())).toEqual({ ok: true, request: { reason: REASON, isManager: false } });
    expect(checkTeamDraft("memberTeams", draft({ teamIds: [TEAM, TEAM_B] }), { member: managed().member, choices: CHOICES })).toEqual({ ok: true, request: { reason: REASON, teamIds: [TEAM, TEAM_B] } });
  });

  it("refuses a name that is empty, too long or the one the team has; a case-only change is a change", () => {
    expect(checkTeamDraft("create", draft({ name: " " }))).toMatchObject({ ok: false, errors: { name: "Give the team a name of 1 to 120 characters." } });
    expect(checkTeamDraft("rename", draft({ name: "x".repeat(121) }), { teamName: "West" })).toMatchObject({ ok: false });
    expect(checkTeamDraft("rename", draft({ name: " West " }), { teamName: "West" })).toMatchObject({ ok: false, errors: { name: expect.stringMatching(/already has that name/) } });
    expect(checkTeamDraft("rename", draft({ name: "WEST" }), { teamName: "West" })).toMatchObject({ ok: true });
  });

  it("refuses an add with no member chosen, or one who is not active", () => {
    expect(checkTeamDraft("addMember", draft())).toMatchObject({ ok: false, errors: { target: "Choose the member who joins the team." } });
    expect(checkTeamDraft("addMember", draft({ target: { ...managed().member, status: "suspended" } }))).toMatchObject({ ok: false });
  });

  it("refuses a set of teams outside the active teams, over 100, or the one the member already has", () => {
    const member = managed().member;
    expect(checkTeamDraft("memberTeams", draft({ teamIds: [TEAM_OLD] }), { member, choices: CHOICES })).toMatchObject({ ok: false, errors: { teams: "Choose only from the organization's active teams." } });
    expect(checkTeamDraft("memberTeams", draft({ teamIds: ["not-an-id"] }), { member, choices: CHOICES })).toMatchObject({ ok: false });
    expect(checkTeamDraft("memberTeams", draft({ teamIds: [TEAM] }), { member, choices: CHOICES })).toMatchObject({ ok: false, errors: { teams: expect.stringMatching(/the member's teams now/) } });
    const many = Array.from({ length: 101 }, (_, index) => `6c${String(index + 100).padStart(22, "0")}`);
    expect(checkTeamDraft("memberTeams", draft({ teamIds: many }), { member, choices: many.map((id) => ({ id, name: id })) })).toMatchObject({ ok: false, errors: { teams: "Choose at most 100 teams." } });
    // Taking the member off every active team is a change.
    expect(checkTeamDraft("memberTeams", draft({ teamIds: [] }), { member, choices: CHOICES })).toEqual({ ok: true, request: { reason: REASON, teamIds: [] } });
  });

  it("states in plain words who and what changes", () => {
    expect(teamReviewLines("create", context, { reason: REASON, name: "North" })[0]).toBe("A new team named North is created in Acme Events.");
    expect(teamReviewLines("rename", context, { reason: REASON, name: "North" })).toEqual(["The team West in Acme Events is renamed to North.", "Only the team's name changes. No proposal is changed."]);
    expect(teamReviewLines("addMember", context, { reason: REASON, target: { ...managed().member, userId: OTHER, name: "Vic Viewer", email: "vic@acme.example" }, isManager: false })).toEqual([
      "Vic Viewer (vic@acme.example) joins the team West in Acme Events, as a plain member.",
      NO_SESSION_ENDED,
    ]);
    expect(teamReviewLines("addMember", context, { reason: REASON, target: managed().member, isManager: true })).toEqual([
      "Pat Planner (pat@acme.example) joins the team West in Acme Events, as a manager of the team.",
      MANAGER_REACH,
      NO_SESSION_ENDED,
    ]);
    expect(teamReviewLines("makeManager", context, { reason: REASON, isManager: true })).toEqual(["Pat Planner (pat@acme.example) becomes a manager of the team West in Acme Events.", MANAGER_REACH, NO_SESSION_ENDED]);
    expect(teamReviewLines("removeManager", context, { reason: REASON, isManager: false })[0]).toBe("Pat Planner (pat@acme.example) stops being a manager of the team West in Acme Events, and stays on the team.");
    const remove = teamReviewLines("removeMember", context, { reason: REASON });
    expect(remove[0]).toBe("Pat Planner (pat@acme.example) is taken off the team West in Acme Events.");
    expect(remove[1]).toMatch(/^They are a manager of this team now\./);
    expect(teamReviewLines("removeMember", { ...context, isManager: false }, { reason: REASON })).toHaveLength(2);
    expect(teamReviewLines("memberTeams", context, { reason: REASON, teamIds: [TEAM, TEAM_B] })).toEqual([
      "Pat Planner (pat@acme.example) in Acme Events: their active teams become exactly West, East.",
      "Joins: East.",
      "Stays on: West.",
      ...MEMBER_TEAMS_EFFECTS,
      "Archived teams this member is on, not changed: Old Guard.",
      `A Team Manager's reach over a team's proposals follows the change on their next request. ${NO_SESSION_ENDED}`,
    ]);
    expect(teamReviewLines("memberTeams", context, { reason: REASON, teamIds: [] })[0]).toBe("Pat Planner (pat@acme.example) in Acme Events is taken off every active team.");
    // Every line of a review is said once (they are drawn as a list).
    for (const kind of TEAM_WRITES) {
      const lines = teamReviewLines(kind, context, { reason: REASON, name: "North", teamIds: [TEAM_B], isManager: true, target: managed().member });
      expect(new Set(lines).size).toBe(lines.length);
      expect(lines.join(" ")).not.toMatch(/undefined|null|\bRFPs?\b|[0-9a-f]{24}/);
    }
  });

  it("says on the archive review that it cannot be undone and that proposals keep their team", () => {
    const lines = teamReviewLines("archive", context, { reason: REASON });
    expect(lines[0]).toBe("The team West in Acme Events is archived.");
    expect(lines.slice(1)).toEqual([...ARCHIVE_EFFECTS]);
    expect(lines).toContain("This cannot be undone: there is no un-archive, for staff or for the customer.");
    expect(lines).toContain("No proposal is changed: proposals on the team keep their team.");
    expect(TEAM_WRITE_HINTS.archive).toMatch(/cannot be undone.*proposals on the team keep their team/);
    expect(TEAM_WRITE_COPY.archive.danger).toBe(true);
  });

  it("promises nothing about sessions, email or proposals that the backend does not say", () => {
    const all = TEAM_WRITES.flatMap((kind: TeamWrite) => teamReviewLines(kind, context, { reason: REASON, name: "North", teamIds: [TEAM_B], isManager: true, target: managed().member })).join(" ");
    expect(all).not.toMatch(/signed out|sign(s|ed)? (them|the member) out|at once and can't|immediately|will be notified|is emailed|loses access to/i);
    expect(MANAGER_REACH).toBe("A Team Manager's reach over this team's proposals follows the change on their next request.");
  });

  it("shows the result from the API's own answer", () => {
    const answer = (teamChange: Record<string, unknown> = {}, members?: unknown[]): TeamAnswer => ({ answer: "team", team: managedTeam(teamChange, members) });
    expect(teamResultSummary("create", context, { reason: REASON, name: "North" }, answer({ name: "North", memberCount: 0 }, []))).toEqual({
      title: "Team created",
      lines: ["The team North now exists in Acme Events, with 0 members."],
    });
    expect(teamResultSummary("rename", context, { reason: REASON, name: "North" }, answer({ name: "North" }))).toEqual({ title: "Team renamed", lines: ["The team is now named North, in Acme Events."] });
    expect(teamResultSummary("archive", context, { reason: REASON }, answer({ archived: true, archivedAt: "2026-11-22T09:00:00.000Z" }))).toEqual({
      title: "Team archived",
      lines: ["West in Acme Events is archived, since Nov 22, 2026 UTC.", "Proposals on the team keep their team. It cannot be un-archived."],
    });
    expect(teamResultSummary("addMember", context, { reason: REASON, target: managed().member, isManager: true }, answer())).toEqual({
      title: "Member added to the team",
      lines: ["Pat Planner (pat@acme.example) is on the team West, as a manager.", "West in Acme Events has 1 member."],
    });
    // A team of more than 200: the member is named from the request, and nothing is claimed that the answer does not show.
    expect(teamResultSummary("addMember", context, { reason: REASON, target: managed().member, isManager: false }, answer({ memberCount: 250 }, [])).lines[0]).toBe(
      "The server accepted adding Pat Planner (pat@acme.example) to the team West. They are not among the members it listed in its answer.",
    );
    expect(teamResultSummary("removeMember", context, { reason: REASON }, answer({ memberCount: 0 }, []))).toEqual({
      title: "Member taken off the team",
      lines: ["Pat Planner (pat@acme.example) is no longer on the team West.", "West in Acme Events has 0 members."],
    });
    expect(teamResultSummary("makeManager", context, { reason: REASON, isManager: true }, answer()).lines[0]).toBe("Pat Planner (pat@acme.example) is a manager of West.");
    expect(teamResultSummary("removeManager", context, { reason: REASON, isManager: false }, answer({}, [{ member: memberView(), version: 4, isManager: false }]))).toMatchObject({
      title: "Team manager unset",
      lines: ["Pat Planner (pat@acme.example) is on the team, not as a manager: West.", "West in Acme Events has 1 member."],
    });
  });

  it("shows a member's teams from the answer, and says when nothing needed changing", () => {
    const member = managed({ teams: [{ id: TEAM_B, name: "East", archived: false, isManager: false }, { id: TEAM, name: "West", archived: false, isManager: true }, { id: TEAM_OLD, name: "Old Guard", archived: true, isManager: false }] }).member;
    expect(teamResultSummary("memberTeams", context, { reason: REASON, teamIds: [TEAM, TEAM_B] }, { answer: "member", changed: true, member, version: 5 })).toEqual({
      title: "Teams changed",
      lines: ["Pat Planner (pat@acme.example) in Acme Events is on: East, West (manager).", "Archived teams this member is on, not changed: Old Guard."],
    });
    const unchanged = teamResultSummary("memberTeams", context, { reason: REASON, teamIds: [] }, { answer: "member", changed: false, member: { ...member, teams: [] }, version: 5 });
    expect(unchanged.title).toBe("Nothing needed changing");
    expect(unchanged.lines).toEqual(["Pat Planner (pat@acme.example) in Acme Events is on no active team.", "The member was already on exactly those teams. The request is still recorded on the RFPilot side."]);
  });
});

describe("the confirmation gate in front of a team write", () => {
  type Result = { ok: boolean };
  const harness = (requiredName?: string) => {
    const pending: Array<(result: Result) => void> = [];
    const states: WriteGateState[] = [];
    const gate = createWriteGate<Result>({ send: () => new Promise<Result>((resolve) => pending.push(resolve)), succeeded: (result) => result.ok, requiredName, onChange: (state) => states.push(state) });
    return { gate, pending };
  };

  it("sends nothing before the confirmation, and one request for a double submit", async () => {
    const h = harness();
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    expect(h.pending).toHaveLength(0);
    h.gate.setAcknowledged(true);
    const first = h.gate.submit();
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "in_flight" });
    expect(h.pending).toHaveLength(1);
    h.pending[0]({ ok: true });
    await expect(first).resolves.toEqual({ sent: true, result: { ok: true } });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "done" });
    expect(h.pending).toHaveLength(1);
  });

  it("archives only once the team's name is typed: a tick, a part of the name or another case is not enough", async () => {
    const h = harness("West Coast Events");
    h.gate.setAcknowledged(true);
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    for (const typed of ["", "West", "west coast events", "West Coast Event", "West Coast Events!"]) {
      h.gate.setTypedName(typed);
      expect(h.gate.getState().confirmed).toBe(false);
      await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    }
    expect(h.pending).toHaveLength(0);
    h.gate.setTypedName("  West Coast   Events ");
    expect(h.gate.getState().confirmed).toBe(true);
    const sent = h.gate.submit();
    const again = h.gate.submit();
    expect(h.pending).toHaveLength(1);
    await expect(again).resolves.toEqual({ sent: false, reason: "in_flight" });
    // A refusal (the team was archived meanwhile) clears what was typed: the name is asked for again.
    h.pending[0]({ ok: false });
    await sent;
    expect(h.gate.getState()).toMatchObject({ typedName: "", confirmed: false, done: false });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    expect(h.pending).toHaveLength(1);
  });
});

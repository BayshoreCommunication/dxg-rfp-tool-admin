import { managementFailure, managementFailureCopy, refused, type ManagementFailure } from "@/lib/organizationManagement/management";
import { loadTeamPage, managerListNote, memberListNote, parseManagedTeam, teamManagementPath, type ManagedTeam } from "@/lib/organizationManagement/teams";

const ORG = "6b0000000000000000000002";
const USER = "6a0000000000000000000001";
const OTHER = "6a0000000000000000000009";
const TEAM = "6c0000000000000000000003";
const TEAM_B = "6c0000000000000000000004";
const TEAM_OLD = "6c0000000000000000000005";

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
const teamView = (change: Record<string, unknown> = {}) => ({ id: TEAM, name: "West", archived: false, archivedAt: null, createdAt: "2026-10-01T00:00:00.000Z", memberCount: 1, managers: [], ...change });
const teamData = (teamChange: Record<string, unknown> = {}, members: unknown[] = [{ member: memberView(), version: 4, isManager: true }]) => ({ organizationId: ORG, team: teamView(teamChange), members });
const managedTeam = (teamChange: Record<string, unknown> = {}, members?: unknown[]): ManagedTeam => parseManagedTeam(teamData(teamChange, members), ORG, TEAM) as ManagedTeam;

describe("the team address", () => {
  it("builds the team address outside the view-only content browser", () => {
    expect(teamManagementPath(ORG, TEAM)).toBe(`/organization-management/${ORG}/teams/${TEAM}`);
    expect(teamManagementPath(ORG, TEAM).startsWith("/organizations/")).toBe(false);
    // Nothing typed into an address reaches it unescaped.
    expect(teamManagementPath("a/b", "c?d")).toBe("/organization-management/a%2Fb/teams/c%3Fd");
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
    expect(parseManagedTeam(teamData({ id: "not-an-id" }), ORG, "not-an-id")).toBeNull();
    expect(parseManagedTeam({ organizationId: ORG, members: [] }, ORG, TEAM)).toBeNull();
    expect(parseManagedTeam({ organizationId: ORG, team: teamView() }, ORG, TEAM)).toBeNull();
    for (const data of [null, undefined, "team", [], 5]) expect(parseManagedTeam(data, ORG, TEAM)).toBeNull();
  });

  it("leaves out a member row it cannot read, and keeps the backend's count", () => {
    const team = managedTeam({ memberCount: 3 }, [{ member: memberView(), version: 4, isManager: false }, { member: memberView({ userId: "x" }), version: 4 }, { member: memberView({ userId: OTHER }), version: "2" }, null]);
    expect(team.members).toHaveLength(1);
    expect(team.team.memberCount).toBe(3);
  });
});

describe("the team read's refusals", () => {
  // Every code the staff team read answers with (backend docs/API.md, "Staff team management", and source).
  const CODES: Array<[status: number, code: string, failure: ManagementFailure]> = [
    [400, "INVALID_ORGANIZATION_ID", "invalid_id"],
    [400, "INVALID_TEAM_ID", "invalid_team_id"],
    [403, "STAFF_ACCESS_FORBIDDEN", "forbidden"],
    [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
    [404, "TEAM_NOT_FOUND", "team_not_found"],
    [409, "ORGANIZATION_NOT_MANAGEABLE", "organization_not_manageable"],
  ];

  it.each(CODES)("%i %s is %s", (status, code, failure) => {
    expect(managementFailure(status, code, "read")).toBe(failure);
  });

  it("calls a server error on the team read only 'unavailable'", () => {
    expect(managementFailure(500, "STAFF_TEAMS_INTERNAL_ERROR", "read")).toBe("unavailable");
    for (const status of [500, 502, 503, 504]) expect(managementFailure(status, null, "read")).toBe("unavailable");
    expect(managementFailure(429, null, "read")).toBe("rate_limited");
    expect(managementFailure(401, null, "read")).toBe("session_ended");
  });

  it("words the team refusals for a person, in fixed text of their own", () => {
    for (const failure of ["invalid_team_id", "team_not_found"] as const) {
      const copy = managementFailureCopy(refused(failure));
      expect(copy.title.length).toBeGreaterThan(5);
      expect(copy.message.length).toBeGreaterThan(20);
      expect(`${copy.title} ${copy.message}`).not.toMatch(/[A-Z]{3,}_[A-Z_]+|undefined|null|\bRFPs?\b/);
    }
    expect(managementFailureCopy(refused("invalid_team_id")).message).toMatch(/Open it from the organization's Teams page\./);
    expect(managementFailureCopy(refused("team_not_found")).title).toBe("Team not found");
  });
});

describe("lists the backend cuts short", () => {
  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ member: memberView({ userId: `6a${String(index).padStart(22, "0")}` }), version: 1, isManager: false }));

  // memberCount counts every row of the team; the list is shorter when the backend's bound cut
  // it, and also when a row was left out. The bound is blamed only above the bound.
  it.each([
    ["whole", 1, 1, null],
    ["empty", 0, 0, null],
    ["more listed than counted", 1, 2, null],
    ["a row left out, far below the bound", 3, 2, "The server listed 2 of 3 members."],
    ["one member, not listed", 1, 0, "The server listed 0 of 1 member."],
    ["a row left out, at the bound", 200, 199, "The server listed 199 of 200 members."],
    ["just above the bound", 201, 200, "Showing the first 200 of 201 members. The server lists at most 200 members of a team."],
    ["far above the bound", 1234, 200, "Showing the first 200 of 1,234 members. The server lists at most 200 members of a team."],
    ["above the bound, and a row left out too", 1234, 199, "Showing the first 199 of 1,234 members. The server lists at most 200 members of a team."],
  ] as const)("the member list note, %s (count %i, listed %i)", (_name, memberCount, listed, said) => {
    expect(memberListNote(managedTeam({ memberCount }, rows(listed)))).toBe(said);
  });

  it("drops a member row it cannot read without blaming the bound", () => {
    const team = managedTeam({ memberCount: 3 }, [...rows(2), { member: { name: "No id" }, version: 1 }]);
    expect(team.members).toHaveLength(2);
    expect(memberListNote(team)).toBe("The server listed 2 of 3 members.");
  });

  // No count of managers is sent: whether the bound was reached is read off the rows the answer
  // held, so a row dropped here does not hide that there may be more.
  const managers = (count: number, unreadable = 0) => [
    ...Array.from({ length: count - unreadable }, (_, index) => ({ id: `6a${String(index).padStart(22, "0")}`, name: `M ${index}`, email: null })),
    ...Array.from({ length: unreadable }, () => ({ name: "No id" })),
  ];
  const MORE = "The server lists at most 200 and sends no count of them, so there may be more.";
  it.each([
    [3, 0, null],
    [199, 0, null],
    [199, 1, null],
    [200, 0, `Showing the first 200 managers. ${MORE}`],
    [200, 1, `Showing 199 of the 200 managers the server listed. ${MORE}`],
    [200, 5, `Showing 195 of the 200 managers the server listed. ${MORE}`],
  ] as const)("the manager list note: %i rows in the answer, %i of them unreadable", (count, unreadable, said) => {
    const team = managedTeam({ managers: managers(count, unreadable) });
    expect(team.team.managers).toHaveLength(count - unreadable);
    expect(team.managersListed).toBe(count);
    expect(managerListNote(team)).toBe(said);
  });

  it("counts no manager rows for an answer without a manager list", () => {
    expect(managedTeam({ managers: undefined }).managersListed).toBe(0);
    expect(managerListNote(managedTeam({ managers: "x" }))).toBeNull();
  });

  const memberships = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `6c${String(index).padStart(22, "0")}`, name: `T ${index}`, archived: index % 2 === 1, isManager: false }));
});

describe("which backend read the team page makes", () => {
  it("reads the team once for the team page, and nothing for an address that is not made of ids", async () => {
    const calls: string[] = [];
    const made = {
      team: async (organizationId: string, teamId: string) => {
        calls.push(`team ${organizationId} ${teamId}`);
        return { ok: true as const, data: managedTeam() };
      },
    };
    await expect(loadTeamPage(made, ORG, TEAM)).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([`team ${ORG} ${TEAM}`]);
    await expect(loadTeamPage(made, "nope", TEAM)).resolves.toEqual(refused("invalid_id"));
    await expect(loadTeamPage(made, ORG, "new")).resolves.toEqual(refused("invalid_team_id"));
    expect(calls).toHaveLength(1);
  });
});

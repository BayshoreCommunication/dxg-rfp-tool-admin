import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Owner decision, 2026-11-24: RFPilot staff can no longer change a customer organization's
// members or teams. They view one member and one team, and block or reactivate the whole
// organization. The member and team writes were removed, not hidden; this file keeps them out.
// It reads the source (Jest runs in node, with no component harness), the same way the other
// guards of this repo do.

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const filesUnder = (directory: string): string[] =>
  readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(process.cwd(), relative)).isDirectory()) return filesUnder(relative);
    return /\.tsx?$/.test(entry) ? [relative] : [];
  });
const directoriesUnder = (directory: string): string[] =>
  readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    return statSync(join(process.cwd(), relative)).isDirectory() ? [relative, ...directoriesUnder(relative)] : [];
  });
const withoutComments = (source: string) => source.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "");

const ROOTS = ["app", "components", "lib"];
const isTest = (file: string) => /\.(test|spec)\.tsx?$/.test(file);
const sources = ROOTS.flatMap(filesUnder).filter((file) => !isTest(file));
const ACTIONS = "app/actions/organizationManagement.ts";
const PAGES = "app/(page)/organization-management";
const ROOT = `${PAGES}/[organizationId]`;

/** Everything a module exports by name, however it is written. */
const exportedNames = (source: string): string[] => {
  const code = withoutComments(source);
  const declared = [...code.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
  const listed = [...code.matchAll(/^export\s*\{([^}]*)\}/gm)].flatMap((match) =>
    match[1]
      .split(",")
      .map((name) => name.trim().split(/\s+as\s+/).pop() ?? "")
      .filter(Boolean),
  );
  return [...declared, ...listed, ...(/^export\s+\*/m.test(code) ? ["*"] : [])];
};

/* What is left: three reads and the block and the reactivation of the organization. */
const ALLOWED_ACTIONS = ["blockOrganizationAction", "getManagedMemberAction", "getManagedOrganizationAction", "getManagedTeamAction", "reactivateOrganizationAction"];

/* The server actions this change removed: every member and team write, and the three reads that
   served only those writes (the pickers and the list of teams to choose from). */
const REMOVED_ACTIONS = [
  "changeMemberRoleAction",
  "deactivateMemberAction",
  "reactivateMemberAction",
  "reassignMemberProposalsAction",
  "transferOwnershipAction",
  "setMemberTeamsAction",
  "createTeamAction",
  "renameTeamAction",
  "archiveTeamAction",
  "addTeamMemberAction",
  "setTeamManagerAction",
  "removeTeamMemberAction",
  "listReassignCandidatesAction",
  "listTeamCandidatesAction",
  "listActiveTeamsAction",
];

/* An action that would write to a member, a team or the ownership, whatever it is called: a verb
   of change, then the thing changed. "reactivateOrganizationAction" and "blockOrganizationAction"
   name neither a member nor a team. */
const MEMBER_OR_TEAM_WRITE = /^(change|update|edit|set|unset|assign|reassign|transfer|move|deactivate|reactivate|suspend|remove|delete|add|invite|create|rename|archive|restore|make|promote|demote)\w*(Member|Team|Ownership|Owner|Manager|Role)\w*$/;

/* The backend routes of the removed writes, all under /api/v1/admin/organizations/:organizationId
   (taken from the calls this change deleted from app/actions/organizationManagement.ts):

     PATCH  /members/:userId/role             POST   /teams
     POST   /members/:userId/deactivate       PATCH  /teams/:teamId
     POST   /members/:userId/reactivate       POST   /teams/:teamId/archive
     POST   /members/:userId/reassign-rfps    POST   /teams/:teamId/members
     POST   /ownership/transfer               PATCH  /teams/:teamId/members/:userId
     PUT    /members/:userId/teams            DELETE /teams/:teamId/members/:userId

   A path segment is written `${id}`, `:id`, `[id]` or a literal in source. */
const SEGMENT = "(?:\\$\\{[^}]*\\}|:[A-Za-z]+|\\[[A-Za-z]+\\]|[0-9a-f]{24})";
/** Paths that exist only as a write: naming one at all, with any method, fails. */
const WRITE_ONLY_PATHS: Array<[route: string, pattern: RegExp]> = [
  ["members/:userId/role", new RegExp(`members/${SEGMENT}/role\\b`)],
  ["members/:userId/deactivate", new RegExp(`members/${SEGMENT}/deactivate\\b`)],
  ["members/:userId/reactivate", new RegExp(`members/${SEGMENT}/reactivate\\b`)],
  // The member write routes were also reached through one template with the last segment in a variable.
  ["members/:userId/<variable>", new RegExp(`members/${SEGMENT}/\\$\\{`)],
  ["members/:userId/reassign-rfps", /reassign-rfps/],
  ["ownership/transfer", /ownership\/transfer/],
  ["members/:userId/teams", new RegExp(`members/${SEGMENT}/teams\\b`)],
  ["teams/:teamId/archive", new RegExp(`teams/${SEGMENT}/archive\\b`)],
  ["teams/:teamId/members", new RegExp(`teams/${SEGMENT}/members\\b`)],
  ["teams/:teamId/<variable>", new RegExp(`teams/${SEGMENT}/\\$\\{`)],
];
/** A members or a teams path segment, however the rest of the address is put together. */
const MEMBERS_OR_TEAMS = /\/(members|teams)\b|\b(members|teams)\//;
const NON_GET = /["'`](POST|PUT|PATCH|DELETE)["'`]/;

/* The exports of every server action file about a customer organization, exactly. A new export
   in one of them is a new public endpoint: it has to be added here, in view of this file. */
const ORGANIZATION_ACTION_EXPORTS: Record<string, string[]> = {
  "app/actions/organizationManagement.ts": ALLOWED_ACTIONS,
  // The content browser: eight reads.
  "app/actions/organizationContent.ts": [
    "getOrganizationProposalAction",
    "getOrganizationTemplateAction",
    "listOrganizationMembersAction",
    "listOrganizationProposalsAction",
    "listOrganizationTeamsAction",
    "listOrganizationTemplatesAction",
    "listOrganizationVendorResponsesAction",
    "listOrganizationVendorsAction",
  ],
  // Plans and the account page: three reads and the plan change, which touches no member and no team.
  "app/actions/organizationPlans.ts": ["changeOrganizationPlanAction", "getOrganizationAccountAction", "getOrganizationPlanAction", "listOrganizationPlansAction"],
};

/* The only server action files that may name a members or a teams path at all. */
const MAY_NAME_MEMBERS_OR_TEAMS = [
  // Two reads with GET (one member, one team); its only POSTs are the block and the reactivation.
  "app/actions/organizationManagement.ts",
  // The content browser's Members list and Teams list: GET only, and no other method in the file.
  "app/actions/organizationContent.ts",
];
/* The only source files that may name such a path and also hold a method other than GET. */
const MAY_NAME_THEM_BESIDE_A_WRITE_METHOD = [
  // Its POST is asserted below to be the block or the reactivation of the organization, and nothing else.
  "app/actions/organizationManagement.ts",
];

describe("staff view members and teams, and change neither (owner decision, 2026-11-24)", () => {
  it("scans the whole of app, components and lib", () => {
    // Enough files that an empty or misdirected scan cannot pass.
    expect(sources.length).toBeGreaterThan(120);
    for (const file of [ACTIONS, "app/actions/organizationContent.ts", "components/organizations/manage/MemberManagement.tsx", "components/organizations/manage/TeamManagement.tsx", "lib/organizationManagement/management.ts", "lib/organizationManagement/teams.ts", `${ROOT}/members/[userId]/page.tsx`, `${ROOT}/teams/[teamId]/page.tsx`]) {
      expect({ file, scanned: sources.includes(file) }).toEqual({ file, scanned: true });
    }
  });

  it("exports from the management actions exactly the three reads and the block and the reactivation", () => {
    const source = read(ACTIONS);
    expect(source.startsWith('"use server";')).toBe(true);
    expect(exportedNames(source).sort()).toEqual(ALLOWED_ACTIONS);
    // The same list, counted the way the file writes them: one exported async function each.
    expect([...source.matchAll(/^export async function (\w+)\(/gm)].map((match) => match[1]).sort()).toEqual(ALLOWED_ACTIONS);
    for (const name of ALLOWED_ACTIONS) expect({ name, write: MEMBER_OR_TEAM_WRITE.test(name) }).toEqual({ name, write: false });
    // The rule itself catches every action that was removed for writing: it is not a rule that matches nothing.
    for (const name of REMOVED_ACTIONS.filter((action) => !action.startsWith("list"))) expect({ name, write: MEMBER_OR_TEAM_WRITE.test(name) }).toEqual({ name, write: true });
  });

  it("exports no member or team write from any server action file, under any name", () => {
    // Every module that is a server action file: an export of one is a public endpoint.
    const actionFiles = sources.filter((file) => /^\s*["']use server["'];/.test(read(file)));
    expect(actionFiles.length).toBeGreaterThanOrEqual(8);
    expect(actionFiles).toContain(ACTIONS);
    let exports = 0;
    for (const file of actionFiles) {
      for (const name of exportedNames(read(file))) {
        exports += 1;
        expect({ file, name, removed: REMOVED_ACTIONS.includes(name) }).toEqual({ file, name, removed: false });
        // In every server action file, not only the organization ones: nothing named like a write to a member, a team, a role or the ownership.
        expect({ file, name, write: MEMBER_OR_TEAM_WRITE.test(name) }).toEqual({ file, name, write: false });
      }
    }
    expect(exports).toBeGreaterThan(20);
    // And nothing anywhere names a removed action: no import, no call, no re-export.
    const names = new RegExp(`\\b(${REMOVED_ACTIONS.join("|")})\\b`);
    for (const file of sources) expect({ file, names: names.test(read(file)) }).toEqual({ file, names: false });
  });

  it("pins the exports of every organization action file", () => {
    const organizationFiles = sources.filter((file) => /^app\/actions\/organization\w*\.ts$/.test(file)).sort();
    expect(organizationFiles).toEqual(Object.keys(ORGANIZATION_ACTION_EXPORTS).sort());
    for (const file of organizationFiles) {
      const source = read(file);
      expect({ file, server: source.startsWith('"use server";') }).toEqual({ file, server: true });
      expect({ file, exports: exportedNames(source).sort() }).toEqual({ file, exports: [...ORGANIZATION_ACTION_EXPORTS[file]].sort() });
    }
  });

  it("recognises every removed route, as the removed code wrote it", () => {
    // The calls this change deleted, verbatim. Each must be caught, or the scan below proves nothing.
    const deleted = [
      "ask(\"write\", `/${organizationId}/members/${userId}/role`, { method: \"PATCH\", body: { role: fields.role, version, reason } }",
      "ask(\"write\", `/${organizationId}/members/${userId}/${route}`, { method: \"POST\", body: { version, reason } }",
      "ask(\"write\", `/${organizationId}/members/${userId}/reassign-rfps`, { method: \"POST\", body: { toUserId: fields.toUserId, reason } }",
      "ask(\"write\", `/${organizationId}/ownership/transfer`, { method: \"POST\", body: { toUserId, version, reason } }",
      "ask(\"write\", `/${organizationId}/members/${userId}/teams`, { method: \"PUT\", body: { teamIds, version, reason } }",
      "ask(\"write\", `/${organizationId}/teams/${teamId}/archive`, { method: \"POST\", body: { reason } }",
      "ask(\"write\", `/${organizationId}/teams/${teamId}/members`, { method: \"POST\", body: { userId, isManager, reason } }",
      "ask(\"write\", `/${organizationId}/teams/${teamId}/members/${userId}`, { method: \"PATCH\", body: { isManager, reason } }",
      "ask(\"write\", `/${organizationId}/teams/${teamId}/members/${userId}`, { method: \"DELETE\", body: { reason } }",
    ];
    for (const call of deleted) expect({ call, caught: WRITE_ONLY_PATHS.some(([, pattern]) => pattern.test(call)) }).toEqual({ call, caught: true });
    // The two that share their path with a read are caught by their method, wherever the base address comes from.
    for (const call of [
      "ask(\"write\", `/${organizationId}/teams`, { method: \"POST\", body: { name, reason } }",
      "ask(\"write\", `/${organizationId}/teams/${teamId}`, { method: \"PATCH\", body: { name, reason } }",
      "fetch(`${API}/${organizationId}/teams`, { method: 'POST' })",
      "fetch(base + \"/members/\" + userId + \"/\" + segment, { method: \"PUT\" })",
    ]) {
      expect({ call, caught: MEMBERS_OR_TEAMS.test(call) && NON_GET.test(call) }).toEqual({ call, caught: true });
    }
    for (const literal of ["/api/v1/admin/organizations/6b0000000000000000000002/members/6a0000000000000000000001/deactivate", "members/:userId/reactivate", "teams/[teamId]/members/add"]) {
      expect({ literal, caught: WRITE_ONLY_PATHS.some(([, pattern]) => pattern.test(literal)) }).toEqual({ literal, caught: true });
    }
    // The reads that stay are not mistaken for writes.
    for (const kept of ["`/${organizationId}/members/${userId}`", "`/${organizationId}/teams/${teamId}`", "`${API}/${organizationId}/members`", "`${API}/${organizationId}/teams`", "`/${organizationId}/${write === \"block\" ? \"block\" : \"reactivate\"}`"]) {
      expect({ kept, caught: WRITE_ONLY_PATHS.some(([, pattern]) => pattern.test(kept)) }).toEqual({ kept, caught: false });
    }
  });

  it("names no backend path of a removed write anywhere in the source, with any method", () => {
    let scanned = 0;
    for (const file of sources) {
      const code = withoutComments(read(file));
      scanned += 1;
      for (const [route, pattern] of WRITE_ONLY_PATHS) expect({ file, route, named: pattern.test(code) }).toEqual({ file, route, named: false });
    }
    expect(scanned).toBe(sources.length);
  });

  it("asks a members or teams path with GET only", () => {
    // Every source file that names a members or a teams path segment, whatever the rest of the address is built from.
    const naming = sources.filter((file) => MEMBERS_OR_TEAMS.test(withoutComments(read(file))));
    expect(naming).toContain(ACTIONS);
    expect(naming).toContain("app/actions/organizationContent.ts");
    expect(naming.length).toBeGreaterThanOrEqual(5);
    // None of them holds a method other than GET, in any form, except the files listed with their reason.
    const withWriteMethod = naming.filter((file) => NON_GET.test(withoutComments(read(file))));
    expect(withWriteMethod.sort()).toEqual([...MAY_NAME_THEM_BESIDE_A_WRITE_METHOD].sort());
    // No server action file names such a path at all, except the two listed with their reason.
    const actionFiles = sources.filter((file) => /^\s*["']use server["'];/.test(read(file)));
    expect(actionFiles.filter((file) => MEMBERS_OR_TEAMS.test(withoutComments(read(file)))).sort()).toEqual([...MAY_NAME_MEMBERS_OR_TEAMS].sort());
    for (const file of MAY_NAME_MEMBERS_OR_TEAMS.filter((path) => !MAY_NAME_THEM_BESIDE_A_WRITE_METHOD.includes(path))) {
      const code = withoutComments(read(file));
      expect({ file, method: code.match(NON_GET)?.[0] ?? null }).toEqual({ file, method: null });
      expect({ file, method: code.match(/method:(?!\s*["'`]GET["'`])[^,}\n]+/)?.[0] ?? null }).toEqual({ file, method: null });
    }
    // In the management actions the one method besides GET is the POST of a block or a reactivation,
    // and every request that names a member or a team is a read with GET.
    const actions = withoutComments(read(ACTIONS));
    expect([...new Set(actions.match(/["'`](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)["'`]/g))].sort()).toEqual(['"GET"', '"POST"']);
    const asks = [...actions.matchAll(/ask\(\s*"(read|write)",\s*`([^`]+)`,\s*\{\s*method:\s*"([A-Z]+)"/g)].map((match) => ({ mode: match[1], path: match[2], method: match[3] }));
    expect(actions.match(/\bask\(/g)).toHaveLength(asks.length);
    expect(asks).toEqual([
      { mode: "read", path: "/${organizationId}/members/${userId}", method: "GET" },
      { mode: "write", path: '/${organizationId}/${write === "block" ? "block" : "reactivate"}', method: "POST" },
      { mode: "read", path: "/${organizationId}/teams/${teamId}", method: "GET" },
    ]);
    for (const { path, method } of asks) if (MEMBERS_OR_TEAMS.test(path)) expect({ path, method }).toEqual({ path, method: "GET" });
    // The POST targets, exactly: the block and the reactivation of the organization. The path is the
    // organization's id and then one of two fixed words, with no member or team in it.
    expect(asks.filter(({ method }) => method !== "GET").map(({ path }) => path)).toEqual(['/${organizationId}/${write === "block" ? "block" : "reactivate"}']);
    // A path is always a template written at the call: none is a variable, a concatenation or a helper's answer.
    expect(actions.match(/\bask\(\s*"(read|write)",\s*`/g)).toHaveLength(asks.length);
    expect(actions).not.toMatch(/["'`]\s*\+|\+\s*["'`]|\.concat\(|\.join\(/);
    // The only request helper is `ask`: no other fetch could carry a write past the list above.
    expect(actions.match(/authenticatedBackendFetch\(/g)).toHaveLength(1);
    expect(actions).not.toMatch(/\bfetch\s*\(|axios|XMLHttpRequest/);
  });

  it("has no route for a removed write page", () => {
    const REMOVED_PAGES = [
      `${ROOT}/members/[userId]/role`,
      `${ROOT}/members/[userId]/deactivate`,
      `${ROOT}/members/[userId]/reactivate`,
      `${ROOT}/members/[userId]/reassign-proposals`,
      `${ROOT}/members/[userId]/transfer-ownership`,
      `${ROOT}/members/[userId]/teams`,
      `${ROOT}/teams/new`,
      `${ROOT}/teams/[teamId]/rename`,
      `${ROOT}/teams/[teamId]/archive`,
      `${ROOT}/teams/[teamId]/members`,
      `${ROOT}/teams/[teamId]/members/add`,
      `${ROOT}/teams/[teamId]/members/[userId]`,
      `${ROOT}/teams/[teamId]/members/[userId]/remove`,
      `${ROOT}/teams/[teamId]/members/[userId]/make-manager`,
      `${ROOT}/teams/[teamId]/members/[userId]/remove-manager`,
    ];
    for (const directory of REMOVED_PAGES) expect({ directory, exists: existsSync(join(process.cwd(), directory)) }).toEqual({ directory, exists: false });
    // What is there instead, exactly: the two view pages and the block and the reactivate page.
    expect(existsSync(join(process.cwd(), ROOT))).toBe(true);
    expect(filesUnder(PAGES).sort()).toEqual(
      [`${ROOT}/block/page.tsx`, `${ROOT}/loading.tsx`, `${ROOT}/members/[userId]/page.tsx`, `${ROOT}/reactivate/page.tsx`, `${ROOT}/teams/[teamId]/page.tsx`].sort(),
    );
    expect(directoriesUnder(PAGES).sort()).toEqual(
      [ROOT, `${ROOT}/block`, `${ROOT}/members`, `${ROOT}/members/[userId]`, `${ROOT}/reactivate`, `${ROOT}/teams`, `${ROOT}/teams/[teamId]`].sort(),
    );
    // No route anywhere in the app carries the segment of a removed write page.
    const routes = directoriesUnder("app");
    expect(routes.length).toBeGreaterThan(30);
    for (const directory of routes) {
      expect({ directory, removed: /\/(role|deactivate|reassign-proposals|transfer-ownership|rename|archive|make-manager|remove-manager)$/.test(directory) }).toEqual({ directory, removed: false });
    }
    // And no source builds the address of one.
    for (const file of sources) {
      expect({ file, address: /reassign-proposals|transfer-ownership|make-manager|remove-manager|\/teams\/new\b|members\/add\b/.test(withoutComments(read(file))) }).toEqual({ file, address: false });
    }
  });

  it("shows a member and a team with nothing to change", () => {
    const memberPage = [`${ROOT}/members/[userId]/page.tsx`, "components/organizations/manage/MemberManagement.tsx", "components/organizations/manage/ManageChrome.tsx"];
    for (const file of memberPage) expect({ file, section: /What you can change/i.test(read(file)) }).toEqual({ file, section: false });
    // Nor does any other source say it, or promise a page for each change.
    for (const file of sources) expect({ file, offers: /What you can change|Each change opens its own page/i.test(read(file)) }).toEqual({ file, offers: false });
    // The member page and the team page hold no control: no button, form, field, handler or action.
    for (const file of ["components/organizations/manage/MemberManagement.tsx", "components/organizations/manage/TeamManagement.tsx", `${ROOT}/members/[userId]/page.tsx`, `${ROOT}/teams/[teamId]/page.tsx`]) {
      const source = read(file);
      expect({ file, control: /<button\b|<form\b|<input\b|<select\b|<textarea\b|onClick=|onSubmit=|"use client"/.test(source) }).toEqual({ file, control: false });
      expect({ file, writes: /(block|reactivate)OrganizationAction/.test(source) }).toEqual({ file, writes: false });
    }
    // Both say they are view only, and that opening them is recorded.
    for (const file of [`${ROOT}/members/[userId]/page.tsx`, `${ROOT}/teams/[teamId]/page.tsx`]) expect({ file, viewOnly: /<ManageFrame organizationId=\{known\}( teams)? viewOnly>/.test(read(file)) }).toEqual({ file, viewOnly: true });
    expect(read("components/organizations/manage/ManageChrome.tsx")).toMatch(
      /View only\. Members, teams, proposals, templates and vendors can&apos;t be changed from here\. Each page you open is recorded on the\s+RFPilot side\./,
    );
    // The lists that lead to them offer a view, and nothing that creates or manages.
    for (const file of ["components/organizations/content/MembersList.tsx", "components/organizations/content/TeamsList.tsx"]) {
      expect({ file, offers: />\s*(Manage|Create a team|Change|Add|Remove|Rename|Archive)\b|aria-label=\{`Manage /.test(read(file)) }).toEqual({ file, offers: false });
    }
  });
});

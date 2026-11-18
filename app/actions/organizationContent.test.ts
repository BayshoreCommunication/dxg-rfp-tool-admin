jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { auth } from "@/auth";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import * as actions from "./organizationContent";

const {
  getOrganizationProposalAction,
  getOrganizationTemplateAction,
  listOrganizationMembersAction,
  listOrganizationProposalsAction,
  listOrganizationTeamsAction,
  listOrganizationTemplatesAction,
  listOrganizationVendorResponsesAction,
  listOrganizationVendorsAction,
} = actions;

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedAuth = auth as unknown as jest.Mock;

const ORG = "6a0000000000000000000001";
const PROPOSAL = "6b0000000000000000000002";
const TEMPLATE = "6d0000000000000000000004";
const PAGINATION = { page: 1, perPage: 20, total: 0, totalPages: 1 };

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
const data = (body: Record<string, unknown>) => jsonResponse(200, { success: true, data: { organizationId: ORG, ...body } });
const urlOf = (call: number) => String(mockedFetch.mock.calls[call][0]);

/** Every action with valid arguments, and the response that satisfies it. */
const ALL: Array<{ name: string; run: (organizationId?: string) => Promise<{ ok: boolean }>; path: RegExp; body: Record<string, unknown> }> = [
  { name: "proposals", run: (id = ORG) => listOrganizationProposalsAction(id), path: new RegExp(`/api/v1/admin/organizations/${ORG}/proposals$`), body: { rfps: [], pagination: PAGINATION } },
  { name: "proposal", run: (id = ORG) => getOrganizationProposalAction(id, PROPOSAL), path: new RegExp(`/api/v1/admin/organizations/${ORG}/proposals/${PROPOSAL}$`), body: { rfp: { id: PROPOSAL }, owner: null } },
  { name: "vendor responses", run: (id = ORG) => listOrganizationVendorResponsesAction(id, PROPOSAL), path: new RegExp(`/api/v1/admin/organizations/${ORG}/proposals/${PROPOSAL}/vendor-responses$`), body: { proposalId: PROPOSAL, vendorResponses: [] } },
  { name: "members", run: (id = ORG) => listOrganizationMembersAction(id), path: new RegExp(`/api/v1/admin/organizations/${ORG}/members$`), body: { members: [], pagination: PAGINATION, pendingInvitations: [], pendingInvitationsTotal: 0 } },
  { name: "teams", run: (id = ORG) => listOrganizationTeamsAction(id), path: new RegExp(`/api/v1/admin/organizations/${ORG}/teams$`), body: { teams: [] } },
  { name: "templates", run: (id = ORG) => listOrganizationTemplatesAction(id), path: new RegExp(`/api/v1/admin/organizations/${ORG}/templates$`), body: { templates: [], pagination: PAGINATION } },
  { name: "template", run: (id = ORG) => getOrganizationTemplateAction(id, TEMPLATE), path: new RegExp(`/api/v1/admin/organizations/${ORG}/templates/${TEMPLATE}$`), body: { template: { id: TEMPLATE, content: {} } } },
  { name: "vendors", run: (id = ORG) => listOrganizationVendorsAction(id), path: new RegExp(`/api/v1/admin/organizations/${ORG}/vendors$`), body: { vendors: [], pagination: PAGINATION } },
];

beforeEach(() => {
  mockedFetch.mockReset();
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue({ user: { role: "admin" } });
});

describe("organization content actions", () => {
  it("covers every action the file exports", () => {
    expect(Object.keys(actions).sort()).toHaveLength(ALL.length);
  });

  it.each(ALL)("$name: one GET to its own staff route, uncached, through the signed-in session", async ({ run, path, body }) => {
    mockedFetch.mockResolvedValue(data(body));
    expect(await run()).toMatchObject({ ok: true });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(urlOf(0)).toMatch(path);
    expect(urlOf(0)).not.toMatch(/support-access/);
    const init = mockedFetch.mock.calls[0][1] as RequestInit & { next?: unknown };
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init.next).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it.each(ALL)("$name: asks nothing unless the signed-in session is a staff admin", async ({ run }) => {
    mockedAuth.mockResolvedValue(null);
    expect(await run()).toEqual({ ok: false, failure: "session_ended" });
    mockedAuth.mockResolvedValue({ user: { role: "admin" }, authError: "SessionExpired" });
    expect(await run()).toEqual({ ok: false, failure: "session_ended" });
    mockedAuth.mockRejectedValue(new Error("no session"));
    expect(await run()).toEqual({ ok: false, failure: "session_ended" });
    for (const role of ["planner", "owner", "organization_admin", "", undefined]) {
      mockedAuth.mockResolvedValue({ user: { role } });
      expect(await run()).toEqual({ ok: false, failure: "forbidden" });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it.each(ALL)("$name: refuses an organization id that is not 24 lower-case hex, without asking", async ({ run }) => {
    for (const id of ["", "abc", ORG.toUpperCase(), `${ORG}0`, "../support/tickets?x=1", `${ORG}/members`]) {
      expect(await run(id)).toEqual({ ok: false, failure: "invalid_id" });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refuses a proposal or template id that is not an id, without asking", async () => {
    for (const id of ["", "abc", PROPOSAL.toUpperCase(), `${PROPOSAL}?x=1`, "../members"]) {
      expect(await getOrganizationProposalAction(ORG, id)).toEqual({ ok: false, failure: "record_not_found" });
      expect(await listOrganizationVendorResponsesAction(ORG, id)).toEqual({ ok: false, failure: "record_not_found" });
      expect(await getOrganizationTemplateAction(ORG, id)).toEqual({ ok: false, failure: "record_not_found" });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("sends only the page, search and filters the API offers, each one checked", async () => {
    mockedFetch.mockImplementation(async (url) => {
      const path = String(url);
      if (/\/proposals/.test(path)) return data({ rfps: [], pagination: PAGINATION });
      if (/\/members/.test(path)) return data({ members: [], pagination: PAGINATION });
      if (/\/templates/.test(path)) return data({ templates: [], pagination: PAGINATION });
      return data({ vendors: [], pagination: PAGINATION });
    });
    await listOrganizationProposalsAction(ORG, { page: 2, search: "  summit & more " });
    expect(urlOf(0)).toMatch(/\/proposals\?page=2&search=summit\+%26\+more$/);
    await listOrganizationProposalsAction(ORG, { page: -4, search: "   " });
    expect(urlOf(1)).toMatch(/\/proposals$/);
    await listOrganizationMembersAction(ORG, { page: 3 });
    expect(urlOf(2)).toMatch(/\/members\?page=3$/);
    await listOrganizationTemplatesAction(ORG, { page: 1, search: "kick", scope: "personal", status: "archived" });
    expect(urlOf(3)).toMatch(/\/templates\?search=kick&scope=personal&status=archived$/);
    // A value outside the filter's list is dropped, never passed through.
    await listOrganizationTemplatesAction(ORG, { scope: "everyone&organizationId=x", status: "all" });
    expect(urlOf(4)).toMatch(/\/templates$/);
    await listOrganizationVendorsAction(ORG, { page: 2, search: "audio", status: "active" });
    expect(urlOf(5)).toMatch(/\/vendors\?page=2&search=audio&status=active$/);
    await listOrganizationVendorsAction(ORG, { status: "deleted", ...({ category: "x", organizationId: "y" } as object) });
    expect(urlOf(6)).toMatch(/\/vendors$/);
  });

  it.each(ALL)("$name: maps each refusal to its own state, and passes no backend text through", async ({ run }) => {
    const cases: Array<[number, unknown, string]> = [
      [401, { success: false, code: "AUTHENTICATION_REQUIRED", message: "Authentication required." }, "session_ended"],
      [403, { success: false, code: "STAFF_ACCESS_FORBIDDEN", message: "Only RFPilot staff can do that." }, "forbidden"],
      [403, { success: false, message: "Forbidden" }, "forbidden"],
      [404, { success: false, code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." }, "organization_not_found"],
      [404, { success: false, code: "PROPOSAL_NOT_FOUND", message: "Proposal not found." }, "record_not_found"],
      [404, { success: false, code: "TEMPLATE_NOT_FOUND", message: "Template not found." }, "record_not_found"],
      // What the backend's catch-all answers before the release that adds the route.
      [404, { success: false, message: "Route not found" }, "not_available"],
      [429, { success: false, message: "Too many requests. Please try again later." }, "rate_limited"],
      [400, { success: false, code: "INVALID_ORGANIZATION_ID", message: "That is not an organization id." }, "invalid_id"],
      [500, { success: false, code: "STAFF_ACCESS_INTERNAL_ERROR", message: "MongoServerError: …" }, "unavailable"],
    ];
    for (const [status, body, failure] of cases) {
      mockedFetch.mockResolvedValue(jsonResponse(status, body));
      expect({ status, result: await run() }).toEqual({ status, result: { ok: false, failure } });
    }
    // A proxy's HTML 404 is "not available yet" too.
    mockedFetch.mockResolvedValue({ ok: false, status: 404, json: async () => { throw new Error("not json"); } } as unknown as Response);
    expect(await run()).toEqual({ ok: false, failure: "not_available" });
    mockedFetch.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:8000"));
    expect(await run()).toEqual({ ok: false, failure: "unavailable" });
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true }));
    expect(await run()).toEqual({ ok: false, failure: "unavailable" });
  });

  it("shows nothing when a response is for another organization or another record", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { organizationId: "6a0000000000000000000099", rfps: [{ id: PROPOSAL, eventName: "Leaked" }], pagination: PAGINATION } }));
    expect(await listOrganizationProposalsAction(ORG)).toEqual({ ok: false, failure: "unavailable" });
    mockedFetch.mockResolvedValue(data({ rfp: { id: "6b0000000000000000000009" }, owner: null }));
    expect(await getOrganizationProposalAction(ORG, PROPOSAL)).toEqual({ ok: false, failure: "unavailable" });
    mockedFetch.mockResolvedValue(data({ proposalId: "6b0000000000000000000009", vendorResponses: [] }));
    expect(await listOrganizationVendorResponsesAction(ORG, PROPOSAL)).toEqual({ ok: false, failure: "unavailable" });
    mockedFetch.mockResolvedValue(data({ template: { id: "6d0000000000000000000009", content: {} } }));
    expect(await getOrganizationTemplateAction(ORG, TEMPLATE)).toEqual({ ok: false, failure: "unavailable" });
  });
});

// ---- The admin app as a whole ----

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const sourceFiles = (directory: string): string[] =>
  readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(process.cwd(), relative)).isDirectory()) return sourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry) ? [relative] : [];
  });

describe("how the admin app reads customer content", () => {
  const sources = ["app", "components", "lib", "config"].flatMap(sourceFiles);
  const CONTENT_ROOT = "app/(page)/organizations/[organizationId]";
  const contentPages = sourceFiles(CONTENT_ROOT).filter((file) => /\/page\.tsx$/.test(file) && file !== `${CONTENT_ROOT}/page.tsx`);

  it("is read-only: the action file makes GET requests and nothing else, uncached", () => {
    const source = read("app/actions/organizationContent.ts");
    expect(source.match(/method: "[A-Z]+"/g)).toEqual(['method: "GET"']);
    expect(source).not.toMatch(/POST|PUT|PATCH|DELETE|body:/);
    expect(source).not.toMatch(/unstable_cache|force-cache|revalidate|"use cache"/);
    expect(source.match(/authenticatedBackendFetch\(/g)).toHaveLength(1);
    // The staff check and the id checks come before the request.
    expect(source.indexOf("await checkStaffAdmin()")).toBeGreaterThan(-1);
    expect(source.indexOf("await checkStaffAdmin()")).toBeLessThan(source.indexOf("isContentId(ids.organizationId)"));
    expect(source.indexOf("isContentId(ids.organizationId)")).toBeLessThan(source.indexOf("authenticatedBackendFetch("));
  });

  it("no longer calls the grant routes, the grant polling route or the ungated proposal routes", () => {
    expect(sources.filter((file) => /admin\/support-access|api\/support-access|api\/admin\/proposals/.test(read(file)))).toEqual([]);
    expect(sources.filter((file) => /supportAccess\/|GrantWorkspace|grantSession/.test(read(file)))).toEqual([]);
    expect(sources.filter((file) => /^app\/api\/support-access/.test(file))).toEqual([]);
  });

  it("never polls a staff content route: no timer and no refresh in the content pages or components", () => {
    for (const file of [...sourceFiles(CONTENT_ROOT), ...sourceFiles("components/organizations/content"), "app/actions/organizationContent.ts", "lib/organizationContent/content.ts"]) {
      if (file === `${CONTENT_ROOT}/page.tsx` || file === `${CONTENT_ROOT}/loading.tsx`) continue;
      expect({ file, polls: /setInterval|setTimeout|router\.refresh|revalidatePath|SupportAutoRefresh|"use client"/.test(read(file)) }).toEqual({ file, polls: false });
    }
  });

  it("has a page for every section, each rendered per request and making exactly the one read it shows", () => {
    const expected: Record<string, [action: string, loader: string]> = {
      "proposals/page.tsx": ["listOrganizationProposalsAction", "loadProposalsPage"],
      "proposals/[proposalId]/page.tsx": ["getOrganizationProposalAction", "loadProposalPage"],
      "proposals/[proposalId]/vendor-responses/page.tsx": ["listOrganizationVendorResponsesAction", "loadVendorResponsesPage"],
      "members/page.tsx": ["listOrganizationMembersAction", "loadMembersPage"],
      "teams/page.tsx": ["listOrganizationTeamsAction", "loadTeamsPage"],
      "templates/page.tsx": ["listOrganizationTemplatesAction", "loadTemplatesPage"],
      "templates/[templateId]/page.tsx": ["getOrganizationTemplateAction", "loadTemplatePage"],
      "vendors/page.tsx": ["listOrganizationVendorsAction", "loadVendorsPage"],
    };
    expect(contentPages.map((file) => file.replace(`${CONTENT_ROOT}/`, "")).sort()).toEqual(Object.keys(expected).sort());
    for (const [page, [action, loader]] of Object.entries(expected)) {
      const source = read(`${CONTENT_ROOT}/${page}`);
      expect({ page, actions: [...new Set(source.match(/\b\w+Action\b/g) ?? [])] }).toEqual({ page, actions: [action] });
      expect({ page, loaders: [...new Set(source.match(/\bload\w+Page\b/g) ?? [])] }).toEqual({ page, loaders: [loader] });
      // The action is handed to the loader and called nowhere else.
      expect(source.match(new RegExp(`\\b${action}\\b`, "g"))).toHaveLength(2);
      expect(source).toMatch(new RegExp(`await ${loader}\\(\\{ \\w+: ${action} \\}, organizationId`));
      expect(source).toMatch(/export const dynamic = "force-dynamic"/);
      expect(source).not.toMatch(/export const revalidate|unstable_cache|"use cache"|authenticatedBackendFetch|fetch\(|getOrganizationAccountAction/);
      // Loading state beside every page.
      expect(sourceFiles(CONTENT_ROOT)).toContain(`${CONTENT_ROOT}/${page.replace(/page\.tsx$/, "loading.tsx")}`);
    }
  });

  it("sends the old proposal directory to Organizations, fetching nothing", () => {
    for (const page of ["app/(page)/proposals/page.tsx", "app/(page)/proposals/[id]/page.tsx"]) {
      const source = read(page);
      expect(source).toMatch(/redirect\(ORGANIZATIONS_PATH\)/);
      expect(source).not.toMatch(/Action\(|fetch\(/);
    }
    // Nothing links to a top-level /proposals page (the action's API path segments are not links).
    expect(sources.filter((file) => file !== "app/actions/organizationContent.ts" && /["'`]\/proposals/.test(read(file)))).toEqual([]);
  });

  it("redirects every old Support access address, reading nothing", () => {
    const base = "app/(page)/support-access";
    const pages = sourceFiles(base);
    expect(pages.sort()).toEqual([
      `${base}/[organizationId]/page.tsx`,
      `${base}/[organizationId]/rfps/[rfpId]/page.tsx`,
      `${base}/[organizationId]/rfps/[rfpId]/vendor-responses/page.tsx`,
      `${base}/[organizationId]/rfps/page.tsx`,
      `${base}/page.tsx`,
    ]);
    const calls: Record<string, string> = {
      [`${base}/page.tsx`]: "redirect(supportAccessRedirect());",
      [`${base}/[organizationId]/page.tsx`]: "redirect(supportAccessRedirect({ organizationId }));",
      [`${base}/[organizationId]/rfps/page.tsx`]: 'redirect(supportAccessRedirect({ organizationId, rfpId: "" }));',
      [`${base}/[organizationId]/rfps/[rfpId]/page.tsx`]: "redirect(supportAccessRedirect({ organizationId, rfpId }));",
      [`${base}/[organizationId]/rfps/[rfpId]/vendor-responses/page.tsx`]: "redirect(supportAccessRedirect({ organizationId, rfpId, vendorResponses: true }));",
    };
    for (const page of pages) {
      const source = read(page);
      expect({ page, redirects: source.includes(calls[page]) }).toEqual({ page, redirects: true });
      expect(source).not.toMatch(/Action\b|fetch\(|<\w/);
    }
  });

  it("takes Support access out of the navigation", () => {
    const navigation = read("config/navigation.tsx");
    expect(navigation).not.toMatch(/support-access|Support access|Granted/);
    expect(navigation).toMatch(/href: "\/organizations"/);
    expect(navigation).not.toMatch(/proposals/i);
  });

  it("says nowhere on screen that staff need the customer's grant or permission", () => {
    const stripped = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "");
    expect(sources.filter((file) => /\bgrant(s|ed)?\b|Granted to me|permission from|customer's permission/i.test(stripped(file)))).toEqual([]);
  });
});

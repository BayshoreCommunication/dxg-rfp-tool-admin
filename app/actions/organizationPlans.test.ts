import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { revalidatePath } from "next/cache";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import {
  changeOrganizationPlanAction,
  getOrganizationAccountAction,
  getOrganizationPlanAction,
  listOrganizationPlansAction,
} from "./organizationPlans";

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedRevalidate = jest.mocked(revalidatePath);

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const ORG = "a".repeat(24);
const detail = { organization: { id: ORG, plan: "full_access" }, plans: [], history: [], changed: true };

describe("organization plan actions", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedRevalidate.mockReset();
  });

  it("lists through the signed-in admin's session, with the search only when set", async () => {
    const page = { organizations: [], plans: [], pagination: { page: 2, perPage: 20, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: true }, filters: { search: "acme" } };
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: page }));
    await expect(listOrganizationPlansAction("  acme ", 2)).resolves.toEqual({ ok: true, data: page });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/admin\/organization-plans\?page=2&search=acme$/);
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });

    await listOrganizationPlansAction("", 0);
    expect(String(mockedFetch.mock.calls[1][0])).toMatch(/\/organization-plans\?page=1$/);
  });

  it("changes a plan with PUT, sends the note only when given, and refreshes the page", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: detail }));
    await expect(changeOrganizationPlanAction(ORG, "full_access", "  Paid by invoice ")).resolves.toEqual({ ok: true, data: detail });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(String(url)).toMatch(new RegExp(`/api/v1/admin/organization-plans/${ORG}$`));
    expect(init).toMatchObject({ method: "PUT", body: JSON.stringify({ plan: "full_access", note: "Paid by invoice" }) });
    expect(mockedRevalidate).toHaveBeenCalledWith("/organizations");

    await changeOrganizationPlanAction(ORG, "free_trial", "   ");
    expect(mockedFetch.mock.calls[1][1]).toMatchObject({ body: JSON.stringify({ plan: "free_trial" }) });
  });

  it("keeps an id from changing the request path", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(404, { success: false, code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." }));
    await getOrganizationPlanAction("../support/tickets?x=1");
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/organization-plans\/\.\.%2Fsupport%2Ftickets%3Fx%3D1$/);
  });

  it("shows the backend's message and code, and never refreshes after a refusal", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(409, { success: false, code: "PLAN_CHANGE_CONFLICT", message: "This organization's plan was just changed by someone else. Reload and try again." }));
    await expect(changeOrganizationPlanAction(ORG, "full_access")).resolves.toEqual({
      ok: false,
      error: "This organization's plan was just changed by someone else. Reload and try again.",
      code: "PLAN_CHANGE_CONFLICT",
    });
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it("falls back to a plain message when the backend sends none", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(403, {}));
    await expect(listOrganizationPlansAction()).resolves.toEqual({ ok: false, error: "Only RFPilot staff can view or change plans." });

    mockedFetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("not json"); } } as unknown as Response);
    await expect(getOrganizationPlanAction(ORG)).resolves.toEqual({ ok: false, error: "The organization's plan couldn't be loaded." });

    mockedFetch.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:8000"));
    const failed = await changeOrganizationPlanAction(ORG, "full_access");
    expect(failed).toEqual({ ok: false, error: "The server couldn't be reached. Check your connection and try again." });
    expect(JSON.stringify(failed)).not.toContain("10.0.0.5");
  });
});

const account = {
  organization: { id: ORG, name: "Acme Events", slug: "acme-events", createdAt: "2026-03-04T10:00:00.000Z", country: "US", status: "active", kind: "customer", standing: "active" },
  owner: { name: "Dana Whitfield", email: "dana@acme.example" },
  plan: {
    plan: "full_access",
    exempt: false,
    proposals: { created: 4, limit: null, remaining: null, canCreate: true },
    features: { vendorResponses: true, proposalIntelligence: true },
    lastChange: null,
  },
  counts: {
    members: { active: 3, deactivated: 0, byRole: { owner: 1, organization_admin: 1, team_manager: 0, planner: 1, viewer: 0, other: 0 } },
    teams: { active: 1, archived: 0 },
    proposals: { total: 4 },
    openSupportTickets: 0,
  },
  security: {
    requireTwoFactor: false,
    companySso: { configured: false, enabled: false, required: false, type: null },
    domains: [],
    autoApproveDomain: false,
    allowManagerInvites: true,
  },
  activity: { lastSignInAt: null },
  supportAccess: { active: false },
};

describe("organization account action", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedRevalidate.mockReset();
  });

  it("reads one organization's account through the signed-in admin's session", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: account }));
    await expect(getOrganizationAccountAction(ORG)).resolves.toEqual({ ok: true, data: account });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(String(url)).toMatch(new RegExp(`/api/v1/admin/organizations/${ORG}$`));
    expect(init).toMatchObject({ method: "GET" });
  });

  it("returns only the fields the page shows", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(200, { success: true, data: {
          ...account,
          members: [{ email: "someone@acme.example" }],
          supportAccess: { active: true, reason: "Ticket 4411" },
          security: { ...account.security, signInMethods: ["password", "google", "microsoft"] },
        },
      }),
    );
    const result = await getOrganizationAccountAction(ORG);
    expect(result).toEqual({ ok: true, data: { ...account, supportAccess: { active: true } } });
    expect(JSON.stringify(result)).not.toMatch(/someone@acme\.example|Ticket 4411|microsoft/);
  });

  it("never caches the read: every one is recorded in the staff audit trail", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: account }));
    await getOrganizationAccountAction(ORG);
    const init = mockedFetch.mock.calls[0][1] as RequestInit & { next?: unknown };
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
    expect(mockedRevalidate).not.toHaveBeenCalled();
    const source = readFileSync(join(process.cwd(), "app/actions/organizationPlans.ts"), "utf8");
    expect(source).not.toMatch(/unstable_cache|force-cache|revalidate:|"use cache"/);
  });

  it("refuses a malformed id without asking the backend", async () => {
    for (const id of ["", "abc", "../support/tickets?x=1", `${ORG}0`]) {
      await expect(getOrganizationAccountAction(id)).resolves.toEqual({
        ok: false,
        failure: "invalid_id",
        error: "The address is incomplete or mistyped. Open the organization from the Organizations list.",
      });
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("turns each backend refusal into its own plain message", async () => {
    const cases: Array<[number, unknown, string, string]> = [
      [400, { success: false, code: "INVALID_ORGANIZATION_ID", message: "That is not an organization id." }, "invalid_id", "The address is incomplete or mistyped. Open the organization from the Organizations list."],
      [404, { success: false, code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." }, "not_found", "This organization doesn't exist, or it has been removed."],
      [401, { success: false, message: "Authentication required." }, "session_ended", "Sign in again to view this organization."],
      [403, { success: false, code: "PLAN_MANAGEMENT_FORBIDDEN", message: "Only RFPilot staff can do that." }, "forbidden", "Only RFPilot staff can view organization details."],
      [403, { success: false, message: "Forbidden" }, "forbidden", "Only RFPilot staff can view organization details."],
      [429, { success: false, message: "Too many requests. Please try again later." }, "rate_limited", "Wait a few minutes, then open the organization again."],
      [500, { success: false, code: "PLAN_MANAGEMENT_INTERNAL_ERROR", message: "The plan request could not be completed." }, "unavailable", "The server couldn't be reached or didn't answer as expected. Try again in a moment."],
    ];
    for (const [status, body, failure, error] of cases) {
      mockedFetch.mockResolvedValue(jsonResponse(status, body));
      const result = await getOrganizationAccountAction(ORG);
      expect({ status, result }).toEqual({ status, result: { ok: false, failure, error } });
      expect(JSON.stringify(result)).not.toMatch(/[A-Z]{2,}_[A-Z_]+/);
    }
  });

  it("says the details are not available yet when the API has no such route", async () => {
    // What the backend's catch-all answers before the release that adds the route.
    mockedFetch.mockResolvedValue(jsonResponse(404, { success: false, message: "Route not found" }));
    const result = await getOrganizationAccountAction(ORG);
    expect(result).toEqual({
      ok: false,
      failure: "not_available",
      error: "They will appear here after the next RFPilot update. Plans and usage are on the Organizations list in the meantime.",
    });

    // A proxy's HTML 404 is the same case.
    mockedFetch.mockResolvedValue({ ok: false, status: 404, json: async () => { throw new Error("not json"); } } as unknown as Response);
    await expect(getOrganizationAccountAction(ORG)).resolves.toMatchObject({ ok: false, failure: "not_available" });
  });

  it("reports the backend as unavailable when it can't be reached or answers nonsense", async () => {
    mockedFetch.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:8000"));
    const failed = await getOrganizationAccountAction(ORG);
    expect(failed).toMatchObject({ ok: false, failure: "unavailable" });
    expect(JSON.stringify(failed)).not.toContain("10.0.0.5");

    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { organization: { id: "nope" } } }));
    await expect(getOrganizationAccountAction(ORG)).resolves.toMatchObject({ ok: false, failure: "unavailable" });

    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true }));
    await expect(getOrganizationAccountAction(ORG)).resolves.toMatchObject({ ok: false, failure: "unavailable" });
  });
});

// No component harness in this repo (Jest runs in node), so these read the source, the same way
// the support-access tests check their links.
describe("organization detail page wiring", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
  const page = "app/(page)/organizations/[organizationId]/page.tsx";

  it("links each organization in the list to its detail page", () => {
    const directory = read("components/organizations/OrganizationsDirectory.tsx");
    expect(directory).toMatch(/<Link\s+href=\{organizationAccountPath\(organization\.id\)\}\s+prefetch=\{false\}/);
    // "Change plan" stays on the list, in the table and in the phone layout.
    expect(directory.match(/<ChangePlanButton organization=\{organization\} plans=\{plans\} \/>/g)).toHaveLength(2);
  });

  it("never prefetches the audited read: every link to a detail page, anywhere in the app, opts out", () => {
    const sources = (dir: string): string[] =>
      readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? sources(`${dir}/${entry.name}`) : /\.tsx$/.test(entry.name) ? [`${dir}/${entry.name}`] : [],
      );
    // A link built with the path helper, or one that spells out /organizations/<something>.
    const toDetail = /organizationAccountPath\(|["'`{]\/organizations\/|ORGANIZATIONS_PATH\}?\/|ORGANIZATIONS_PATH\s*\+/;
    let found = 0;
    for (const file of [...sources("app"), ...sources("components")]) {
      for (const link of read(file).match(/<Link\b[^>]*>/g) ?? []) {
        if (!toDetail.test(link)) continue;
        found += 1;
        expect({ file, link, optsOut: /prefetch=\{false\}/.test(link) }).toMatchObject({ optsOut: true });
      }
    }
    expect(found).toBeGreaterThanOrEqual(2);
    // Nothing navigates there in code either, where a prefetch would not be visible to this scan.
    for (const file of [...sources("app"), ...sources("components")]) {
      expect({ file, prefetches: /router\.prefetch\(/.test(read(file)) && /organizationAccountPath|\/organizations\//.test(read(file)) }).toMatchObject({ prefetches: false });
    }
  });

  it("renders the page for every request, through the tested loader and nothing else", () => {
    const source = read(page);
    expect(source).toMatch(/export const dynamic = "force-dynamic"/);
    expect(source).not.toMatch(/export const revalidate|unstable_cache|"use cache"/);
    expect(source).toMatch(/loadOrganizationPage\(organizationId, \{\s*account: getOrganizationAccountAction,\s*planTable: getOrganizationPlanAction,\s*\}\)/);
    const actions = source.match(/\b\w+Action\b/g) ?? [];
    expect([...new Set(actions)].sort()).toEqual(["getOrganizationAccountAction", "getOrganizationPlanAction"]);
    expect(source).not.toMatch(/authenticatedBackendFetch|fetch\(/);
  });

  it("says what staff do not see on the page and points to Support access", () => {
    const source = read("components/organizations/OrganizationAccount.tsx");
    expect(source).toMatch(/Members, proposals and other customer content are not shown here\./);
    expect(source).toMatch(/need a support access grant from the organization/);
    expect(source).toMatch(/href=\{SUPPORT_ACCESS_PATH\}/);
    // The platform-wide sign-in list says nothing about one organization, so it is not shown.
    expect(source).not.toMatch(/sign-in methods|signInMethod|Microsoft|Google/i);
  });
});

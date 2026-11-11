jest.mock("server-only", () => ({}));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { GET as activeGrants } from "@/app/api/support-access/active/route";
import {
  getGrantedRfpAction,
  listGrantedAccessAction,
  listGrantedRfpsAction,
  listGrantedVendorResponsesAction,
} from "./supportAccess";

const mockedFetch = jest.mocked(authenticatedBackendFetch);

const ORG = "6a0000000000000000000001";
const RFP = "6b0000000000000000000002";
const OTHER_RFP = "6b0000000000000000000009";
const GRANT = "6c0000000000000000000003";
const expiresAt = () => new Date(Date.now() + 3_600_000).toISOString();
const grant = (overrides: Record<string, unknown> = {}) => ({ id: GRANT, scope: "organization", proposalId: null, expiresAt: expiresAt(), secondsRemaining: 3_600, ...overrides });

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const urlOf = (call: number) => String(mockedFetch.mock.calls[call][0]);

describe("support access actions (ORG-406)", () => {
  beforeEach(() => mockedFetch.mockReset());

  it("lists the grants given to RFPilot Support from the grant route, uncached", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(200, { success: true, data: { grants: [{ ...grant(), organization: { id: ORG, name: "Northwind Events" }, rfp: null, reason: null }] } }),
    );
    const result = await listGrantedAccessAction();
    expect(result.ok && result.data.map((item) => item.organization.name)).toEqual(["Northwind Events"]);
    expect(urlOf(0)).toMatch(/\/api\/v1\/admin\/support-access\/grants$/);
    expect(mockedFetch.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("reads an organization's RFPs, one RFP and its vendor responses only through the grant routes", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { grants: [grant()], rfps: [], pagination: { page: 2, perPage: 20, total: 0, totalPages: 1 } } }));
    expect((await listGrantedRfpsAction(ORG, { page: 2, search: "  summit " })).ok).toBe(true);
    expect(urlOf(0)).toMatch(new RegExp(`/api/v1/admin/support-access/organizations/${ORG}/rfps\\?page=2&search=summit$`));

    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { grant: grant(), rfp: { id: RFP }, owner: null } }));
    expect((await getGrantedRfpAction(ORG, RFP)).ok).toBe(true);
    expect(urlOf(1)).toMatch(new RegExp(`/support-access/organizations/${ORG}/rfps/${RFP}$`));

    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { grant: grant(), proposalId: RFP, vendorResponses: [] } }));
    expect((await listGrantedVendorResponsesAction(ORG, RFP)).ok).toBe(true);
    expect(urlOf(2)).toMatch(new RegExp(`/support-access/organizations/${ORG}/rfps/${RFP}/vendor-responses$`));
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it("reports an expired or revoked grant as grant_required so the agent returns to the list", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(403, { success: false, code: "SUPPORT_GRANT_REQUIRED", message: "…" }));
    for (const result of [await listGrantedRfpsAction(ORG), await getGrantedRfpAction(ORG, RFP), await listGrantedVendorResponsesAction(ORG, RFP)]) {
      expect(result).toEqual({ ok: false, failure: "grant_required", error: "This organization hasn't granted RFPilot Support access, or the access has ended." });
    }
  });

  it("keeps RFP wording off refusals that aren't about an RFP", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(404, { message: "Cannot GET" }));
    expect(await listGrantedAccessAction()).toMatchObject({ ok: false, failure: "error" });
    expect(await listGrantedRfpsAction(ORG)).toMatchObject({ ok: false, failure: "error" });
  });

  it("reports an RFP the grants don't cover as not found, with no detail about it", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(404, { success: false, code: "PROPOSAL_NOT_FOUND", message: "RFP not found." }));
    expect(await getGrantedRfpAction(ORG, RFP)).toEqual({ ok: false, failure: "not_found", error: "RFP not found." });
    expect(await listGrantedVendorResponsesAction(ORG, RFP)).toEqual({ ok: false, failure: "not_found", error: "RFP not found." });
  });

  it("refuses malformed ids without calling the backend", async () => {
    expect(await listGrantedRfpsAction("../../admin/proposals")).toMatchObject({ ok: false, failure: "grant_required" });
    expect(await getGrantedRfpAction(ORG.toUpperCase(), RFP)).toMatchObject({ ok: false, failure: "grant_required" });
    expect(await getGrantedRfpAction(ORG, "abc")).toMatchObject({ ok: false, failure: "not_found" });
    expect(await listGrantedVendorResponsesAction(ORG, `${RFP}?x=1`)).toMatchObject({ ok: false, failure: "not_found" });
    expect(await (await activeGrants(new Request("http://admin.test/api/support-access/active?organizationId=nope"))).json()).toEqual({ active: [] });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("shows nothing when a response lacks its grant, is for another RFP, or falls outside the grant", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { rfp: { id: RFP }, owner: null } }));
    expect(await getGrantedRfpAction(ORG, RFP)).toMatchObject({ ok: false, failure: "error" });
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { grant: grant(), rfp: { id: OTHER_RFP }, owner: null } }));
    expect(await getGrantedRfpAction(ORG, RFP)).toMatchObject({ ok: false, failure: "error" });
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { grant: grant({ scope: "rfp", proposalId: OTHER_RFP }), rfp: { id: RFP }, owner: null } }));
    expect(await getGrantedRfpAction(ORG, RFP)).toMatchObject({ ok: false, failure: "error" });
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { grants: [], rfps: [{ id: RFP, eventName: "Leaked" }] } }));
    expect(await listGrantedRfpsAction(ORG)).toMatchObject({ ok: false, failure: "error" });
  });

  it("never throws, and never passes a backend or network message through", async () => {
    mockedFetch.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:8000"));
    expect(await listGrantedAccessAction()).toEqual({ ok: false, failure: "error", error: "Support access could not be loaded. Please try again in a moment." });
    mockedFetch.mockResolvedValue(jsonResponse(500, { success: false, code: "SUPPORT_ACCESS_INTERNAL_ERROR", message: "MongoServerError: …" }));
    expect(await listGrantedRfpsAction(ORG)).toEqual({ ok: false, failure: "error", error: "Support access could not be loaded. Please try again in a moment." });
  });

  it("tells an open workspace which grants are still active without reading any RFP", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: {
          grants: [
            { ...grant(), organization: { id: ORG, name: "Northwind" } },
            { ...grant({ id: "6c0000000000000000000007" }), organization: { id: "6a0000000000000000000099", name: "Other" } },
          ],
        },
      }),
    );
    const check = () => activeGrants(new Request(`http://admin.test/api/support-access/active?organizationId=${ORG}`));
    const response = await check();
    expect(await response.json()).toEqual({ active: [GRANT] });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(urlOf(0)).toMatch(/\/support-access\/grants$/);
    mockedFetch.mockResolvedValue(jsonResponse(503, {}));
    expect((await check()).status).toBe(503);
  });
});

// ---- The admin app as a whole: customer RFPs are reachable only through a grant ----

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const sourceFiles = (directory: string): string[] =>
  readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(process.cwd(), relative)).isDirectory()) return sourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry) ? [relative] : [];
  });

describe("customer RFPs are reachable only through a grant (ORG-406)", () => {
  const sources = ["app", "components", "lib", "config"].flatMap(sourceFiles);

  it("no longer calls the ungated RFP routes anywhere in the app", () => {
    const offenders = sources.filter((file) => /api\/admin\/proposals/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("sends the old RFP directory and RFP pages to Granted to me, fetching nothing", () => {
    for (const page of ["app/(page)/proposals/page.tsx", "app/(page)/proposals/[id]/page.tsx"]) {
      const source = read(page);
      expect(source).toMatch(/redirect\(SUPPORT_ACCESS_PATH\)/);
      expect(source).not.toMatch(/Action\(|fetch\(/);
    }
  });

  it("links to an RFP only by its granting organization", () => {
    const offenders = sources.filter((file) => /["'`]\/proposals/.test(read(file)));
    expect(offenders).toEqual([]);
    expect(read("components/clients/ClientDetilas.tsx")).not.toMatch(/support-access|\/proposals/);
  });

  it("puts Support access in the sidebar in place of the all-organization directory", () => {
    const navigation = read("config/navigation.tsx");
    expect(navigation).toMatch(/title: "Support access",\s+shortTitle: "Access",\s+href: "\/support-access"/);
    expect(navigation).toMatch(/href: "\/organizations"/);
    expect(navigation).not.toMatch(/proposals/i);
  });

  it("shows every customer RFP screen inside the grant banner", () => {
    for (const page of [
      "app/(page)/support-access/[organizationId]/page.tsx",
      "app/(page)/support-access/[organizationId]/rfps/[rfpId]/page.tsx",
      "app/(page)/support-access/[organizationId]/rfps/[rfpId]/vendor-responses/page.tsx",
    ]) {
      const source = read(page);
      expect(source).toMatch(/<GrantWorkspace /);
      expect(source).toMatch(/failure === "grant_required"\) redirect\(accessEndedPath\(\)\)/);
      expect(source).toMatch(/force-dynamic/);
    }
  });

  it("never prefetches an audited read: links into granted data opt out", () => {
    for (const file of sourceFiles("components/supportAccess")) {
      const source = read(file);
      const links = source.match(/<Link\b[^>]*>/g) ?? [];
      for (const link of links) {
        if (/href=\{?(SUPPORT_ACCESS_PATH|"\/support-access")/.test(link)) continue;
        expect({ file, link, optsOut: /prefetch=\{false\}/.test(link) }).toMatchObject({ optsOut: true });
      }
    }
  });

  it("says RFP, never proposal, on the support access screens", () => {
    for (const file of [...sourceFiles("components/supportAccess"), ...sourceFiles("app/(page)/support-access")]) {
      const visible = read(file)
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\bproposal(\.|\[|,| \}|\))/g, "")
        .replace(/rfp: proposal/g, "");
      expect({ file, saysProposal: /proposal/i.test(visible) }).toEqual({ file, saysProposal: false });
    }
  });
});

jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { auth } from "@/auth";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { loadLegacyCustomerForPlacement } from "./legacyCustomerForPlacement";

// The place page's one customer. The same tables as the placement actions
// (app/actions/legacyCustomers.test.ts): the staff check first, the id checked, one read, a
// refusal as a fixed kind with none of the backend's text; and only the one customer returned.

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedAuth = auth as unknown as jest.Mock;

const USER = "6a0000000000000000000001";
const OTHER = "6a0000000000000000000002";
const ABSENT = "6a00000000000000000000ff";
const ORG = "6b0000000000000000000002";

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
  }) as unknown as Response;
const refusal = (status: number, code?: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  // The message is what the backend would say. No test may find it in a result.
  jsonResponse(status, { success: false, ...(code ? { code } : {}), message: "BACKEND TEXT mongodb://host/secret", ...extra }, headers);

const LIST = [
  { userId: OTHER, name: "Grace Hopper", email: "grace@example.com", company: "Navy Events", holdingOrganizationId: ORG, proposalCount: 9 },
  { userId: USER, name: "Ada", email: "ada@example.com", company: null, holdingOrganizationId: ORG, proposalCount: 3, passwordHash: "x" },
  { userId: "6a0000000000000000000003", name: "Linus", email: "linus@example.com", company: "Kernel Co", proposalCount: 1 },
];
const listed = () => jsonResponse(200, { success: true, data: { customers: LIST } });

beforeEach(() => {
  mockedFetch.mockReset();
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue({ user: { role: "admin" } });
});

describe("the one legacy customer the place page is about", () => {
  it("makes one request, to the list route, uncached, with no key and no body", async () => {
    mockedFetch.mockResolvedValue(listed());
    expect(await loadLegacyCustomerForPlacement(USER)).toMatchObject({ ok: true });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const url = String(mockedFetch.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/admin\/legacy-customers$/);
    expect(url).not.toMatch(/api\/v1\/admin\/legacy|undefined|null/);
    // The id is matched here: it is never sent.
    expect(url).not.toContain(USER);
    const init = mockedFetch.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(init.body).toBeUndefined();
  });

  it("returns only the customer asked for, as an allowlist, and nobody else's row", async () => {
    mockedFetch.mockResolvedValue(listed());
    const result = await loadLegacyCustomerForPlacement(USER);
    expect(result).toEqual({ ok: true, data: { userId: USER, name: "Ada", email: "ada@example.com", company: null, proposalCount: 3 } });
    expect(JSON.stringify(result)).not.toMatch(/Grace|grace@|Navy|Linus|linus@|Kernel|holdingOrganizationId|passwordHash/);
    expect(Array.isArray((result as { data: unknown }).data)).toBe(false);
  });

  it("says not found, with no row at all, for a customer who is not in the list", async () => {
    mockedFetch.mockResolvedValue(listed());
    const result = await loadLegacyCustomerForPlacement(ABSENT);
    expect(result).toEqual({ ok: true, data: null });
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { customers: [] } }));
    expect(await loadLegacyCustomerForPlacement(USER)).toEqual({ ok: true, data: null });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("an answer that is not a list is unavailable, never a customer", async () => {
    for (const body of [null, {}, { success: true }, { success: true, data: { customers: "x" } }]) {
      mockedFetch.mockResolvedValue(jsonResponse(200, body));
      expect(await loadLegacyCustomerForPlacement(USER)).toEqual({ ok: false, failure: "unavailable" });
    }
  });

  describe("staff check comes first", () => {
    it("a signed-out session sends nothing", async () => {
      for (const session of [null, { user: null }, { user: { role: "admin" }, authError: "SessionExpired" }]) {
        mockedAuth.mockResolvedValue(session);
        expect(await loadLegacyCustomerForPlacement(USER)).toEqual({ ok: false, failure: "session_ended" });
      }
      mockedAuth.mockRejectedValue(new Error("auth down"));
      expect(await loadLegacyCustomerForPlacement(USER)).toEqual({ ok: false, failure: "session_ended" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it("a session that is not a staff admin sends nothing", async () => {
      for (const role of ["user", "planner", "organization_admin", "owner", "", undefined]) {
        mockedAuth.mockResolvedValue({ user: { role } });
        expect(await loadLegacyCustomerForPlacement(USER)).toEqual({ ok: false, failure: "forbidden" });
      }
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it.each(["admin", "superadmin", "super_admin", "SUPER_ADMIN"])("lets the staff role %s through", async (role) => {
      mockedAuth.mockResolvedValue({ user: { role } });
      mockedFetch.mockResolvedValue(listed());
      expect(await loadLegacyCustomerForPlacement(USER)).toMatchObject({ ok: true, data: { userId: USER } });
    });

    it("checks the session before it looks at the id", async () => {
      mockedAuth.mockResolvedValue({ user: { role: "user" } });
      expect(await loadLegacyCustomerForPlacement("nope")).toEqual({ ok: false, failure: "forbidden" });
      mockedAuth.mockResolvedValue(null);
      expect(await loadLegacyCustomerForPlacement("nope")).toEqual({ ok: false, failure: "session_ended" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });
  });

  describe("ids", () => {
    const BAD_IDS = ["", "abc", "6A0000000000000000000001", "6a000000000000000000000", "6a00000000000000000000011", "../placements", `${USER}/placements`, `${USER}?x=1`, null, undefined, 5, {}, [USER]];

    it.each(BAD_IDS)("refuses the user id %p before any request", async (id) => {
      expect(await loadLegacyCustomerForPlacement(id)).toEqual({ ok: false, failure: "invalid_id" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });
  });

  describe("refusals are mapped to a fixed kind", () => {
    const run = () => loadLegacyCustomerForPlacement(USER);

    it("403 PLACEMENT_FORBIDDEN and a plain 403 are forbidden", async () => {
      mockedFetch.mockResolvedValue(refusal(403, "PLACEMENT_FORBIDDEN"));
      expect(await run()).toEqual({ ok: false, failure: "forbidden" });
      mockedFetch.mockResolvedValue(refusal(403));
      expect(await run()).toEqual({ ok: false, failure: "forbidden" });
      mockedFetch.mockResolvedValue(refusal(403, "STAFF_ORGANIZATION_REQUIRED"));
      expect(await run()).toEqual({ ok: false, failure: "staff_organization_required" });
    });

    it("429 PLACEMENT_RATE_LIMITED is rate_limited, with Retry-After when it is usable", async () => {
      mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_RATE_LIMITED", {}, { "Retry-After": "412" }));
      expect(await run()).toEqual({ ok: false, failure: "rate_limited", retryAfterSeconds: 412 });
      for (const header of ["0", "-5", "soon", "Wed, 18 Nov 2026 10:00:00 GMT", "99999999"]) {
        mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_RATE_LIMITED", {}, { "Retry-After": header }));
        expect(await run()).toEqual({ ok: false, failure: "rate_limited" });
      }
      mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_RATE_LIMITED", {}, { "Retry-After": "5000" }));
      expect(await run()).toEqual({ ok: false, failure: "rate_limited", retryAfterSeconds: 900 });
      mockedFetch.mockResolvedValue(refusal(429));
      expect(await run()).toEqual({ ok: false, failure: "rate_limited" });
    });

    it("429 PLACEMENT_CAPACITY_REACHED is its own kind", async () => {
      mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_CAPACITY_REACHED", {}, { "Retry-After": "30" }));
      expect(await run()).toEqual({ ok: false, failure: "capacity_reached", retryAfterSeconds: 30 });
    });

    it("503 PLACEMENT_REQUIRES_MIGRATION_ROLE is not_configured", async () => {
      mockedFetch.mockResolvedValue(refusal(503, "PLACEMENT_REQUIRES_MIGRATION_ROLE"));
      expect(await run()).toEqual({ ok: false, failure: "not_configured" });
      mockedFetch.mockResolvedValue(refusal(503, "PLACEMENT_TASK_MISCONFIGURED"));
      expect(await run()).toEqual({ ok: false, failure: "misconfigured" });
      mockedFetch.mockResolvedValue(refusal(503));
      expect(await run()).toEqual({ ok: false, failure: "unavailable" });
    });

    it("401, 404 without a code, 500 and a network failure", async () => {
      mockedFetch.mockResolvedValue(refusal(401, "AUTHENTICATION_REQUIRED"));
      expect(await run()).toEqual({ ok: false, failure: "session_ended" });
      mockedFetch.mockResolvedValue(refusal(404));
      expect(await run()).toEqual({ ok: false, failure: "not_available" });
      mockedFetch.mockResolvedValue(refusal(500, "PLACEMENT_INTERNAL_ERROR"));
      expect(await run()).toEqual({ ok: false, failure: "unavailable" });
      mockedFetch.mockResolvedValue(jsonResponse(502, null));
      expect(await run()).toEqual({ ok: false, failure: "unavailable" });
      mockedFetch.mockRejectedValue(new Error("fetch failed: ECONNREFUSED 10.0.0.1"));
      expect(await run()).toEqual({ ok: false, failure: "unavailable" });
    });

    it("never returns the backend's message, whatever the refusal", async () => {
      const codes = [undefined, "PLACEMENT_FORBIDDEN", "PLACEMENT_RATE_LIMITED", "PLACEMENT_CAPACITY_REACHED", "PLACEMENT_REQUIRES_MIGRATION_ROLE", "PLACEMENT_IN_PROGRESS", "NOT_A_LEGACY_CUSTOMER", "PLACEMENT_NOT_FOUND", "PLACEMENT_INTERNAL_ERROR", "BRAND_NEW_CODE"];
      for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
        for (const code of codes) {
          mockedFetch.mockResolvedValue(refusal(status, code, { details: { reason: "BACKEND TEXT in details" } }));
          const result = await run();
          expect(result.ok).toBe(false);
          expect(JSON.stringify(result)).not.toMatch(/BACKEND TEXT|mongodb|message|details/);
        }
      }
    });
  });
});

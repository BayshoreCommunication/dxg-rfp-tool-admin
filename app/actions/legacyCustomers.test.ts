jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { auth } from "@/auth";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import * as actions from "./legacyCustomers";

const {
  getPlacementRunAction,
  listLegacyCustomersAction,
  listPlacementTeamsAction,
  placeLegacyCustomerAction,
  rollbackPlacementRunAction,
  searchPlacementTargetsAction,
} = actions;

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedAuth = auth as unknown as jest.Mock;

const USER = "6a0000000000000000000001";
const ORG = "6b0000000000000000000002";
const TEAM = "6c0000000000000000000003";
const RUN = "placement-2026-11-18T10:00:00.000Z-0a1b2c3d";
const RUN_PATH = "placement-2026-11-18T10%3A00%3A00.000Z-0a1b2c3d";
const KEY = "3f1c9a52-7d7e-4b9e-9a51-0f6f6c1d2e3f";
const API = "/api/admin/legacy-customers";

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
const urlOf = (call = 0) => String(mockedFetch.mock.calls[call][0]);
const initOf = (call = 0) => mockedFetch.mock.calls[call][1] as RequestInit & { headers: Record<string, string> };
const bodyOf = (call = 0) => JSON.parse(String(initOf(call).body));

const RUN_VIEW = { runId: RUN, userId: USER, targetOrganizationId: ORG, createdOrganization: false, role: "planner", state: "queued", status: "queued", operation: "placement", rollbackRequired: false, task: null };
const NEW = { target: "new", organization: { name: "Acme Events" } };
const EXISTING = { target: "existing", organizationId: ORG, role: "planner" };

/** Every action with valid arguments, the request it makes and an answer that satisfies it. */
const ALL: Array<{ name: string; run: () => Promise<{ ok: boolean }>; method: string; url: RegExp; answer: () => Response }> = [
  { name: "list", run: () => listLegacyCustomersAction(), method: "GET", url: new RegExp(`${API}$`), answer: () => jsonResponse(200, { success: true, data: { customers: [] } }) },
  { name: "search", run: () => searchPlacementTargetsAction("acme"), method: "GET", url: new RegExp(`${API}/target-organizations\\?q=acme$`), answer: () => jsonResponse(200, { success: true, data: { organizations: [] } }) },
  { name: "teams", run: () => listPlacementTeamsAction(ORG), method: "GET", url: new RegExp(`/api/v1/admin/organizations/${ORG}/teams$`), answer: () => jsonResponse(200, { success: true, data: { organizationId: ORG, teams: [] } }) },
  { name: "place", run: () => placeLegacyCustomerAction(USER, EXISTING, KEY), method: "POST", url: new RegExp(`${API}/${USER}/placements$`), answer: () => jsonResponse(202, { success: true, data: { placement: RUN_VIEW, replayed: false } }) },
  { name: "run", run: () => getPlacementRunAction(RUN), method: "GET", url: new RegExp(`${API}/placements/${RUN_PATH}$`), answer: () => jsonResponse(200, { success: true, data: { placement: RUN_VIEW } }) },
  { name: "rollback", run: () => rollbackPlacementRunAction(RUN, KEY), method: "POST", url: new RegExp(`${API}/placements/${RUN_PATH}/rollback$`), answer: () => jsonResponse(202, { success: true, data: { placement: { ...RUN_VIEW, operation: "rollback" }, replayed: false } }) },
];
/** The five placement routes; the teams read is the content browser's and has its own tests. */
const PLACEMENT = ALL.filter((action) => action.name !== "teams");

beforeEach(() => {
  mockedFetch.mockReset();
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue({ user: { role: "admin" } });
});

describe("legacy customer placement actions", () => {
  it("covers every action the file exports", () => {
    expect(Object.keys(actions).sort()).toEqual([
      "getPlacementRunAction",
      "listLegacyCustomersAction",
      "listPlacementTeamsAction",
      "placeLegacyCustomerAction",
      "rollbackPlacementRunAction",
      "searchPlacementTargetsAction",
    ]);
    expect(ALL).toHaveLength(6);
  });

  it.each(ALL)("$name: one request to its own route, uncached, through the signed-in session", async ({ run, method, url, answer }) => {
    mockedFetch.mockResolvedValue(answer());
    expect(await run()).toMatchObject({ ok: true });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(urlOf()).toMatch(url);
    expect(urlOf()).not.toMatch(/api\/v1\/admin\/legacy|undefined|null/);
    expect(initOf()).toMatchObject({ method, cache: "no-store" });
  });

  describe("staff check comes first", () => {
    it.each(ALL)("$name: a signed-out session sends nothing", async ({ run }) => {
      for (const session of [null, { user: null }, { user: { role: "admin" }, authError: "SessionExpired" }]) {
        mockedAuth.mockResolvedValue(session);
        expect(await run()).toEqual({ ok: false, failure: "session_ended" });
      }
      mockedAuth.mockRejectedValue(new Error("auth down"));
      expect(await run()).toEqual({ ok: false, failure: "session_ended" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it.each(ALL)("$name: a session that is not a staff admin sends nothing", async ({ run }) => {
      for (const role of ["user", "planner", "organization_admin", "owner", "", undefined]) {
        mockedAuth.mockResolvedValue({ user: { role } });
        expect(await run()).toEqual({ ok: false, failure: "forbidden" });
      }
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it.each(["admin", "superadmin", "super_admin", "SUPER_ADMIN"])("lets the staff role %s through", async (role) => {
      mockedAuth.mockResolvedValue({ user: { role } });
      mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { customers: [] } }));
      expect(await listLegacyCustomersAction()).toEqual({ ok: true, data: [] });
    });

    it("checks the session before it looks at the arguments", async () => {
      mockedAuth.mockResolvedValue({ user: { role: "user" } });
      expect(await placeLegacyCustomerAction("nope", { target: "nope" }, "nope")).toEqual({ ok: false, failure: "forbidden" });
      expect(await getPlacementRunAction("nope")).toEqual({ ok: false, failure: "forbidden" });
      expect(await rollbackPlacementRunAction("nope", "nope")).toEqual({ ok: false, failure: "forbidden" });
    });
  });

  describe("ids", () => {
    const BAD_IDS = ["", "abc", "6A0000000000000000000001", `${USER}0`, `${USER}/../x`, "../placements", " ", null, undefined, 42, {}, [USER]];
    const BAD_RUNS = ["", RUN.toUpperCase(), "placement-1", USER, `${RUN}/rollback`, `${RUN}?x=1`, "placement-2026-11-18T10:00:00.000Z-0A1B2C3D", "../x", null, undefined, {}, [RUN]];

    it.each(BAD_IDS)("place refuses the user id %p before any request", async (id) => {
      expect(await placeLegacyCustomerAction(id as string, EXISTING, KEY)).toEqual({ ok: false, failure: "invalid_id" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it.each(BAD_IDS)("teams refuses the organization id %p before any request", async (id) => {
      expect(await listPlacementTeamsAction(id as string)).toEqual({ ok: false, failure: "invalid_id" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it.each(BAD_RUNS)("run and rollback refuse the run id %p before any request", async (id) => {
      expect(await getPlacementRunAction(id as string)).toEqual({ ok: false, failure: "invalid_id" });
      expect(await rollbackPlacementRunAction(id as string, KEY)).toEqual({ ok: false, failure: "invalid_id" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it.each(["", "short", "has space in the key 123", "key\nwith-newline-0123456789", "x".repeat(65), null, undefined, 7])(
      "place and rollback refuse the idempotency key %p before any request",
      async (key) => {
        expect(await placeLegacyCustomerAction(USER, EXISTING, key as string)).toEqual({ ok: false, failure: "invalid_request" });
        expect(await rollbackPlacementRunAction(RUN, key as string)).toEqual({ ok: false, failure: "invalid_request" });
        expect(mockedFetch).not.toHaveBeenCalled();
      },
    );
  });

  describe("the placement body is rebuilt, never passed through", () => {
    const placed = () => mockedFetch.mockResolvedValue(jsonResponse(202, { success: true, data: { placement: RUN_VIEW, replayed: false } }));

    it("sends exactly the fields of an existing-organization placement, with the key as a header", async () => {
      placed();
      const sent = { ...EXISTING, teamId: TEAM, userId: "6f0000000000000000000009", runId: RUN, admin: true, __proto__: { polluted: true }, organization: { name: "Sneaky" }, plan: "full_access" };
      expect(await placeLegacyCustomerAction(USER, sent, KEY)).toEqual({ ok: true, data: { runId: RUN, replayed: false } });
      expect(bodyOf()).toEqual({ target: "existing", organizationId: ORG, role: "planner", teamId: TEAM });
      expect(initOf().headers).toMatchObject({ "Idempotency-Key": KEY, "Content-Type": "application/json" });
    });

    it("leaves the team out when none is chosen", async () => {
      placed();
      for (const teamId of [undefined, null, "", "  "]) await placeLegacyCustomerAction(USER, { ...EXISTING, teamId }, KEY);
      for (let call = 0; call < 4; call++) expect(bodyOf(call)).toEqual({ target: "existing", organizationId: ORG, role: "planner" });
    });

    it("sends exactly the fields of a new organization, trimmed, with unknown fields dropped", async () => {
      placed();
      const sent = {
        target: "new",
        organizationId: ORG,
        role: "owner",
        organization: { name: "  Acme Events  ", type: "agency", industry: " Events ", country: "us", timeZone: "America/New_York", eventsPerYear: "12", plan: "full_access", kind: "legacy_holding", status: "inactive", slug: "x", _id: ORG, verifiedDomains: ["x.com"] },
      };
      expect(await placeLegacyCustomerAction(USER, sent, KEY)).toMatchObject({ ok: true });
      expect(bodyOf()).toEqual({ target: "new", organization: { name: "Acme Events", type: "agency", industry: "Events", country: "US", timeZone: "America/New_York", eventsPerYear: 12 } });
    });

    it("sends only the name when the optional fields are empty", async () => {
      placed();
      await placeLegacyCustomerAction(USER, { target: "new", organization: { name: "Acme", type: "", industry: " ", country: null, timeZone: undefined, eventsPerYear: "" } }, KEY);
      expect(bodyOf()).toEqual({ target: "new", organization: { name: "Acme" } });
    });

    it.each(["owner", "viewer", "admin", "super_admin", "Planner", "", null, undefined, 3, ["planner"], { role: "planner" }])(
      "refuses the role %p before any request",
      async (role) => {
        expect(await placeLegacyCustomerAction(USER, { ...EXISTING, role }, KEY)).toEqual({ ok: false, failure: "invalid_request" });
        expect(mockedFetch).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["no target", {}],
      ["an unknown target", { target: "holding", organizationId: ORG, role: "planner" }],
      ["not an object", "new"],
      ["null", null],
      ["an array", [NEW]],
      ["an organization id that is not an id", { ...EXISTING, organizationId: "acme" }],
      ["a team id that is not an id", { ...EXISTING, teamId: "team-1" }],
      ["no name", { target: "new", organization: {} }],
      ["a blank name", { target: "new", organization: { name: "   " } }],
      ["a name of 201 characters", { target: "new", organization: { name: "x".repeat(201) } }],
      ["a name that is not text", { target: "new", organization: { name: 42 } }],
      ["an unknown type", { target: "new", organization: { name: "Acme", type: "startup" } }],
      ["an industry of 121 characters", { target: "new", organization: { name: "Acme", industry: "x".repeat(121) } }],
      ["a country that is not two letters", { target: "new", organization: { name: "Acme", country: "USA" } }],
      ["a time zone that does not exist", { target: "new", organization: { name: "Acme", timeZone: "Mars/Olympus" } }],
      ["a negative events number", { target: "new", organization: { name: "Acme", eventsPerYear: -1 } }],
      ["a fractional events number", { target: "new", organization: { name: "Acme", eventsPerYear: 1.5 } }],
      ["events above the limit", { target: "new", organization: { name: "Acme", eventsPerYear: 100_001 } }],
      ["events that are not a number", { target: "new", organization: { name: "Acme", eventsPerYear: "many" } }],
    ])("refuses %s before any request", async (_, request) => {
      expect(await placeLegacyCustomerAction(USER, request, KEY)).toEqual({ ok: false, failure: "invalid_request" });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it("accepts the limits themselves", async () => {
      placed();
      const organization = { name: "x".repeat(200), industry: "y".repeat(120), eventsPerYear: 100_000 };
      expect(await placeLegacyCustomerAction(USER, { target: "new", organization }, KEY)).toMatchObject({ ok: true });
      expect(bodyOf()).toEqual({ target: "new", organization });
      await placeLegacyCustomerAction(USER, { target: "new", organization: { name: "Acme", eventsPerYear: 0 } }, KEY);
      expect(bodyOf(1)).toEqual({ target: "new", organization: { name: "Acme", eventsPerYear: 0 } });
    });

    it.each(["organization_admin", "team_manager", "planner"])("accepts the role %s", async (role) => {
      placed();
      expect(await placeLegacyCustomerAction(USER, { ...EXISTING, role }, KEY)).toMatchObject({ ok: true });
      expect(bodyOf().role).toBe(role);
    });

    it("sends a rollback with no body of the caller's and the key as a header", async () => {
      mockedFetch.mockResolvedValue(jsonResponse(202, { success: true, data: { placement: RUN_VIEW, replayed: true } }));
      expect(await rollbackPlacementRunAction(RUN, KEY)).toEqual({ ok: true, data: { runId: RUN, replayed: true } });
      expect(bodyOf()).toEqual({});
      expect(initOf().headers).toMatchObject({ "Idempotency-Key": KEY });
    });

    it("sends no key and no body on a read", async () => {
      mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { placement: RUN_VIEW } }));
      await getPlacementRunAction(RUN);
      expect(initOf().headers).toEqual({ Accept: "application/json" });
      expect(initOf().body).toBeUndefined();
    });
  });

  describe("the organization search", () => {
    it.each(["", "a", " a ", null, undefined, 5, {}])("asks nothing for %p and returns no results", async (search) => {
      expect(await searchPlacementTargetsAction(search as string)).toEqual({ ok: true, data: [] });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it("sends the trimmed text as q, encoded, and at most 100 characters of it", async () => {
      mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { organizations: [] } }));
      await searchPlacementTargetsAction("  acme & co?x=1#  ");
      expect(urlOf()).toMatch(/\/target-organizations\?q=acme\+%26\+co%3Fx%3D1%23$/);
      await searchPlacementTargetsAction("x".repeat(300));
      expect(new URL(urlOf(1), "http://x").searchParams.get("q")).toHaveLength(100);
    });

    it("keeps only the id, name and slug of each organization", async () => {
      mockedFetch.mockResolvedValue(
        jsonResponse(200, { success: true, data: { organizations: [{ organizationId: ORG, name: "Acme", slug: "acme-1a2b3c", plan: "full_access", ownerEmail: "x@y.z" }, { organizationId: "nope", name: "Bad" }, null, { name: "No id" }] } }),
      );
      expect(await searchPlacementTargetsAction("acme")).toEqual({ ok: true, data: [{ organizationId: ORG, name: "Acme", slug: "acme-1a2b3c" }] });
    });
  });

  describe("answers", () => {
    it("keeps only what the list shows of each customer", async () => {
      mockedFetch.mockResolvedValue(
        jsonResponse(200, {
          success: true,
          data: { customers: [{ userId: USER, name: "Ada", email: "ada@example.com", company: null, holdingOrganizationId: ORG, proposalCount: 3, passwordHash: "x" }, { userId: "bad" }, "x"] },
        }),
      );
      expect(await listLegacyCustomersAction()).toEqual({ ok: true, data: [{ userId: USER, name: "Ada", email: "ada@example.com", company: null, proposalCount: 3 }] });
    });

    it("a 202 names the run; so do a 201 and a 200 from a server that places inside the request", async () => {
      mockedFetch.mockResolvedValueOnce(jsonResponse(202, { success: true, data: { placement: RUN_VIEW, replayed: true } }));
      expect(await placeLegacyCustomerAction(USER, NEW, KEY)).toEqual({ ok: true, data: { runId: RUN, replayed: true } });
      mockedFetch.mockResolvedValueOnce(jsonResponse(201, { success: true, data: { placement: { runId: RUN, userId: USER } } }));
      expect(await placeLegacyCustomerAction(USER, NEW, KEY)).toEqual({ ok: true, data: { runId: RUN, replayed: false } });
      mockedFetch.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { rollback: { runId: RUN, state: "rolled_back" } } }));
      expect(await rollbackPlacementRunAction(RUN, KEY)).toEqual({ ok: true, data: { runId: RUN, replayed: false } });
    });

    it("reads a run as an allowlist and never keeps the backend's sentences", async () => {
      mockedFetch.mockResolvedValue(
        jsonResponse(200, {
          success: true,
          data: {
            placement: {
              ...RUN_VIEW,
              state: "failed",
              status: "failed",
              rollbackRequired: true,
              error: "BACKEND TEXT in error",
              adminUserId: "6d0000000000000000000004",
              mongo: { proposals: 3 },
              verification: { passed: false, holdingLeftovers: { mongo: { proposals: 1 }, postgres: { evidence: 2 } }, orphanedProposalsInTarget: 1, lostProposals: ["a", "b"] },
              createdAt: "2026-11-18T10:00:00.000Z",
              task: { operation: "placement", status: "failed", requestedAt: "2026-11-18T10:00:00.000Z", startedAt: null, heartbeatAt: null, finishedAt: "2026-11-18T10:01:00.000Z", code: "PLACEMENT_TASK_LOST", message: "BACKEND TEXT in task", details: { rollbackRequired: true } },
            },
          },
        }),
      );
      const result = await getPlacementRunAction(RUN);
      expect(result).toEqual({
        ok: true,
        data: {
          runId: RUN,
          userId: USER,
          targetOrganizationId: ORG,
          createdOrganization: false,
          role: "planner",
          teamId: null,
          state: "failed",
          status: "failed",
          operation: "placement",
          rollbackRequired: true,
          verification: { passed: false, leftInHolding: 3, orphanedProposalsInTarget: 1, lostProposals: 2 },
          proposalsLeftInTarget: null,
          createdAt: "2026-11-18T10:00:00.000Z",
          updatedAt: null,
          task: { operation: "placement", status: "failed", requestedAt: "2026-11-18T10:00:00.000Z", startedAt: null, heartbeatAt: null, finishedAt: "2026-11-18T10:01:00.000Z", code: "PLACEMENT_TASK_LOST", auditUnconfirmed: false, needsOperatorCheck: false, rolledBack: null },
        },
      });
      expect(JSON.stringify(result)).not.toMatch(/BACKEND TEXT/);
    });

    it.each([
      ["no data", { success: true }],
      ["no run", { success: true, data: {} }],
      ["a run with no id", { success: true, data: { placement: { status: "queued" } } }],
      ["a run with an unknown status", { success: true, data: { placement: { ...RUN_VIEW, status: "exploded" } } }],
      ["not JSON", null],
    ])("treats %s as unavailable", async (_, body) => {
      mockedFetch.mockResolvedValue(jsonResponse(200, body));
      expect(await getPlacementRunAction(RUN)).toEqual({ ok: false, failure: "unavailable" });
    });

    it.each([
      ["no data", { success: true }],
      ["no run", { success: true, data: {} }],
      ["a run with no id", { success: true, data: { placement: { status: "queued" } } }],
      ["a run id that is not one", { success: true, data: { placement: { runId: "../../organizations" } } }],
      ["not JSON", null],
    ])("place and rollback: a 2xx with %s is unavailable, not a run to open", async (_, body) => {
      mockedFetch.mockResolvedValue(jsonResponse(202, body));
      expect(await placeLegacyCustomerAction(USER, NEW, KEY)).toEqual({ ok: false, failure: "unavailable" });
      expect(await rollbackPlacementRunAction(RUN, KEY)).toEqual({ ok: false, failure: "unavailable" });
    });

    it("returns the active teams of the organization, by id and name only", async () => {
      mockedFetch.mockResolvedValue(
        jsonResponse(200, { success: true, data: { organizationId: ORG, teams: [{ id: TEAM, name: "East", archived: false, memberCount: 4 }, { id: "6c0000000000000000000004", name: "Old", archived: true }, { id: "not-an-id", name: "Bad" }] } }),
      );
      expect(await listPlacementTeamsAction(ORG)).toEqual({ ok: true, data: [{ id: TEAM, name: "East" }] });
    });

    it.each([
      [401, undefined, "session_ended"],
      [403, undefined, "forbidden"],
      [429, undefined, "rate_limited"],
      [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
      [404, undefined, "not_available"],
      [500, undefined, "unavailable"],
    ])("teams: a %i %s is %s", async (status, code, failure) => {
      mockedFetch.mockResolvedValue(refusal(status, code));
      expect(await listPlacementTeamsAction(ORG)).toEqual({ ok: false, failure });
    });
  });

  describe("refusals are mapped to a fixed kind", () => {
    it.each(PLACEMENT)("$name: 403 PLACEMENT_FORBIDDEN and a plain 403 are forbidden", async ({ run }) => {
      mockedFetch.mockResolvedValue(refusal(403, "PLACEMENT_FORBIDDEN"));
      expect(await run()).toEqual({ ok: false, failure: "forbidden" });
      mockedFetch.mockResolvedValue(refusal(403));
      expect(await run()).toEqual({ ok: false, failure: "forbidden" });
      mockedFetch.mockResolvedValue(refusal(403, "STAFF_ORGANIZATION_REQUIRED"));
      expect(await run()).toEqual({ ok: false, failure: "staff_organization_required" });
    });

    it.each(PLACEMENT)("$name: 429 PLACEMENT_RATE_LIMITED is rate_limited, with Retry-After when it is usable", async ({ run }) => {
      mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_RATE_LIMITED", {}, { "Retry-After": "412" }));
      expect(await run()).toEqual({ ok: false, failure: "rate_limited", retryAfterSeconds: 412 });
      for (const header of ["0", "-5", "soon", "Wed, 18 Nov 2026 10:00:00 GMT", "99999999"]) {
        mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_RATE_LIMITED", {}, { "Retry-After": header }));
        expect(await run()).toEqual({ ok: false, failure: "rate_limited" });
      }
      mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_RATE_LIMITED", {}, { "Retry-After": "5000" }));
      expect(await run()).toEqual({ ok: false, failure: "rate_limited", retryAfterSeconds: 900 });
      // A 429 with no code (a proxy in front) is an allowance too, never "another placement is running".
      mockedFetch.mockResolvedValue(refusal(429));
      expect(await run()).toEqual({ ok: false, failure: "rate_limited" });
    });

    it.each(PLACEMENT)("$name: 429 PLACEMENT_CAPACITY_REACHED is its own kind", async ({ run }) => {
      mockedFetch.mockResolvedValue(refusal(429, "PLACEMENT_CAPACITY_REACHED", {}, { "Retry-After": "30" }));
      expect(await run()).toEqual({ ok: false, failure: "capacity_reached", retryAfterSeconds: 30 });
    });

    it.each(PLACEMENT)("$name: 503 PLACEMENT_REQUIRES_MIGRATION_ROLE is not_configured", async ({ run }) => {
      mockedFetch.mockResolvedValue(refusal(503, "PLACEMENT_REQUIRES_MIGRATION_ROLE"));
      expect(await run()).toEqual({ ok: false, failure: "not_configured" });
      mockedFetch.mockResolvedValue(refusal(503, "PLACEMENT_TASK_MISCONFIGURED"));
      expect(await run()).toEqual({ ok: false, failure: "misconfigured" });
      mockedFetch.mockResolvedValue(refusal(503));
      expect(await run()).toEqual({ ok: false, failure: "unavailable" });
    });

    it.each(PLACEMENT)("$name: 401, 404 without a code, 500 and a network failure", async ({ run }) => {
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

    it("a 404 PLACEMENT_NOT_FOUND is run_not_found, on the read and on the rollback", async () => {
      mockedFetch.mockResolvedValue(refusal(404, "PLACEMENT_NOT_FOUND"));
      expect(await getPlacementRunAction(RUN)).toEqual({ ok: false, failure: "run_not_found" });
      expect(await rollbackPlacementRunAction(RUN, KEY)).toEqual({ ok: false, failure: "run_not_found" });
    });

    it.each([
      [409, "PLACEMENT_IN_PROGRESS", "placement_in_progress"],
      [409, "NOT_A_LEGACY_CUSTOMER", "already_placed"],
      [409, "ALREADY_A_MEMBER", "already_a_member"],
      [409, "IDEMPOTENCY_KEY_REUSED", "idempotency_conflict"],
      [409, "PLACEMENT_FAILED", "placement_failed"],
      [409, "PLACEMENT_VERIFICATION_FAILED", "verification_failed"],
      [404, "USER_NOT_FOUND", "customer_not_found"],
      [404, "ORGANIZATION_NOT_FOUND", "organization_not_found"],
      [400, "UNKNOWN_TEAM", "unknown_team"],
      [400, "INVALID_ROLE", "invalid_request"],
      [400, "TARGET_REQUIRED", "invalid_request"],
      [400, "ORGANIZATION_NAME_REQUIRED", "invalid_request"],
      [400, "INVALID_ORGANIZATION_TYPE", "invalid_request"],
      [400, "INVALID_IDEMPOTENCY_KEY", "invalid_request"],
      [409, "SOMETHING_NEW", "unavailable"],
      [400, undefined, "unavailable"],
    ])("place: %i %s is %s", async (status, code, failure) => {
      mockedFetch.mockResolvedValue(refusal(status, code));
      expect(await placeLegacyCustomerAction(USER, EXISTING, KEY)).toEqual({ ok: false, failure });
    });

    it.each([
      [409, "PLACEMENT_IN_PROGRESS", "run_still_running"],
      [409, "ROLLBACK_IN_PROGRESS", "rollback_in_progress"],
      [409, "ALREADY_ROLLED_BACK", "already_rolled_back"],
      [409, "NOTHING_TO_ROLL_BACK", "nothing_to_roll_back"],
      [409, "ORGANIZATION_IN_USE", "organization_in_use"],
      [409, "USER_IS_OWNER", "user_is_owner"],
      [409, "ROLLBACK_CONFLICT", "rollback_conflict"],
    ])("rollback: %i %s is %s", async (status, code, failure) => {
      mockedFetch.mockResolvedValue(refusal(status, code));
      expect(await rollbackPlacementRunAction(RUN, KEY)).toEqual({ ok: false, failure });
    });

    it("a task that could not be started names its run, when the id is one", async () => {
      mockedFetch.mockResolvedValue(refusal(503, "PLACEMENT_TASK_START_FAILED", { details: { runId: RUN } }));
      expect(await placeLegacyCustomerAction(USER, NEW, KEY)).toEqual({ ok: false, failure: "start_failed", runId: RUN });
      mockedFetch.mockResolvedValue(refusal(503, "ROLLBACK_TASK_START_FAILED", { details: { runId: "javascript:alert(1)" } }));
      expect(await rollbackPlacementRunAction(RUN, KEY)).toEqual({ ok: false, failure: "start_failed" });
    });

    it("never returns the backend's message, whatever the refusal", async () => {
      const codes = [undefined, "PLACEMENT_FORBIDDEN", "PLACEMENT_RATE_LIMITED", "PLACEMENT_CAPACITY_REACHED", "PLACEMENT_REQUIRES_MIGRATION_ROLE", "PLACEMENT_IN_PROGRESS", "NOT_A_LEGACY_CUSTOMER", "PLACEMENT_NOT_FOUND", "PLACEMENT_INTERNAL_ERROR", "BRAND_NEW_CODE"];
      for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
        for (const code of codes) {
          mockedFetch.mockResolvedValue(refusal(status, code, { details: { reason: "BACKEND TEXT in details" } }));
          for (const { run } of PLACEMENT) {
            const result = await run();
            expect(result.ok).toBe(false);
            expect(JSON.stringify(result)).not.toMatch(/BACKEND TEXT|mongodb|message|details/);
          }
        }
      }
    });
  });
});

import {
  customerLabel,
  customerPageOf,
  customerPageSummary,
  CUSTOMERS_PAGE_SIZE,
  filterCustomers,
  legacyCustomersPagePath,
  pageNumberOf,
  isIdempotencyKey,
  isPlacementId,
  isRunId,
  parsePlacementRun,
  placeCustomerPath,
  placementFailure,
  placementFailureCopy,
  placementRunPath,
  retryAfterSecondsOf,
  runIdFromSegment,
  validatePlacementRequest,
  type PlacementFailure,
} from "@/lib/legacyCustomers/placement";

const USER = "6a0000000000000000000001";
const RUN = "placement-2026-11-18T10:00:00.000Z-0a1b2c3d";

const ALL_FAILURES: PlacementFailure[] = [
  "session_ended", "forbidden", "staff_organization_required", "rate_limited", "capacity_reached", "not_configured", "misconfigured", "start_failed",
  "invalid_id", "invalid_request", "customer_not_found", "already_placed", "placement_in_progress", "organization_not_found", "already_a_member",
  "unknown_team", "idempotency_conflict", "run_not_found", "run_still_running", "rollback_in_progress", "already_rolled_back", "nothing_to_roll_back",
  "organization_in_use", "user_is_owner", "rollback_conflict", "placement_failed", "verification_failed", "not_available", "unavailable",
];

describe("placement ids and paths", () => {
  it("takes 24 lower-case hex as an id and nothing else", () => {
    expect(isPlacementId(USER)).toBe(true);
    for (const value of ["", USER.toUpperCase(), `${USER}a`, USER.slice(1), `${USER}\n`, null, undefined, 1, {}]) expect(isPlacementId(value)).toBe(false);
  });

  it("takes the backend's run id format and nothing else", () => {
    expect(isRunId(RUN)).toBe(true);
    for (const value of ["", "placement-", `${RUN}x`, `x${RUN}`, `${RUN}\n`, RUN.replace("Z", ""), RUN.replace(/-[0-9a-f]{8}$/, "-0a1b2c3"), "placement-2026-11-18T10:00:00.000Z-../../x", null, 5]) {
      expect(isRunId(value)).toBe(false);
    }
  });

  it("reads a run id from an address segment, encoded or not", () => {
    expect(runIdFromSegment(RUN)).toBe(RUN);
    expect(runIdFromSegment(encodeURIComponent(RUN))).toBe(RUN);
    for (const value of ["%E0%A4%A", "%2e%2e%2f", "placements", undefined, null, ["x"]]) expect(runIdFromSegment(value)).toBeNull();
  });

  it("builds the two addresses", () => {
    expect(placeCustomerPath(USER)).toBe(`/legacy-customers/${USER}/place`);
    expect(placementRunPath(RUN)).toBe("/legacy-customers/placements/placement-2026-11-18T10%3A00%3A00.000Z-0a1b2c3d");
    expect(runIdFromSegment(placementRunPath(RUN).split("/").pop())).toBe(RUN);
  });

  it("takes a UUID as an idempotency key", () => {
    expect(isIdempotencyKey("3f1c9a52-7d7e-4b9e-9a51-0f6f6c1d2e3f")).toBe(true);
    for (const value of ["", "short", "with space 0123456789abc", "x".repeat(65), null]) expect(isIdempotencyKey(value)).toBe(false);
  });
});

describe("the placement request", () => {
  it("names the field that is wrong, in words for the form", () => {
    const result = validatePlacementRequest({ target: "new", organization: { name: "", type: "x", industry: "y".repeat(121), country: "USA", timeZone: "Nowhere/None", eventsPerYear: "1.5" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["country", "eventsPerYear", "industry", "name", "timeZone", "type"]);
    const existing = validatePlacementRequest({ target: "existing", organizationId: "x", role: "owner", teamId: "y" });
    if (!existing.ok) expect(Object.keys(existing.errors).sort()).toEqual(["organizationId", "role", "teamId"]);
    expect(validatePlacementRequest(undefined)).toEqual({ ok: false, errors: { target: "Choose a new or an existing organization." } });
  });

  it("never lets Owner or Viewer through as a role", () => {
    for (const role of ["owner", "viewer"]) expect(validatePlacementRequest({ target: "existing", organizationId: USER, role }).ok).toBe(false);
  });
});

describe("refusals", () => {
  it("tells the two 429s apart by code", () => {
    expect(placementFailure(429, "PLACEMENT_RATE_LIMITED", "place")).toBe("rate_limited");
    expect(placementFailure(429, "PLACEMENT_CAPACITY_REACHED", "place")).toBe("capacity_reached");
    expect(placementFailureCopy("rate_limited").title).not.toBe(placementFailureCopy("capacity_reached").title);
    expect(placementFailureCopy("capacity_reached").message).toMatch(/one at a time/);
    expect(placementFailureCopy("rate_limited").message).toMatch(/allowance/);
  });

  it("reads PLACEMENT_IN_PROGRESS by what was asked", () => {
    expect(placementFailure(409, "PLACEMENT_IN_PROGRESS", "place")).toBe("placement_in_progress");
    expect(placementFailure(409, "PLACEMENT_IN_PROGRESS", "rollback")).toBe("run_still_running");
  });

  it("has a title and a sentence for every refusal, and none of them is backend wording", () => {
    for (const failure of ALL_FAILURES) {
      const copy = placementFailureCopy(failure);
      expect(copy.title.length).toBeGreaterThan(5);
      expect(copy.message.length).toBeGreaterThan(20);
      expect(`${copy.title} ${copy.message}`).not.toMatch(/PLACEMENT_|Postgres|MongoDB|migration role|state machine|undefined|null/);
    }
  });

  it("says how long to wait when the answer said", () => {
    expect(placementFailureCopy("rate_limited", 40).message).toMatch(/Try again in about 40 seconds\./);
    expect(placementFailureCopy("rate_limited", 1).message).toMatch(/about 1 second\./);
    expect(placementFailureCopy("rate_limited", 600).message).toMatch(/about 10 minutes\./);
    expect(placementFailureCopy("rate_limited").message).toMatch(/Try again in a few minutes\./);
  });

  it("reads Retry-After as whole seconds only", () => {
    expect(retryAfterSecondsOf("30")).toBe(30);
    expect(retryAfterSecondsOf(" 30 ")).toBe(30);
    expect(retryAfterSecondsOf("1200")).toBe(900);
    for (const value of [null, undefined, "", "0", "-1", "1.5", "soon", "123456"]) expect(retryAfterSecondsOf(value)).toBeNull();
  });
});

describe("the run", () => {
  it("reads the checks from the task's details when the run has none of its own", () => {
    const run = parsePlacementRun({
      runId: RUN,
      status: "rolled_back",
      operation: "rollback",
      task: { operation: "placement", status: "failed", code: "PLACEMENT_VERIFICATION_FAILED", details: { rolledBack: true, verification: { passed: false, holdingLeftovers: { mongo: {}, postgres: {} }, orphanedProposalsInTarget: 0, lostProposals: ["x"] } } },
    });
    expect(run).toMatchObject({ verification: { passed: false, lostProposals: 1 }, task: { rolledBack: true, code: "PLACEMENT_VERIFICATION_FAILED" } });
  });

  it("drops a code that is not an identifier, and ids that are not ids", () => {
    const run = parsePlacementRun({ runId: RUN, status: "failed", userId: "<script>", targetOrganizationId: 5, role: "emperor", task: { operation: "placement", status: "failed", code: "Error: connect ECONNREFUSED 10.0.0.1" } });
    expect(run).toMatchObject({ userId: null, targetOrganizationId: null, role: null, task: { code: null } });
  });

  it("keeps the flags the runbook acts on", () => {
    const run = parsePlacementRun({ runId: RUN, status: "succeeded", leftInTarget: { proposals: 2 }, task: { operation: "placement", status: "failed", details: { auditUnconfirmed: true, needsOperatorCheck: true } } });
    expect(run).toMatchObject({ proposalsLeftInTarget: 2, task: { auditUnconfirmed: true, needsOperatorCheck: true } });
  });
});

describe("the customer list", () => {
  const customers = [
    { userId: USER, name: "Ada Lovelace", email: "ada@example.com", company: "Analytical", proposalCount: 3 },
    { userId: USER, name: null, email: "grace@example.com", company: null, proposalCount: 0 },
  ];
  it("filters by name, email or company, ignoring case", () => {
    expect(filterCustomers(customers, "  ")).toHaveLength(2);
    expect(filterCustomers(customers, "LOVE")).toHaveLength(1);
    expect(filterCustomers(customers, "example.com")).toHaveLength(2);
    expect(filterCustomers(customers, "analytical")).toHaveLength(1);
    expect(filterCustomers(customers, "zzz")).toHaveLength(0);
  });
  it("names a customer by what is on file", () => {
    expect(customerLabel(customers[0])).toBe("Ada Lovelace (ada@example.com)");
    expect(customerLabel(customers[1])).toBe("grace@example.com");
    expect(customerLabel({ name: null, email: null })).toMatch(/no name or email/);
  });
});

describe("the list, cut into pages on the server", () => {
  const many = (length: number) =>
    Array.from({ length }, (_, index) => ({ userId: index.toString(16).padStart(24, "0"), name: `Customer ${index + 1}`, email: `c${index + 1}@example.com`, company: index < 3 ? "Lovelace Ltd" : null, proposalCount: 1 }));

  it("never holds more than 50 rows, whatever is asked", () => {
    expect(CUSTOMERS_PAGE_SIZE).toBe(50);
    for (const length of [0, 1, 49, 50, 51, 120, 1000]) {
      for (const page of [undefined, "1", "2", "20", "999999", "x"]) {
        for (const search of ["", "customer", "lovelace", "zzz"]) {
          const cut = customerPageOf(many(length), page, search);
          expect(cut.customers.length).toBeLessThanOrEqual(50);
          expect(cut.total).toBe(length);
          expect(cut.page).toBeGreaterThanOrEqual(1);
          expect(cut.page).toBeLessThanOrEqual(cut.pageCount);
        }
      }
    }
  });

  it("gives each customer on exactly one page, in the backend's order", () => {
    const all = many(120);
    const seen = [1, 2, 3].flatMap((page) => customerPageOf(all, String(page)).customers);
    expect(seen).toEqual(all);
    expect(customerPageOf(all, "9").page).toBe(3);
  });

  it("takes a page number that is digits only", () => {
    expect(["1", "2", "007", "999999", 4].map(pageNumberOf)).toEqual([1, 2, 7, 999999, 4]);
    for (const bad of ["", "0", "-2", "2.0", "2a", "a2", " 2", "2 ", "1e3", "0x10", "1234567", "二", null, undefined, {}, ["2"], 2.5, -1, NaN, Infinity]) expect(pageNumberOf(bad)).toBe(1);
  });

  it("builds an address that carries a page number and nothing else", () => {
    expect(legacyCustomersPagePath(1)).toBe("/legacy-customers");
    expect(legacyCustomersPagePath(2)).toBe("/legacy-customers?page=2");
    for (const page of [0, -3, 2.5, NaN, "ada@example.com" as unknown as number, "2&q=ada" as unknown as number]) expect(legacyCustomersPagePath(page)).toBe("/legacy-customers");
    for (const page of [1, 2, 37, 999999]) expect(legacyCustomersPagePath(page)).toMatch(/^\/legacy-customers(\?page=[0-9]+)?$/);
  });

  it("says how many of how many, with the right number", () => {
    expect(customerPageSummary(customerPageOf(many(12), "1"))).toBe("");
    expect(customerPageSummary(customerPageOf(many(120), "1"))).toBe("Showing 1 to 50 of 120 customers.");
    expect(customerPageSummary(customerPageOf(many(120), "3"))).toBe("Showing 101 to 120 of 120 customers.");
    expect(customerPageSummary(customerPageOf(many(120), "1", "lovelace"))).toBe("3 of 120 customers match.");
    expect(customerPageSummary(customerPageOf(many(120), "1", "customer 120"))).toBe("1 of 120 customers matches.");
    expect(customerPageSummary(customerPageOf(many(1), "1", "zzz"))).toBe("0 of 1 customer match.");
    expect(customerPageSummary(customerPageOf(many(120), "2", "customer"))).toBe("120 of 120 customers match. Showing 51 to 100.");
    expect(customerPageSummary(customerPageOf(many(1500), "30"))).toBe("Showing 1,451 to 1,500 of 1,500 customers.");
  });
});

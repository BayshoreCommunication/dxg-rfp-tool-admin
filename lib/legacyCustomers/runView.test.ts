import type { LegacyCustomer, PlacementRun, RunStatus, RunTask } from "@/lib/legacyCustomers/placement";
import { canRollBack, reviewLines, rollbackEffects, runHeadline, runInstructions, showsOrganizationLink, taskFailureText, verificationLines } from "@/lib/legacyCustomers/runView";

const ORG = "6b0000000000000000000002";
const TEAM = "6c0000000000000000000003";
const task = (extra: Partial<RunTask> = {}): RunTask => ({
  operation: "placement", status: "succeeded", requestedAt: null, startedAt: null, heartbeatAt: null, finishedAt: null, code: null,
  auditUnconfirmed: false, needsOperatorCheck: false, rolledBack: null, ...extra,
});
const run = (status: RunStatus, extra: Partial<PlacementRun> = {}): PlacementRun => ({
  runId: "placement-2026-11-18T10:00:00.000Z-0a1b2c3d", userId: null, targetOrganizationId: ORG, createdOrganization: false, role: "planner", teamId: null,
  state: null, status, operation: "placement", rollbackRequired: false, verification: null, proposalsLeftInTarget: null, createdAt: null, updatedAt: null, task: null, ...extra,
});

describe("rollback is offered only where the API allows it", () => {
  it.each([
    // What the backend's run view can return, and whether its rollback route would take it.
    ["queued placement", run("queued", { state: "queued" }), false],
    ["running placement", run("running", { state: "started" }), false],
    ["running placement whose move has committed", run("running", { state: "done" }), false],
    ["placed", run("succeeded", { state: "done" }), true],
    ["placed, audit unconfirmed", run("succeeded", { state: "done", task: task({ status: "failed", auditUnconfirmed: true }) }), true],
    ["placed, an earlier rollback failed", run("succeeded", { state: "done", task: task({ operation: "rollback", status: "failed", code: "ROLLBACK_TASK_LOST" }) }), true],
    ["failed, nothing moved", run("failed", { state: "aborted" }), false],
    ["failed, must be rolled back", run("failed", { state: "failed", rollbackRequired: true }), true],
    ["rollback queued", run("queued", { state: "rolling_back", operation: "rollback" }), false],
    ["rollback running", run("running", { state: "rolling_back", operation: "rollback" }), false],
    ["rolled back", run("rolled_back", { state: "rolled_back", operation: "rollback" }), false],
    ["rolled back, needs a check", run("rolled_back", { state: "rolled_back", operation: "rollback", task: task({ operation: "rollback", status: "failed", needsOperatorCheck: true }) }), false],
  ])("%s", (_, value, offered) => {
    expect(canRollBack(value)).toBe(offered);
  });
});

describe("the run page's words", () => {
  it("links to the organization only for a customer who is placed there", () => {
    expect(showsOrganizationLink(run("succeeded"))).toBe(true);
    expect(showsOrganizationLink(run("succeeded", { targetOrganizationId: null }))).toBe(false);
    for (const status of ["queued", "running", "failed", "rolled_back"] as const) expect(showsOrganizationLink(run(status))).toBe(false);
  });

  it("has a headline for every status, of a placement and of a rollback", () => {
    for (const status of ["queued", "running", "succeeded", "failed", "rolled_back"] as const) {
      for (const operation of ["placement", "rollback"] as const) {
        const headline = runHeadline(run(status, { operation }));
        expect(headline.title.length).toBeGreaterThan(3);
        expect(headline.detail.length).toBeGreaterThan(10);
      }
    }
    expect(runHeadline(run("running", { state: "done" })).title).toMatch(/checking the move/);
    expect(runHeadline(run("queued", { operation: "rollback" })).title).toBe("Rollback waiting to start");
    expect(runHeadline(run("succeeded")).tone).toBe("good");
    expect(runHeadline(run("failed", { rollbackRequired: true }))).toMatchObject({ tone: "danger", title: "Failed: this run must be rolled back" });
    expect(runHeadline(run("failed"))).toMatchObject({ tone: "neutral", title: "Failed: nothing was moved" });
    expect(runHeadline(run("succeeded", { task: task({ operation: "rollback", status: "failed" }) })).title).toMatch(/rollback did not happen/);
  });

  it("gives the runbook's instruction when the run must be rolled back", () => {
    const lines = runInstructions(run("failed", { rollbackRequired: true }));
    expect(lines[0]).toMatch(/^Roll this run back before doing anything else with this customer\./);
    expect(lines.join(" ")).toMatch(/verifyCustomerOrganizations/);
    expect(runInstructions(run("succeeded"))).toEqual([]);
    expect(runInstructions(run("failed"))).toEqual([]);
  });

  it("gives the runbook's instruction for the other flagged runs", () => {
    expect(runInstructions(run("rolled_back", { task: task({ needsOperatorCheck: true }) })).join(" ")).toMatch(/Do not place or roll back this customer again yet/);
    expect(runInstructions(run("succeeded", { task: task({ status: "failed", auditUnconfirmed: true }) })).join(" ")).toMatch(/audit event/);
    expect(runInstructions(run("succeeded", { task: task({ operation: "rollback", status: "failed" }) })).join(" ")).toMatch(/ask for the rollback again/);
    expect(runInstructions(run("failed", { task: task({ status: "failed", code: "PLACEMENT_REQUEST_INVALID" }) })).join(" ")).toMatch(/security incident/);
  });

  it("words a task failure from its code, never from backend text", () => {
    expect(taskFailureText(null)).toBeNull();
    for (const code of ["PLACEMENT_TASK_NOT_STARTED", "ROLLBACK_TASK_NOT_STARTED", "PLACEMENT_TASK_START_FAILED", "ROLLBACK_TASK_START_FAILED", "PLACEMENT_TASK_LOST", "ROLLBACK_TASK_LOST", "PLACEMENT_TASK_ERROR", "ROLLBACK_TASK_ERROR", "PLACEMENT_FAILED", "PLACEMENT_VERIFICATION_FAILED", "PLACEMENT_REQUEST_INVALID", "NOT_A_LEGACY_CUSTOMER", "ORGANIZATION_NOT_FOUND", "ALREADY_A_MEMBER", "UNKNOWN_TEAM", "ORGANIZATION_IN_USE", "USER_IS_OWNER", "ROLLBACK_CONFLICT"]) {
      expect(taskFailureText(code)).not.toMatch(/no description/);
    }
    expect(taskFailureText("SOMETHING_NEW")).toMatch(/no description/);
  });

  it("says what the checks found", () => {
    expect(verificationLines(run("running"))).toEqual({ passed: null, lines: ["The checks run after the move. No result yet."] });
    expect(verificationLines(run("failed")).lines).toEqual(["This run has no check result."]);
    expect(verificationLines(run("succeeded", { verification: { passed: true, leftInHolding: 0, orphanedProposalsInTarget: 0, lostProposals: 0 } })).passed).toBe(true);
    const failed = verificationLines(run("rolled_back", { verification: { passed: false, leftInHolding: 1, orphanedProposalsInTarget: 2, lostProposals: 1 }, task: task({ rolledBack: true }) }));
    expect(failed.lines).toEqual([
      "1 record was left behind in the customer's holding area.",
      "1 proposal the customer owned is no longer theirs in the organization.",
      "2 proposals in the organization have no owner.",
      "The task rolled the placement back itself.",
    ]);
  });

  it("states what rollback does, by what the placement did", () => {
    expect(rollbackEffects(run("succeeded", { createdOrganization: true })).join(" ")).toMatch(/Deletes the organization this placement created/);
    const existing = rollbackEffects(run("succeeded")).join(" ");
    expect(existing).toMatch(/can't sign in again until they are placed/);
    expect(existing).toMatch(/Proposals given to them after the placement stay/);
    expect(existing).not.toMatch(/Deletes the organization/);
  });
});

describe("the review step", () => {
  const customer: LegacyCustomer = { userId: "6a0000000000000000000001", name: "Ada Lovelace", email: "ada@example.com", company: null, proposalCount: 3 };

  it("says who, how many proposals, into which organization and with which role", () => {
    const lines = reviewLines(customer, { target: "existing", organizationId: ORG, role: "team_manager", teamId: TEAM }, { organizationName: "Acme Events", teamName: "East" });
    expect(lines[0]).toBe('Ada Lovelace (ada@example.com) will be placed into the existing organization "Acme Events".');
    expect(lines[1]).toBe('They join as Team manager, in the team "East".');
    expect(lines[2]).toBe("3 proposals move with them, along with the rest of their records.");
  });

  it("says Owner of a new organization, and counts one proposal as one", () => {
    const lines = reviewLines({ ...customer, proposalCount: 1 }, { target: "new", organization: { name: "Acme Events", type: "agency", country: "US", eventsPerYear: 1 } });
    expect(lines[0]).toBe('Ada Lovelace (ada@example.com) will be placed into a new organization named "Acme Events" (type Agency, country US, 1 event a year).');
    expect(lines[1]).toBe("They become its Owner.");
    expect(lines[2]).toBe("1 proposal moves with them, along with the rest of their records.");
    expect(lines.join(" ")).toMatch(/free trial plan/);
  });

  it("says so when there is no team and nothing to move", () => {
    const lines = reviewLines({ ...customer, proposalCount: 0 }, { target: "existing", organizationId: ORG, role: "planner" }, { organizationName: "Acme" });
    expect(lines[1]).toBe("They join as Planner, in no team.");
    expect(lines[2]).toBe("They have no proposals, so only their account moves.");
  });
});

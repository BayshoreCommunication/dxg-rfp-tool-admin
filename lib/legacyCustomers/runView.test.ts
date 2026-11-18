import type { LegacyCustomer, PlacementFailure, PlacementRun, RunStatus, RunTask } from "@/lib/legacyCustomers/placement";
import { canRollBack, reviewIdentities, reviewLines, rollbackEffects, rollbackFollowUp, runHeadline, runInstructions, showsOrganizationLink, taskFailureText, verificationLines } from "@/lib/legacyCustomers/runView";

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

  it("says a placement failed before anything moved only under the headline that says nothing moved", () => {
    const nothingMoved = run("failed", { state: "aborted", task: task({ status: "failed", code: "PLACEMENT_FAILED" }) });
    expect(runHeadline(nothingMoved).title).toBe("Failed: nothing was moved");
    expect(taskFailureText("PLACEMENT_FAILED", nothingMoved.rollbackRequired)).toBe("The placement failed before anything was moved.");
    expect(taskFailureText("PLACEMENT_FAILED")).toBe("The placement failed before anything was moved.");
    // PLACEMENT_FAILED on a run that must be rolled back: records did move.
    expect(taskFailureText("PLACEMENT_FAILED", true)).toBe("The placement failed.");
    for (const required of [true, false]) expect(taskFailureText("PLACEMENT_FAILED", required)).not.toMatch(/part way/);
    // No other code's sentence depends on it.
    for (const code of ["PLACEMENT_TASK_LOST", "PLACEMENT_VERIFICATION_FAILED", "ROLLBACK_FAILED", "SOMETHING_NEW"]) expect(taskFailureText(code, true)).toBe(taskFailureText(code, false));
  });

  it("gives no duration for any run: the backend documents none", () => {
    for (const status of ["queued", "running", "succeeded", "failed", "rolled_back"] as const) {
      for (const operation of ["placement", "rollback"] as const) {
        for (const state of ["queued", "started", "done", "rolling_back", "failed", "rolled_back", "aborted", null] as const) {
          for (const rollbackRequired of [false, true]) {
            const headline = runHeadline(run(status, { operation, state, rollbackRequired }));
            expect(`${headline.title} ${headline.detail}`).not.toMatch(/\b(second|minute|hour)s?\b|normally|usually|takes about|a large customer/i);
          }
        }
      }
    }
    expect(runHeadline(run("queued")).detail).toBe("The request is recorded and its task is starting. Nothing has moved yet.");
    expect(runHeadline(run("queued", { operation: "rollback" })).detail).toBe("The rollback is recorded and its task is starting. Until it runs, the customer's records are still in the organization.");
    expect(runHeadline(run("running", { state: "started" })).detail).toBe("The customer's records are being moved.");
    expect(runHeadline(run("running", { operation: "rollback" })).detail).toBe("The customer's records are being moved back.");
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

describe("what the run page does with a rollback answer", () => {
  const RUN_ID = run("succeeded").runId;
  const OTHER = "placement-2026-11-18T11:00:00.000Z-9f8e7d6c";

  it("follows the run an accepted answer returns", () => {
    const queued = run("queued", { operation: "rollback", state: "rolling_back" });
    expect(rollbackFollowUp(RUN_ID, { ok: true, data: { runId: RUN_ID, replayed: false, run: queued } })).toEqual({ action: "follow", run: queued });
    expect(rollbackFollowUp(RUN_ID, { ok: true, data: { runId: RUN_ID, replayed: true, run: queued } })).toEqual({ action: "follow", run: queued });
  });

  it("opens the other run when the answer names one", () => {
    expect(rollbackFollowUp(RUN_ID, { ok: true, data: { runId: OTHER, replayed: false, run: null } })).toEqual({ action: "open", runId: OTHER });
  });

  it("reads the run again when an accepted answer carries no run it can show: it makes no status up", () => {
    expect(rollbackFollowUp(RUN_ID, { ok: true, data: { runId: RUN_ID, replayed: false, run: null } })).toEqual({ action: "recheck" });
    expect(rollbackFollowUp(RUN_ID, { ok: true, data: { runId: RUN_ID, replayed: false, run: { ...run("queued"), runId: OTHER } } })).toEqual({ action: "recheck" });
  });

  const REFUSALS: PlacementFailure[] = [
    // The run is not what the page showed.
    "rollback_in_progress", "already_rolled_back", "run_still_running", "run_not_found", "nothing_to_roll_back",
    // No answer, or one this screen cannot read: the backend may have queued the rollback.
    "unavailable", "not_available", "start_failed",
    // Refused for another reason. The page still does not know the run is as shown.
    "organization_in_use", "user_is_owner", "rollback_conflict", "capacity_reached", "rate_limited", "session_ended", "forbidden",
    "staff_organization_required", "not_configured", "misconfigured", "idempotency_conflict", "invalid_request", "invalid_id",
  ];
  it.each(REFUSALS)("reads the run again after %s", (failure) => {
    expect(rollbackFollowUp(RUN_ID, { ok: false, failure })).toEqual({ action: "recheck" });
    expect(rollbackFollowUp(RUN_ID, { ok: false, failure, retryAfterSeconds: 30, runId: RUN_ID })).toEqual({ action: "recheck" });
  });
});

describe("the review names exactly what the request names", () => {
  const OTHER_ORG = "6b00000000000000000000aa";
  const existing = (organizationId: string, teamId?: string) => ({ target: "existing" as const, organizationId, role: "planner" as const, ...(teamId ? { teamId } : {}) });
  const text = (identities: ReturnType<typeof reviewIdentities>) => identities.map((item) => [item.label, item.name, ...item.details.map((detail) => `${detail.label}: ${detail.value}`)].join(" | "));

  it("shows the organization's name, slug and the id that is sent", () => {
    expect(reviewIdentities(existing(ORG), { organizationName: "Acme Events", organizationSlug: "acme-events" })).toEqual([
      { label: "Organization", name: "Acme Events", details: [{ label: "Slug", value: "acme-events" }, { label: "Organization id", value: ORG }] },
    ]);
  });

  it("reads differently for two organizations with the same name", () => {
    const first = text(reviewIdentities(existing(ORG), { organizationName: "Acme Events", organizationSlug: "acme-events" }));
    const second = text(reviewIdentities(existing(OTHER_ORG), { organizationName: "Acme Events", organizationSlug: "acme-events-2" }));
    expect(first).not.toEqual(second);
    // Even with no slug on file, the id tells them apart.
    expect(text(reviewIdentities(existing(ORG), { organizationName: "Acme Events" }))).not.toEqual(text(reviewIdentities(existing(OTHER_ORG), { organizationName: "Acme Events" })));
  });

  it("shows the team's name and id when a team is sent, and no team row when none is", () => {
    expect(reviewIdentities(existing(ORG, TEAM), { organizationName: "Acme", organizationSlug: "acme", teamName: "East" })[1]).toEqual({ label: "Team", name: "East", details: [{ label: "Team id", value: TEAM }] });
    expect(reviewIdentities(existing(ORG), { organizationName: "Acme", organizationSlug: "acme", teamName: "East" })).toHaveLength(1);
  });

  it("always shows the id, and says so when a name or slug was not kept", () => {
    expect(text(reviewIdentities(existing(ORG, TEAM)))).toEqual([`Organization | Name not on file | Slug: No slug on file | Organization id: ${ORG}`, `Team | Name not on file | Team id: ${TEAM}`]);
  });

  it("has nothing to add for a new organization, which has no id yet", () => {
    expect(reviewIdentities({ target: "new", organization: { name: "Acme Events" } })).toEqual([]);
  });
});

// Every run the backend's placementRunView can return, by status, operation, journal state and
// task code, and the sentence the page says for it. The page must never say more than the
// backend's API document does (docs/API.md, "Legacy customer placement").
describe("the run headline says only what the backend has said", () => {
  const AGAIN = "This run moved nothing. The request can be made again; check the Legacy customers list first.";
  const failedTask = (code: string | null) => task({ status: "failed", code });
  const detailOf = (value: PlacementRun) => runHeadline(value).detail;

  it.each([
    // status, operation, state, title, what the detail must say, what it must not say
    ["queued", "placement", "queued", "Placement waiting to start", /Nothing has moved yet\./, /still in the organization/],
    ["queued", "rollback", "rolling_back", "Rollback waiting to start", /records are still in the organization/, /Nothing has moved/],
    ["running", "placement", "started", "Placement running", /records are being moved\./, /moved back|checks/],
    ["running", "placement", "queued", "Placement running", /records are being moved\./, /moved back/],
    ["running", "placement", "done", "Placement running: checking the move", /The records have moved\./, /being moved\./],
    ["running", "placement", "rolling_back", "Placement running: undoing the move", /checks after the move did not pass.*moving the customer's records back itself/, /records are being moved\.|Nothing has moved/],
    ["running", "placement", "failed", "Placement running: the move did not complete", /Part of the move did not complete/, /records are being moved\.|Nothing/],
    ["running", "rollback", "rolling_back", "Rollback running", /being moved back/, /Nothing has moved/],
  ] as const)("%s %s in state %s: %s", (status, operation, state, title, says, never) => {
    const headline = runHeadline(run(status, { operation, state }));
    expect(headline.title).toBe(title);
    expect(headline.detail).toMatch(says);
    expect(headline.detail).not.toMatch(never);
  });

  it("does not say records are being moved, or that nothing has moved, for any state it has other words for", () => {
    for (const state of ["rolling_back", "failed", "done"] as const) expect(detailOf(run("running", { state }))).not.toMatch(/records are being moved\./);
    for (const state of ["rolling_back", "rolled_back", "done", "failed"] as const) expect(detailOf(run("queued", { operation: "rollback", state }))).not.toMatch(/Nothing has moved/);
  });

  it.each([
    // The four the API document says can be made again.
    ["PLACEMENT_TASK_START_FAILED", true, /The request can be made again; check the Legacy customers list first\.$/],
    ["PLACEMENT_TASK_NOT_STARTED", true, /The request can be made again; check the Legacy customers list first\.$/],
    ["PLACEMENT_TASK_LOST", true, /The request can be made again; check the Legacy customers list first\.$/],
    ["PLACEMENT_FAILED", true, /The request can be made again; check the Legacy customers list first\.$/],
    // The customer may not be waiting any more.
    ["NOT_A_LEGACY_CUSTOMER", false, /no longer waiting to be placed.*another run may have placed them/],
    ["USER_NOT_FOUND", false, /account was not found/],
    // The target no longer takes them: placing again as before would fail again.
    ["ALREADY_A_MEMBER", false, /already has a membership.*Choose a different organization/],
    ["ORGANIZATION_NOT_FOUND", false, /organization that was chosen was no longer available/],
    ["UNKNOWN_TEAM", false, /team that was chosen was no longer an active team/],
    // The task refused the request itself.
    ["PLACEMENT_REQUEST_INVALID", false, /did not accept the request\. Do not make the same request again/],
    // Not documented as retryable: the page does not know.
    ["PLACEMENT_TASK_ERROR", false, /Check the Legacy customers list to see whether the customer is still waiting/],
    ["BRAND_NEW_CODE", false, /Check the Legacy customers list to see whether the customer is still waiting/],
    [null, false, /Check the Legacy customers list to see whether the customer is still waiting/],
  ] as const)("failed with nothing moved, task code %s: placeable again %p", (code, again, says) => {
    const headline = runHeadline(run("failed", { state: "aborted", task: failedTask(code) }));
    expect(headline).toMatchObject({ title: "Failed: nothing was moved", tone: "neutral" });
    expect(headline.detail === AGAIN).toBe(again);
    expect(headline.detail).toMatch(says);
    expect(headline.detail).toMatch(/^This run moved nothing\./);
    // The backend says nothing moved, not that the customer is still waiting: the page may be days old.
    expect(headline.detail).not.toMatch(/can be placed again|still waiting in the Legacy customers list and|is still waiting in/);
    if (!again) expect(headline.detail).not.toMatch(/can be made again/);
  });

  it("says the same for a failed run with no task at all (a server that places inside the request)", () => {
    expect(detailOf(run("failed", { state: "aborted", task: null }))).toMatch(/^This run moved nothing\. Check the Legacy customers list/);
  });

  it.each(["PLACEMENT_FAILED", "PLACEMENT_TASK_LOST", "PLACEMENT_TASK_ERROR", "PLACEMENT_VERIFICATION_FAILED", "ROLLBACK_TASK_LOST", null] as const)(
    "never says nothing moved, or place again, for a failed run that must be rolled back (task code %s)",
    (code) => {
      const headline = runHeadline(run("failed", { state: "failed", rollbackRequired: true, task: failedTask(code) }));
      expect(headline).toMatchObject({ title: "Failed: this run must be rolled back", tone: "danger" });
      expect(headline.detail).not.toMatch(/nothing|placed again|made again|still waiting/i);
    },
  );

  it("words every status, operation and state without a dead end", () => {
    for (const status of ["queued", "running", "succeeded", "failed", "rolled_back"] as const) {
      for (const operation of ["placement", "rollback"] as const) {
        for (const state of ["queued", "started", "done", "failed", "aborted", "rolling_back", "rolled_back", null] as const) {
          const headline = runHeadline(run(status, { operation, state }));
          expect(headline.title.length).toBeGreaterThan(3);
          expect(headline.detail.length).toBeGreaterThan(10);
          expect(`${headline.title} ${headline.detail}`).not.toMatch(/\bRFP\b|undefined|null/);
        }
      }
    }
  });
});

import type { PlacementResult, PlacementRun, RunStatus } from "@/lib/legacyCustomers/placement";
import {
  createPollController,
  MAX_ACTIVE_POLL_MS,
  MAX_BACKOFF_MS,
  MAX_CONSECUTIVE_ERRORS,
  MAX_CONSECUTIVE_RATE_LIMITS,
  MIN_POLL_INTERVAL_MS,
  type PollState,
} from "@/lib/legacyCustomers/pollController";

const RUN_ID = "placement-2026-11-18T10:00:00.000Z-0a1b2c3d";
const run = (status: RunStatus, extra: Partial<PlacementRun> = {}): PlacementRun => ({
  runId: RUN_ID,
  userId: null,
  targetOrganizationId: null,
  createdOrganization: false,
  role: null,
  teamId: null,
  state: null,
  status,
  operation: "placement",
  rollbackRequired: false,
  verification: null,
  proposalsLeftInTarget: null,
  createdAt: null,
  updatedAt: null,
  task: null,
  ...extra,
});
const ok = (status: RunStatus): PlacementResult<PlacementRun> => ({ ok: true, data: run(status) });

type Deferred = { resolve: (result: PlacementResult<PlacementRun>) => void; reject: (error: unknown) => void };

/** A controller whose reads are answered by the test, with the time each one began. */
const harness = (initial: PlacementRun | null, options: { intervalMs?: number; answers?: Array<PlacementResult<PlacementRun>> } = {}) => {
  const startedAt: number[] = [];
  const pending: Deferred[] = [];
  const states: PollState[] = [];
  let visible = true;
  let inFlight = 0;
  let maxInFlight = 0;
  const answers = options.answers ? [...options.answers] : null;
  const controller = createPollController(initial, {
    read: () => {
      startedAt.push(Date.now());
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (answers) {
        inFlight -= 1;
        return Promise.resolve(answers.length > 1 ? answers.shift()! : answers[0]);
      }
      return new Promise<PlacementResult<PlacementRun>>((resolve, reject) => {
        pending.push({
          resolve: (result) => {
            inFlight -= 1;
            resolve(result);
          },
          reject: (error) => {
            inFlight -= 1;
            reject(error);
          },
        });
      });
    },
    onChange: (state) => states.push(state),
    isVisible: () => visible,
    intervalMs: options.intervalMs,
  });
  return {
    controller,
    startedAt,
    pending,
    states,
    maxInFlight: () => maxInFlight,
    setVisible: (value: boolean) => {
      visible = value;
      controller.setVisible(value);
    },
    gaps: () => startedAt.slice(1).map((at, index) => at - startedAt[index]),
  };
};

const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-18T10:00:00.000Z"));
});
afterEach(() => {
  expect(jest.getTimerCount()).toBeLessThanOrEqual(1);
  jest.useRealTimers();
});

describe("the run poll controller", () => {
  it("has a floor of 3 seconds", () => {
    expect(MIN_POLL_INTERVAL_MS).toBe(3000);
  });

  it("reads every 3 seconds while the run is queued or running, never sooner", async () => {
    const h = harness(run("queued"), { answers: [ok("queued"), ok("running"), ok("running"), ok("running")] });
    h.controller.start();
    expect(h.controller.getState().phase).toBe("checking");
    await advance(2999);
    expect(h.startedAt).toHaveLength(0);
    await advance(1);
    expect(h.startedAt).toHaveLength(1);
    await advance(30_000);
    expect(h.startedAt.length).toBe(11);
    for (const gap of h.gaps()) expect(gap).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
    expect(h.controller.getState().run?.status).toBe("running");
    h.controller.dispose();
  });

  it.each([0, 1, 500, 2999, -5, Number.NaN])("raises an interval of %p ms to the floor", async (intervalMs) => {
    const h = harness(run("running"), { intervalMs, answers: [ok("running")] });
    h.controller.start();
    await advance(20_000);
    expect(h.startedAt.length).toBeGreaterThan(2);
    for (const gap of h.gaps()) expect(gap).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
    h.controller.dispose();
  });

  it("keeps a slower interval when one is asked for", async () => {
    const h = harness(run("running"), { intervalMs: 10_000, answers: [ok("running")] });
    h.controller.start();
    await advance(35_000);
    expect(h.startedAt).toHaveLength(3);
    h.controller.dispose();
  });

  it("never has two reads in flight: a slow read holds the next one back", async () => {
    const h = harness(run("running"));
    h.controller.start();
    await advance(3000);
    expect(h.pending).toHaveLength(1);
    expect(h.controller.getState().reading).toBe(true);
    // The read takes 20 seconds. Nothing else is sent meanwhile, by the timer or by hand.
    await advance(20_000);
    h.controller.refresh();
    h.controller.refresh();
    h.setVisible(false);
    h.setVisible(true);
    await advance(1000);
    expect(h.pending).toHaveLength(1);
    h.pending[0].resolve(ok("running"));
    await advance(0);
    expect(h.pending).toHaveLength(1);
    await advance(2999);
    expect(h.pending).toHaveLength(1);
    await advance(1);
    expect(h.pending).toHaveLength(2);
    expect(h.maxInFlight()).toBe(1);
    h.controller.dispose();
  });

  it.each(["succeeded", "failed", "rolled_back"] as const)("stops for good when the run is %s", async (status) => {
    const h = harness(run("running"), { answers: [ok("running"), ok(status)] });
    h.controller.start();
    await advance(6000);
    expect(h.startedAt).toHaveLength(2);
    expect(h.controller.getState()).toMatchObject({ phase: "finished", reading: false, stopReason: null, run: { status } });
    expect(jest.getTimerCount()).toBe(0);
    await advance(120_000);
    expect(h.startedAt).toHaveLength(2);
    // Showing the tab again does not start it either.
    h.setVisible(false);
    h.setVisible(true);
    await advance(60_000);
    expect(h.startedAt).toHaveLength(2);
  });

  it.each(["succeeded", "failed", "rolled_back"] as const)("never reads a run that was already %s when the page opened", async (status) => {
    const h = harness(run(status));
    h.controller.start();
    expect(h.controller.getState().phase).toBe("finished");
    await advance(60_000);
    expect(h.startedAt).toHaveLength(0);
  });

  it("waits while the tab is hidden and carries on when it is shown, still 3 seconds apart", async () => {
    const h = harness(run("running"), { answers: [ok("running")] });
    h.controller.start();
    await advance(3000);
    expect(h.startedAt).toHaveLength(1);
    h.setVisible(false);
    expect(h.controller.getState().phase).toBe("paused");
    expect(jest.getTimerCount()).toBe(0);
    await advance(10 * 60_000);
    expect(h.startedAt).toHaveLength(1);
    // Shown again long after the last read: one read straight away, then the usual interval.
    h.setVisible(true);
    expect(h.controller.getState().phase).toBe("checking");
    await advance(0);
    expect(h.startedAt).toHaveLength(2);
    await advance(3000);
    expect(h.startedAt).toHaveLength(3);
    // Hidden and shown in quick succession: the floor still holds.
    for (let i = 0; i < 20; i++) {
      h.setVisible(false);
      h.setVisible(true);
      await advance(100);
    }
    for (const gap of h.gaps()) expect(gap).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
    h.controller.dispose();
  });

  it("does not start reading in a tab that is hidden when the page opens", async () => {
    const h = harness(run("queued"), { answers: [ok("queued")] });
    h.setVisible(false);
    h.controller.start();
    expect(h.controller.getState().phase).toBe("paused");
    await advance(60_000);
    expect(h.startedAt).toHaveLength(0);
    h.setVisible(true);
    await advance(3000);
    expect(h.startedAt.length).toBeGreaterThanOrEqual(1);
    h.controller.dispose();
  });

  it("stops on a 404 and says so", async () => {
    const h = harness(run("running"), { answers: [{ ok: false, failure: "run_not_found" }] });
    h.controller.start();
    await advance(3000);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "not_found" });
    await advance(120_000);
    expect(h.startedAt).toHaveLength(1);
  });

  it.each(["session_ended", "forbidden", "staff_organization_required", "invalid_id", "not_available"] as const)(
    "stops at once on %s, which asking again cannot change",
    async (failure) => {
      const h = harness(run("running"), { answers: [{ ok: false, failure }] });
      h.controller.start();
      await advance(120_000);
      expect(h.startedAt).toHaveLength(1);
      expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: failure });
    },
  );

  it("backs off on a 429, waits at least what Retry-After says, and recovers", async () => {
    const limited: PlacementResult<PlacementRun> = { ok: false, failure: "rate_limited" };
    const h = harness(run("running"), { answers: [limited, limited, { ...limited, retryAfterSeconds: 120 }, ok("running"), ok("running")] });
    h.controller.start();
    await advance(3000);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", lastFailure: "rate_limited" });
    await advance(10 * 60_000);
    expect(h.gaps().slice(0, 4)).toEqual([6000, 12_000, 120_000, 3000]);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", lastFailure: null });
    h.controller.dispose();
  });

  it("never waits less than the backoff however small Retry-After is, and caps the backoff", async () => {
    const h = harness(run("running"), { answers: [{ ok: false, failure: "rate_limited", retryAfterSeconds: 1 }] });
    h.controller.start();
    await advance(30 * 60_000);
    expect(h.gaps()).toEqual([6000, 12_000, 24_000, 48_000]);
    expect(Math.max(...h.gaps())).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    // Five in a row and it stops.
    expect(h.startedAt).toHaveLength(MAX_CONSECUTIVE_RATE_LIMITS);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "rate_limited" });
  });

  it("stops after three errors in a row, slower each time, with a visible state", async () => {
    const h = harness(run("running"), { answers: [{ ok: false, failure: "unavailable" }] });
    h.controller.start();
    await advance(30 * 60_000);
    expect(h.startedAt).toHaveLength(MAX_CONSECUTIVE_ERRORS);
    expect(h.gaps()).toEqual([6000, 12_000]);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "errors", reading: false });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("counts a read that throws as an error, and an answer in between starts the count again", async () => {
    const h = harness(run("running"));
    h.controller.start();
    await advance(3000);
    h.pending[0].reject(new Error("network"));
    await advance(6000);
    h.pending[1].resolve({ ok: false, failure: "unavailable" });
    await advance(12_000);
    h.pending[2].resolve(ok("running"));
    await advance(3000);
    h.pending[3].reject(new Error("network"));
    await advance(6000);
    expect(h.pending).toHaveLength(5);
    expect(h.controller.getState().phase).toBe("checking");
    h.controller.dispose();
  });

  it("starts again from the manual refresh after it stopped, and not faster than the floor", async () => {
    const h = harness(run("running"), { answers: [{ ok: false, failure: "unavailable" }, { ok: false, failure: "unavailable" }, { ok: false, failure: "unavailable" }, ok("running"), ok("succeeded")] });
    h.controller.start();
    await advance(60_000);
    expect(h.controller.getState().phase).toBe("stopped");
    h.controller.refresh();
    expect(h.controller.getState()).toMatchObject({ phase: "checking", stopReason: null });
    await advance(0);
    expect(h.startedAt).toHaveLength(4);
    // Pressed again and again right after: the next read still waits for the floor.
    h.controller.refresh();
    h.controller.refresh();
    await advance(2999);
    expect(h.startedAt).toHaveLength(4);
    await advance(1);
    expect(h.startedAt).toHaveLength(5);
    expect(h.controller.getState().phase).toBe("finished");
    for (const gap of h.gaps()) expect(gap).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
  });

  it("a manual refresh can read a finished run again, once", async () => {
    const h = harness(run("succeeded"), { answers: [ok("succeeded")] });
    h.controller.start();
    h.controller.refresh();
    await advance(60_000);
    expect(h.startedAt).toHaveLength(1);
    expect(h.controller.getState().phase).toBe("finished");
  });

  it("follows a run it is handed (a rollback was asked for), waiting a full interval first", async () => {
    const h = harness(run("succeeded"), { answers: [ok("running"), ok("rolled_back")] });
    h.controller.start();
    h.controller.adopt(run("queued", { operation: "rollback" }));
    expect(h.controller.getState()).toMatchObject({ phase: "checking", run: { status: "queued", operation: "rollback" } });
    await advance(2999);
    expect(h.startedAt).toHaveLength(0);
    await advance(3001);
    expect(h.startedAt).toHaveLength(2);
    expect(h.controller.getState()).toMatchObject({ phase: "finished", run: { status: "rolled_back" } });
  });

  it("drops the answer of a read that was in flight when a run was adopted or the page closed", async () => {
    const h = harness(run("running"));
    h.controller.start();
    await advance(3000);
    h.controller.adopt(run("queued", { operation: "rollback" }));
    h.pending[0].resolve(ok("succeeded"));
    await advance(0);
    expect(h.controller.getState().run).toMatchObject({ status: "queued", operation: "rollback" });
    await advance(3000);
    expect(h.pending).toHaveLength(2);
    h.controller.dispose();
    const before = h.states.length;
    h.pending[1].resolve(ok("rolled_back"));
    await advance(60_000);
    expect(h.states).toHaveLength(before);
    expect(h.pending).toHaveLength(2);
    expect(jest.getTimerCount()).toBe(0);
    expect(h.maxInFlight()).toBe(1);
  });

  it("does not read while an earlier read is still unanswered, even after its run was replaced", async () => {
    const h = harness(run("running"));
    h.controller.start();
    await advance(3000);
    h.controller.adopt(run("queued", { operation: "rollback" }));
    await advance(30_000);
    expect(h.pending).toHaveLength(1);
    h.pending[0].resolve(ok("running"));
    await advance(3000);
    expect(h.pending).toHaveLength(2);
    expect(h.maxInFlight()).toBe(1);
    h.controller.dispose();
  });

  it("with no run to begin with (the first read failed), reads once straight away", async () => {
    const h = harness(null, { answers: [ok("running")] });
    h.controller.start();
    await advance(0);
    expect(h.startedAt).toHaveLength(1);
    await advance(3000);
    expect(h.startedAt).toHaveLength(2);
    h.controller.dispose();
  });
});

// A rollback that was refused, or whose answer was lost, leaves a finished run on the page that
// may no longer be true: recheck reads it once more.
describe("recheck: one more read of a run the loop had finished with", () => {
  const rollback = (status: RunStatus): PlacementResult<PlacementRun> => ({ ok: true, data: run(status, { operation: "rollback" }) });

  it.each(["succeeded", "failed"] as const)("reads a %s run again, once, and ends again when nothing has changed", async (status) => {
    const h = harness(run(status), { answers: [ok(status)] });
    h.controller.start();
    await advance(60_000);
    expect(h.startedAt).toHaveLength(0);
    expect(h.controller.getState().phase).toBe("finished");

    h.controller.recheck();
    expect(h.controller.getState().phase).toBe("checking");
    await advance(60_000);
    expect(h.startedAt).toHaveLength(1);
    expect(h.controller.getState()).toMatchObject({ phase: "finished", run: { status } });
  });

  it("never reads sooner than the floor after the last read", async () => {
    const h = harness(run("succeeded"), { answers: [ok("succeeded")] });
    h.controller.start();
    await advance(1000);
    h.controller.recheck();
    await advance(1999);
    expect(h.startedAt).toHaveLength(0);
    await advance(1);
    expect(h.startedAt).toHaveLength(1);
  });

  it("resumes the loop when the fresh run is a queued or running rollback, and follows it to its end", async () => {
    const h = harness(run("succeeded"), { answers: [rollback("queued"), rollback("running"), rollback("rolled_back")] });
    h.controller.start();
    await advance(10_000);
    h.controller.recheck();
    await advance(0);
    expect(h.startedAt).toHaveLength(1);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", run: { status: "queued", operation: "rollback" } });
    await advance(60_000);
    expect(h.startedAt).toHaveLength(3);
    for (const gap of h.gaps()) expect(gap).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
    expect(h.controller.getState()).toMatchObject({ phase: "finished", run: { status: "rolled_back" } });
  });

  it("shows a run a colleague already rolled back", async () => {
    const h = harness(run("succeeded"), { answers: [rollback("rolled_back")] });
    h.controller.start();
    await advance(10_000);
    h.controller.recheck();
    await advance(0);
    expect(h.startedAt).toHaveLength(1);
    expect(h.controller.getState()).toMatchObject({ phase: "finished", run: { status: "rolled_back" } });
  });

  it("stops and says so when the run is gone or cannot be read", async () => {
    const gone = harness(run("succeeded"), { answers: [{ ok: false, failure: "run_not_found" }] });
    gone.controller.start();
    await advance(10_000);
    gone.controller.recheck();
    await advance(0);
    expect(gone.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "not_found" });

    const silent = harness(run("succeeded"), { answers: [{ ok: false, failure: "unavailable" }] });
    silent.controller.start();
    await advance(10_000);
    silent.controller.recheck();
    await advance(10 * 60_000);
    expect(silent.startedAt).toHaveLength(MAX_CONSECUTIVE_ERRORS);
    expect(silent.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "errors" });
  });

  it("asks once more when a read was already in flight: that read began before the question", async () => {
    const h = harness(run("succeeded"));
    h.controller.start();
    await advance(10_000);
    h.controller.refresh();
    await advance(0);
    expect(h.pending).toHaveLength(1);
    h.controller.recheck();
    h.pending[0].resolve(ok("succeeded"));
    await advance(MIN_POLL_INTERVAL_MS - 1);
    expect(h.startedAt).toHaveLength(1);
    await advance(1);
    expect(h.startedAt).toHaveLength(2);
    h.pending[1].resolve(rollback("running"));
    await advance(0);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", run: { status: "running", operation: "rollback" } });
    expect(h.maxInFlight()).toBe(1);
    h.controller.dispose();
  });

  it("waits for the tab when it is hidden, and reads nothing after the page has closed", async () => {
    const h = harness(run("succeeded"), { answers: [rollback("rolled_back")] });
    h.controller.start();
    await advance(10_000);
    h.setVisible(false);
    h.controller.recheck();
    await advance(60_000);
    expect(h.startedAt).toHaveLength(0);
    expect(h.controller.getState().phase).toBe("paused");
    h.setVisible(true);
    await advance(0);
    expect(h.startedAt).toHaveLength(1);

    const closed = harness(run("succeeded"), { answers: [ok("succeeded")] });
    closed.controller.start();
    closed.controller.dispose();
    closed.controller.recheck();
    await advance(60_000);
    expect(closed.startedAt).toHaveLength(0);
  });
  it("leaves a 429 backoff in place: a recheck while a read is already scheduled does not read sooner", async () => {
    const limited: PlacementResult<PlacementRun> = { ok: false, failure: "rate_limited", retryAfterSeconds: 120 };
    const h = harness(run("running"), { answers: [limited, rollback("running")] });
    h.controller.start();
    await advance(3000);
    expect(h.startedAt).toHaveLength(1);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", lastFailure: "rate_limited" });
    // A rollback is refused 10 seconds into the two minutes the backend asked for.
    await advance(10_000);
    h.controller.recheck();
    await advance(110_000 - 1);
    expect(h.startedAt).toHaveLength(1);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", lastFailure: "rate_limited" });
    // The read that was already scheduled happens when the backoff ends, after the question.
    await advance(1);
    expect(h.startedAt).toHaveLength(2);
    expect(h.gaps()).toEqual([120_000]);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", run: { status: "running", operation: "rollback" }, lastFailure: null });
    h.controller.dispose();
  });

  it("keeps the count of 429s through a recheck: the next one waits longer, not from the start", async () => {
    const limited: PlacementResult<PlacementRun> = { ok: false, failure: "rate_limited" };
    const h = harness(run("running"), { answers: [limited] });
    h.controller.start();
    await advance(3000 + 6000);
    expect(h.startedAt).toHaveLength(2);
    h.controller.recheck();
    await advance(60 * 60_000);
    expect(h.gaps()).toEqual([6000, 12_000, 24_000, 48_000]);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "rate_limited" });
  });
  it("forgets a recheck asked for during a read that ended in a final refusal: the next refresh reads once", async () => {
    const h = harness(run("succeeded"));
    h.controller.start();
    await advance(10_000);
    h.controller.refresh();
    await advance(0);
    h.controller.recheck();
    h.pending[0].resolve({ ok: false, failure: "forbidden" });
    await advance(60_000);
    expect(h.startedAt).toHaveLength(1);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "forbidden" });

    h.controller.refresh();
    await advance(0);
    expect(h.startedAt).toHaveLength(2);
    h.pending[1].resolve(ok("succeeded"));
    await advance(0);
    expect(h.controller.getState()).toMatchObject({ phase: "finished", run: { status: "succeeded" } });
    // The run has finished: nothing is scheduled and nothing more is read.
    expect(jest.getTimerCount()).toBe(0);
    await advance(10 * 60_000);
    expect(h.startedAt).toHaveLength(2);
    expect(h.pending).toHaveLength(2);
  });

  it("forgets a recheck asked for during the read that was the third error in a row", async () => {
    const h = harness(run("succeeded"));
    h.controller.start();
    h.controller.recheck();
    const failed: PlacementResult<PlacementRun> = { ok: false, failure: "unavailable" };
    for (let read = 0; read < MAX_CONSECUTIVE_ERRORS; read += 1) {
      await advance(MAX_BACKOFF_MS);
      expect(h.pending).toHaveLength(read + 1);
      if (read === MAX_CONSECUTIVE_ERRORS - 1) h.controller.recheck();
      h.pending[read].resolve(failed);
      await advance(0);
    }
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "errors" });

    h.controller.refresh();
    await advance(MIN_POLL_INTERVAL_MS);
    expect(h.pending).toHaveLength(MAX_CONSECUTIVE_ERRORS + 1);
    h.pending[MAX_CONSECUTIVE_ERRORS].resolve(ok("succeeded"));
    await advance(0);
    expect(h.controller.getState()).toMatchObject({ phase: "finished" });
    expect(jest.getTimerCount()).toBe(0);
    await advance(10 * 60_000);
    expect(h.pending).toHaveLength(MAX_CONSECUTIVE_ERRORS + 1);
  });
});

// A tab left open on a run that never finishes must not read for ever.
describe("the overall cap on following a run", () => {
  it("is 30 minutes", () => {
    expect(MAX_ACTIVE_POLL_MS).toBe(30 * 60_000);
  });

  it.each(["queued", "running"] as const)("stops after 30 minutes of a run that stays %s, with the stopped state and no timer left", async (status) => {
    const h = harness(run(status), { answers: [ok(status)] });
    h.controller.start();
    await advance(MAX_ACTIVE_POLL_MS - 1);
    expect(h.controller.getState()).toMatchObject({ phase: "checking", stopReason: null });
    const before = h.startedAt.length;
    expect(before).toBe(599);
    await advance(1);
    expect(h.startedAt).toHaveLength(600);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "time_limit", reading: false, run: { status } });
    expect(jest.getTimerCount()).toBe(0);
    await advance(2 * 60 * 60_000);
    expect(h.startedAt).toHaveLength(600);
    for (const gap of h.gaps()) expect(gap).toBeGreaterThanOrEqual(MIN_POLL_INTERVAL_MS);
  });

  it("counts a run that goes from queued to running as one stretch", async () => {
    const h = harness(run("queued"), { answers: [...Array.from({ length: 300 }, () => ok("queued")), ok("running")] });
    h.controller.start();
    await advance(MAX_ACTIVE_POLL_MS + 60_000);
    expect(h.startedAt).toHaveLength(600);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "time_limit", run: { status: "running" } });
  });

  it("the manual refresh starts it again, for another 30 minutes", async () => {
    const h = harness(run("running"), { answers: [ok("running")] });
    h.controller.start();
    await advance(MAX_ACTIVE_POLL_MS);
    expect(h.controller.getState().stopReason).toBe("time_limit");
    h.controller.refresh();
    expect(h.controller.getState()).toMatchObject({ phase: "checking", stopReason: null });
    await advance(MAX_ACTIVE_POLL_MS - 1);
    expect(h.controller.getState().phase).toBe("checking");
    await advance(1);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "time_limit" });
    expect(h.startedAt).toHaveLength(1200);
  });

  it("does not stop a run that finishes in time, and a rollback adopted later gets its own 30 minutes", async () => {
    const h = harness(run("running"), { answers: [...Array.from({ length: 500 }, () => ok("running")), ok("succeeded")] });
    h.controller.start();
    await advance(MAX_ACTIVE_POLL_MS);
    expect(h.controller.getState()).toMatchObject({ phase: "finished", stopReason: null, run: { status: "succeeded" } });

    const adopted = harness(run("succeeded"), { answers: [{ ok: true, data: run("running", { operation: "rollback" }) }] });
    adopted.controller.start();
    await advance(45 * 60_000);
    adopted.controller.adopt(run("queued", { operation: "rollback" }));
    await advance(MAX_ACTIVE_POLL_MS - 1);
    expect(adopted.controller.getState().phase).toBe("checking");
    await advance(1);
    expect(adopted.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "time_limit" });
  });

  it("a tab that was hidden past the cap reads once when it is shown again, then stops", async () => {
    const h = harness(run("running"), { answers: [ok("running")] });
    h.controller.start();
    await advance(60_000);
    const before = h.startedAt.length;
    h.setVisible(false);
    await advance(MAX_ACTIVE_POLL_MS);
    expect(h.startedAt).toHaveLength(before);
    h.setVisible(true);
    await advance(0);
    expect(h.startedAt).toHaveLength(before + 1);
    expect(h.controller.getState()).toMatchObject({ phase: "stopped", stopReason: "time_limit" });
  });
});

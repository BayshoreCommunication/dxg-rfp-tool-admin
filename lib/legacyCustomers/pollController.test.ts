import type { PlacementResult, PlacementRun, RunStatus } from "@/lib/legacyCustomers/placement";
import {
  createPollController,
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

// The one loop that follows a placement run. It is plain code with its clock and timers handed
// in, so its rules are tested without a browser (pollController.test.ts):
//
// - never two reads less than 3 seconds apart, whatever asks for one (the timer, the tab
//   becoming visible again, the manual refresh);
// - one read at a time: the next is scheduled only when the last has answered;
// - it ends when the run reaches a status that is not queued or running, on a 404, on a refusal
//   that cannot change by asking again, and after repeated errors;
// - a rollback answer that leaves the run unknown (a refusal, a lost answer) is followed by one
//   more read, at the floor, even of a run that had finished (recheck); a read that is already
//   scheduled is that read, and keeps its wait (a 429's backoff is not cut short);
// - it ends after 30 minutes of a run that is still queued or running (a tab left open must not
//   read for ever); the manual refresh starts it again;
// - it waits while the tab is hidden;
// - a 429 makes it wait longer each time (at least what Retry-After says).
//
// The backend allows 1,500 run reads per staff member per 15 minutes; one tab at 3 seconds uses 300.

import { isActiveStatus, type PlacementFailure, type PlacementResult, type PlacementRun } from "@/lib/legacyCustomers/placement";

/** The fastest this screen reads a run. The API documents 3 seconds or slower. */
export const MIN_POLL_INTERVAL_MS = 3000;
export const MAX_BACKOFF_MS = 60_000;
/** Three reads in a row that fail, or five that are rate limited, and the loop stops. */
export const MAX_CONSECUTIVE_ERRORS = 3;
export const MAX_CONSECUTIVE_RATE_LIMITS = 5;
const MAX_RETRY_AFTER_MS = 15 * 60_000;
/** The longest the loop follows a run that stays queued or running before it stops and says so. */
export const MAX_ACTIVE_POLL_MS = 30 * 60_000;

export type PollPhase =
  /** A read is scheduled or in flight. */
  | "checking"
  /** The tab is hidden: nothing is scheduled until it is visible again. */
  | "paused"
  /** The run has finished: there is nothing more to read. */
  | "finished"
  /** The loop gave up. Only the manual refresh starts it again. */
  | "stopped";

export type PollStopReason = "not_found" | "errors" | "rate_limited" | "time_limit" | PlacementFailure;

export type PollState = {
  run: PlacementRun | null;
  phase: PollPhase;
  /** A read is in flight right now. */
  reading: boolean;
  stopReason: PollStopReason | null;
  /** The last read's refusal, while the loop is still trying. */
  lastFailure: PlacementFailure | null;
};

export type PollDependencies = {
  read: () => Promise<PlacementResult<PlacementRun>>;
  onChange: (state: PollState) => void;
  isVisible: () => boolean;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Asked-for interval; anything below the floor is raised to it. */
  intervalMs?: number;
};

// Refusals that asking again cannot change.
const FINAL: PlacementFailure[] = ["session_ended", "forbidden", "staff_organization_required", "invalid_id", "not_available"];

export const createPollController = (initial: PlacementRun | null, dependencies: PollDependencies) => {
  const now = dependencies.now ?? (() => Date.now());
  const setTimer = dependencies.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = dependencies.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const interval = Math.max(MIN_POLL_INTERVAL_MS, Number.isFinite(dependencies.intervalMs) ? Number(dependencies.intervalMs) : MIN_POLL_INTERVAL_MS);

  let state: PollState = { run: initial, phase: "stopped", reading: false, stopReason: null, lastFailure: null };
  let timer: unknown = null;
  // The run the page opened with was read a moment ago: it counts as the last read.
  let lastReadAt: number | null = initial ? now() : null;
  // True from the moment a read is sent until it answers, even one whose answer will be dropped.
  let busy = false;
  let errors = 0;
  let rateLimits = 0;
  let disposed = false;
  // Bumped whenever the loop is replaced (dispose, a new run adopted): a late answer is dropped.
  let generation = 0;
  // A recheck asked for while a read was in flight: that read began before the question, so its
  // answer does not settle it.
  let recheckPending = false;
  // When this stretch of following a queued or running run began: the loop's start, a run
  // adopted, or the last manual refresh.
  let followingSince = now();

  const emit = (change: Partial<PollState>) => {
    state = { ...state, ...change };
    if (!disposed) dependencies.onChange(state);
  };
  const cancelTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const finished = () => state.run !== null && !isActiveStatus(state.run.status);

  /** Schedules the one next read, never sooner than the floor after the last one began. */
  const schedule = (wait: number) => {
    cancelTimer();
    if (disposed || state.reading) return;
    if (!dependencies.isVisible()) {
      emit({ phase: "paused" });
      return;
    }
    const floor = lastReadAt === null ? 0 : Math.max(0, lastReadAt + interval - now());
    emit({ phase: "checking", stopReason: null });
    timer = setTimer(() => {
      timer = null;
      void readOnce();
    }, Math.max(wait, floor));
  };

  const stop = (reason: PollStopReason) => {
    cancelTimer();
    // The loop has given up: a recheck that was waiting for this read goes with it. Left set, it
    // would add a second read to the next manual refresh, even of a run that had finished.
    recheckPending = false;
    emit({ phase: "stopped", stopReason: reason, reading: false });
  };

  const readOnce = async () => {
    if (disposed || state.reading) return;
    if (!dependencies.isVisible()) {
      emit({ phase: "paused" });
      return;
    }
    // An earlier read has not answered yet (its run was replaced meanwhile): wait for it.
    if (busy) return schedule(interval);
    const mine = generation;
    lastReadAt = now();
    busy = true;
    emit({ phase: "checking", reading: true });
    let result: PlacementResult<PlacementRun>;
    try {
      result = await dependencies.read();
    } catch {
      result = { ok: false, failure: "unavailable" };
    } finally {
      busy = false;
    }
    if (disposed || mine !== generation) return;
    state = { ...state, reading: false };

    if (result.ok) {
      errors = 0;
      rateLimits = 0;
      state = { ...state, run: result.data, lastFailure: null };
      if (recheckPending) {
        recheckPending = false;
        schedule(interval);
      } else if (finished()) {
        cancelTimer();
        emit({ phase: "finished", stopReason: null });
      } else if (now() - followingSince >= MAX_ACTIVE_POLL_MS) stop("time_limit");
      else schedule(interval);
      return;
    }
    if (result.failure === "run_not_found") return stop("not_found");
    if (FINAL.includes(result.failure)) return stop(result.failure);
    if (result.failure === "rate_limited") {
      rateLimits += 1;
      if (rateLimits >= MAX_CONSECUTIVE_RATE_LIMITS) return stop("rate_limited");
      const asked = result.retryAfterSeconds ? Math.min(result.retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS) : 0;
      state = { ...state, lastFailure: "rate_limited" };
      schedule(Math.max(asked, Math.min(interval * 2 ** rateLimits, MAX_BACKOFF_MS)));
      return;
    }
    errors += 1;
    if (errors >= MAX_CONSECUTIVE_ERRORS) return stop("errors");
    state = { ...state, lastFailure: result.failure };
    schedule(Math.min(interval * 2 ** errors, MAX_BACKOFF_MS));
  };

  const begin = () => {
    errors = 0;
    rateLimits = 0;
    followingSince = now();
    if (finished()) {
      cancelTimer();
      emit({ phase: "finished", stopReason: null, lastFailure: null });
    } else schedule(state.run ? interval : 0);
  };

  return {
    getState: () => state,
    /** Starts the loop. A run that has already finished is never read again. */
    start: () => {
      if (!disposed) begin();
    },
    /** The tab was hidden or shown. */
    setVisible: (visible: boolean) => {
      if (disposed || state.phase === "finished" || state.phase === "stopped") return;
      if (!visible) {
        cancelTimer();
        emit({ phase: "paused" });
      } else if (state.phase === "paused") schedule(0);
    },
    /** The manual control: one read now (or at the floor), then the loop carries on. */
    refresh: () => {
      if (disposed || state.reading) return;
      errors = 0;
      rateLimits = 0;
      followingSince = now();
      state = { ...state, lastFailure: null };
      schedule(0);
    },
    /* The run may have changed without this page being told: a rollback was refused (a colleague
       may have rolled it back, or a rollback may be running), or its answer was lost after the
       backend queued it. Reads the run once more, at the floor, even when the loop had ended on a
       finished run; if what comes back is queued or running the loop carries on from there. */
    recheck: () => {
      if (disposed) return;
      if (state.reading || busy) {
        recheckPending = true;
        return;
      }
      /* A read is already scheduled, and it will begin after this question: it is the recheck.
         Its wait is left as it is. It may be a 429's backoff (at least what Retry-After asked
         for), and reading sooner, or forgetting how many 429s there have been, would be asking
         again while the backend has said to wait. */
      if (timer !== null) return;
      errors = 0;
      rateLimits = 0;
      followingSince = now();
      state = { ...state, lastFailure: null };
      schedule(0);
    },
    /** A run this page just changed (a rollback was asked for): follow it from here. */
    adopt: (run: PlacementRun) => {
      if (disposed) return;
      generation += 1;
      recheckPending = false;
      cancelTimer();
      // What was just returned counts as a read: the next one waits the full interval.
      lastReadAt = now();
      state = { ...state, run, reading: false, lastFailure: null, stopReason: null };
      begin();
    },
    dispose: () => {
      disposed = true;
      generation += 1;
      cancelTimer();
    },
  };
};

export type PollController = ReturnType<typeof createPollController>;

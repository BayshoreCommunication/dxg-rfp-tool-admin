// The organization search of the place flow, as plain code with its timers handed in
// (typeahead.test.ts). It waits at least 300 ms after the last keystroke, asks nothing below two
// characters, and drops the answer to a search that has since been replaced. A server action
// cannot be aborted once sent, so "cancelled" means its answer is ignored; the wait is what
// keeps the requests few (the search shares 600 reads per 15 minutes with the customer list).

import { searchTermOf, type PlacementFailure, type PlacementResult, type TargetOrganization } from "@/lib/legacyCustomers/placement";

export const MIN_DEBOUNCE_MS = 300;

export type TypeaheadState = {
  /** idle: nothing to search for yet. waiting: typing. loading: asked. ready: answered. failed: refused. */
  phase: "idle" | "waiting" | "loading" | "ready" | "failed";
  term: string | null;
  results: TargetOrganization[];
  failure: PlacementFailure | null;
  retryAfterSeconds: number | null;
};

export type TypeaheadDependencies = {
  search: (term: string) => Promise<PlacementResult<TargetOrganization[]>>;
  onChange: (state: TypeaheadState) => void;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  debounceMs?: number;
};

const IDLE: TypeaheadState = { phase: "idle", term: null, results: [], failure: null, retryAfterSeconds: null };

export const createTypeahead = (dependencies: TypeaheadDependencies) => {
  const setTimer = dependencies.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = dependencies.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const debounce = Math.max(MIN_DEBOUNCE_MS, Number.isFinite(dependencies.debounceMs) ? Number(dependencies.debounceMs) : MIN_DEBOUNCE_MS);

  let state = IDLE;
  let timer: unknown = null;
  // Each keystroke replaces the search before it: only the newest one's answer is shown.
  let latest = 0;
  let disposed = false;

  const emit = (next: TypeaheadState) => {
    state = next;
    if (!disposed) dependencies.onChange(state);
  };

  const run = async (term: string, mine: number) => {
    emit({ ...IDLE, phase: "loading", term });
    let result: PlacementResult<TargetOrganization[]>;
    try {
      result = await dependencies.search(term);
    } catch {
      result = { ok: false, failure: "unavailable" };
    }
    if (disposed || mine !== latest) return;
    emit(
      result.ok
        ? { ...IDLE, phase: "ready", term, results: result.data }
        : { ...IDLE, phase: "failed", term, failure: result.failure, retryAfterSeconds: result.retryAfterSeconds ?? null },
    );
  };

  return {
    getState: () => state,
    /** The text box changed. */
    input: (value: string) => {
      if (disposed) return;
      latest += 1;
      const mine = latest;
      if (timer !== null) clearTimer(timer);
      timer = null;
      const term = searchTermOf(value);
      if (!term) {
        emit(IDLE);
        return;
      }
      emit({ ...IDLE, phase: "waiting", term });
      timer = setTimer(() => {
        timer = null;
        void run(term, mine);
      }, debounce);
    },
    dispose: () => {
      disposed = true;
      latest += 1;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
};

export type Typeahead = ReturnType<typeof createTypeahead>;

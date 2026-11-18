// The gate in front of the two requests that move customer data (place, roll back), as plain
// code (confirmedSubmit.test.ts). Nothing is sent until the confirmation control is set, and
// while a request is in flight a second submit sends nothing. After a request that started a
// run the gate stays shut: the page is on its way to the run. After a refusal it opens again.
//
// This is the browser half. The server half is the Idempotency-Key each review carries (a
// repeat with the same key returns the same run and starts no second task) and the backend's
// own one-placement-per-customer rule.

export type SubmitState = { confirmed: boolean; inFlight: boolean; done: boolean };
export type SubmitOutcome<T> = { sent: true; result: T } | { sent: false; reason: "not_confirmed" | "in_flight" | "done" };

export const createConfirmedSubmit = <T>(dependencies: {
  send: () => Promise<T>;
  /** True when the request started what it asked for, so it must not be sent again. */
  succeeded: (result: T) => boolean;
  onChange?: (state: SubmitState) => void;
}) => {
  let state: SubmitState = { confirmed: false, inFlight: false, done: false };
  const emit = (change: Partial<SubmitState>) => {
    state = { ...state, ...change };
    dependencies.onChange?.(state);
  };
  return {
    getState: () => state,
    /** The confirmation control. It cannot be changed while a request is in flight. */
    setConfirmed: (confirmed: boolean) => {
      if (!state.inFlight && !state.done) emit({ confirmed });
    },
    submit: async (): Promise<SubmitOutcome<T>> => {
      if (state.done) return { sent: false, reason: "done" };
      if (state.inFlight) return { sent: false, reason: "in_flight" };
      if (!state.confirmed) return { sent: false, reason: "not_confirmed" };
      emit({ inFlight: true });
      try {
        const result = await dependencies.send();
        // A refusal asks for the confirmation again before another try.
        emit(dependencies.succeeded(result) ? { inFlight: false, done: true } : { inFlight: false, confirmed: false });
        return { sent: true, result };
      } catch (error) {
        emit({ inFlight: false, confirmed: false });
        throw error;
      }
    },
  };
};

export type ConfirmedSubmit<T> = ReturnType<typeof createConfirmedSubmit<T>>;

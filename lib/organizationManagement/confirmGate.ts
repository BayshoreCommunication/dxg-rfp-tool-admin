// The gate in front of the one staff write to a customer organization, its block or its
// reactivation, as plain code (confirmGate.test.ts). It is the confirmed-submit gate
// (lib/confirmedSubmit.ts) with the confirmation itself decided here: a ticked acknowledgement
// for a reactivation, or, for a block, the organization's name typed out.
//
// Nothing is sent until the confirmation is given; while a request is in flight a second submit
// sends nothing and the confirmation cannot be changed; after a success the gate stays shut; after
// a refusal the confirmation is cleared and must be given again.

import { createConfirmedSubmit, type SubmitOutcome } from "@/lib/confirmedSubmit";

export type WriteGateState = { acknowledged: boolean; typedName: string; confirmed: boolean; inFlight: boolean; done: boolean };

const normalized = (value: string): string => value.trim().replace(/\s+/g, " ");

/** The typed name must be the name: the same letters in the same case. Spaces at the ends are
    ignored, and a run of spaces (or other white space) inside counts as one space, on both sides. */
export const typedNameMatches = (typed: string, required: string): boolean => normalized(required) !== "" && normalized(typed) === normalized(required);

export const createWriteGate = <T>(dependencies: {
  send: () => Promise<T>;
  /** True when the write was made, so it must not be sent again. */
  succeeded: (result: T) => boolean;
  /** When set, the confirmation is this name typed out; otherwise it is the acknowledgement. */
  requiredName?: string;
  onChange?: (state: WriteGateState) => void;
}) => {
  let own = { acknowledged: false, typedName: "" };
  const state = (): WriteGateState => ({ ...own, ...inner.getState() });
  const emit = () => dependencies.onChange?.(state());
  const inner = createConfirmedSubmit<T>({ send: dependencies.send, succeeded: dependencies.succeeded, onChange: emit });
  const locked = () => inner.getState().inFlight || inner.getState().done;
  const apply = (change: Partial<typeof own>) => {
    if (locked()) return;
    own = { ...own, ...change };
    const confirmed = dependencies.requiredName !== undefined ? typedNameMatches(own.typedName, dependencies.requiredName) : own.acknowledged;
    if (confirmed !== inner.getState().confirmed) inner.setConfirmed(confirmed);
    else emit();
  };
  const clear = () => {
    own = { acknowledged: false, typedName: "" };
    emit();
  };
  return {
    getState: state,
    setAcknowledged: (acknowledged: boolean) => apply({ acknowledged }),
    setTypedName: (typedName: string) => apply({ typedName }),
    submit: async (): Promise<SubmitOutcome<T>> => {
      try {
        const outcome = await inner.submit();
        // A refusal asks for the confirmation again: what was ticked or typed is cleared with it.
        if (outcome.sent && !inner.getState().done) clear();
        return outcome;
      } catch (error) {
        clear();
        throw error;
      }
    },
  };
};

export type WriteGate<T> = ReturnType<typeof createWriteGate<T>>;

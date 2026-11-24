import { createConfirmedSubmit, type SubmitState } from "@/lib/confirmedSubmit";

type Result = { ok: boolean };

const harness = () => {
  const pending: Array<{ resolve: (result: Result) => void; reject: (error: unknown) => void }> = [];
  const states: SubmitState[] = [];
  const gate = createConfirmedSubmit<Result>({
    send: () => new Promise<Result>((resolve, reject) => pending.push({ resolve, reject })),
    succeeded: (result) => result.ok,
    onChange: (state) => states.push(state),
  });
  return { gate, pending, states };
};

describe("the confirmation gate in front of a placement or a rollback", () => {
  it("sends nothing before the confirmation is given", async () => {
    const h = harness();
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    expect(h.pending).toHaveLength(0);
    // Given and taken back: still nothing.
    h.gate.setConfirmed(true);
    h.gate.setConfirmed(false);
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    expect(h.pending).toHaveLength(0);
  });

  it("sends one request for a double submit", async () => {
    const h = harness();
    h.gate.setConfirmed(true);
    const first = h.gate.submit();
    const second = h.gate.submit();
    const third = h.gate.submit();
    expect(h.pending).toHaveLength(1);
    expect(h.gate.getState()).toMatchObject({ inFlight: true });
    await expect(second).resolves.toEqual({ sent: false, reason: "in_flight" });
    await expect(third).resolves.toEqual({ sent: false, reason: "in_flight" });
    h.pending[0].resolve({ ok: true });
    await expect(first).resolves.toEqual({ sent: true, result: { ok: true } });
    expect(h.pending).toHaveLength(1);
  });

  it("stays shut after a request that started a run", async () => {
    const h = harness();
    h.gate.setConfirmed(true);
    const first = h.gate.submit();
    h.pending[0].resolve({ ok: true });
    await first;
    expect(h.gate.getState()).toEqual({ confirmed: true, inFlight: false, done: true });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "done" });
    h.gate.setConfirmed(false);
    h.gate.setConfirmed(true);
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "done" });
    expect(h.pending).toHaveLength(1);
  });

  it("asks for the confirmation again after a refusal, then sends once more", async () => {
    const h = harness();
    h.gate.setConfirmed(true);
    const first = h.gate.submit();
    h.pending[0].resolve({ ok: false });
    await expect(first).resolves.toEqual({ sent: true, result: { ok: false } });
    expect(h.gate.getState()).toEqual({ confirmed: false, inFlight: false, done: false });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    h.gate.setConfirmed(true);
    void h.gate.submit();
    expect(h.pending).toHaveLength(2);
  });

  it("opens again, unconfirmed, after a request that throws", async () => {
    const h = harness();
    h.gate.setConfirmed(true);
    const first = h.gate.submit();
    h.pending[0].reject(new Error("network"));
    await expect(first).rejects.toThrow("network");
    expect(h.gate.getState()).toEqual({ confirmed: false, inFlight: false, done: false });
  });

  it("does not let the confirmation be changed while the request is in flight", () => {
    const h = harness();
    h.gate.setConfirmed(true);
    void h.gate.submit();
    h.gate.setConfirmed(false);
    expect(h.gate.getState()).toMatchObject({ confirmed: true, inFlight: true });
  });
});

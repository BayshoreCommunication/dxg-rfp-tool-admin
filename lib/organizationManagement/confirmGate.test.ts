import { createWriteGate, typedNameMatches, type WriteGateState } from "@/lib/organizationManagement/confirmGate";

type Result = { ok: boolean };

const harness = (requiredName?: string) => {
  const pending: Array<{ resolve: (result: Result) => void; reject: (error: unknown) => void }> = [];
  const states: WriteGateState[] = [];
  const gate = createWriteGate<Result>({
    send: () => new Promise<Result>((resolve, reject) => pending.push({ resolve, reject })),
    succeeded: (result) => result.ok,
    requiredName,
    onChange: (state) => states.push(state),
  });
  return { gate, pending, states };
};

describe("the confirmation gate in front of a staff write", () => {
  it("sends nothing before the confirmation is given", async () => {
    const h = harness();
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    // Given and taken back: still nothing.
    h.gate.setAcknowledged(true);
    h.gate.setAcknowledged(false);
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    expect(h.pending).toHaveLength(0);
    expect(h.gate.getState()).toEqual({ acknowledged: false, typedName: "", confirmed: false, inFlight: false, done: false });
  });

  it("sends one request for a double submit, and stays shut after a success", async () => {
    const h = harness();
    h.gate.setAcknowledged(true);
    const first = h.gate.submit();
    const second = h.gate.submit();
    const third = h.gate.submit();
    expect(h.pending).toHaveLength(1);
    expect(h.gate.getState()).toMatchObject({ inFlight: true, confirmed: true });
    await expect(second).resolves.toEqual({ sent: false, reason: "in_flight" });
    await expect(third).resolves.toEqual({ sent: false, reason: "in_flight" });
    h.pending[0].resolve({ ok: true });
    await expect(first).resolves.toEqual({ sent: true, result: { ok: true } });
    expect(h.gate.getState()).toMatchObject({ inFlight: false, done: true });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "done" });
    expect(h.pending).toHaveLength(1);
  });

  it("cannot have its confirmation changed while a request is in flight or after it succeeded", async () => {
    const h = harness("Acme Events");
    h.gate.setTypedName("Acme Events");
    const sent = h.gate.submit();
    h.gate.setTypedName("");
    h.gate.setAcknowledged(true);
    expect(h.gate.getState()).toMatchObject({ typedName: "Acme Events", acknowledged: false, confirmed: true, inFlight: true });
    h.pending[0].resolve({ ok: true });
    await sent;
    h.gate.setTypedName("something else");
    expect(h.gate.getState()).toMatchObject({ typedName: "Acme Events", done: true });
  });

  it("asks for the confirmation again after a refusal, with what was ticked cleared", async () => {
    const h = harness();
    h.gate.setAcknowledged(true);
    const sent = h.gate.submit();
    h.pending[0].resolve({ ok: false });
    await expect(sent).resolves.toEqual({ sent: true, result: { ok: false } });
    expect(h.gate.getState()).toEqual({ acknowledged: false, typedName: "", confirmed: false, inFlight: false, done: false });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    expect(h.pending).toHaveLength(1);
    // Confirmed again: a second request can be made.
    h.gate.setAcknowledged(true);
    void h.gate.submit();
    expect(h.pending).toHaveLength(2);
  });

  it("clears the confirmation when the request throws", async () => {
    const h = harness("Acme Events");
    h.gate.setTypedName("Acme Events");
    const sent = h.gate.submit();
    h.pending[0].reject(new Error("network"));
    await expect(sent).rejects.toThrow("network");
    expect(h.gate.getState()).toEqual({ acknowledged: false, typedName: "", confirmed: false, inFlight: false, done: false });
  });

  it("tells every change to its listener", () => {
    const h = harness("Acme");
    h.gate.setTypedName("Ac");
    h.gate.setTypedName("Acme");
    expect(h.states.map((state) => [state.typedName, state.confirmed])).toEqual([
      ["Ac", false],
      ["Acme", true],
    ]);
  });
});

describe("the typed-name gate for a transfer of ownership and a block", () => {
  it("opens only when the organization's name is typed out", async () => {
    const h = harness("Acme Events");
    for (const typed of ["", "Acme", "acme events", "ACME EVENTS", "Acme Events Ltd", "Acme  Event"]) {
      h.gate.setTypedName(typed);
      expect({ typed, confirmed: h.gate.getState().confirmed }).toEqual({ typed, confirmed: false });
      await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    }
    expect(h.pending).toHaveLength(0);
    h.gate.setTypedName("Acme Events");
    expect(h.gate.getState().confirmed).toBe(true);
    void h.gate.submit();
    expect(h.pending).toHaveLength(1);
  });

  it("is not opened by the acknowledgement alone, and shuts again when the name is edited", async () => {
    const h = harness("Acme Events");
    h.gate.setAcknowledged(true);
    expect(h.gate.getState().confirmed).toBe(false);
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    h.gate.setTypedName("Acme Events");
    h.gate.setTypedName("Acme Event");
    expect(h.gate.getState().confirmed).toBe(false);
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
    expect(h.pending).toHaveLength(0);
  });

  it("asks for the name again after a refusal", async () => {
    const h = harness("Acme Events");
    h.gate.setTypedName("Acme Events");
    const sent = h.gate.submit();
    h.pending[0].resolve({ ok: false });
    await sent;
    expect(h.gate.getState()).toMatchObject({ typedName: "", confirmed: false });
    await expect(h.gate.submit()).resolves.toEqual({ sent: false, reason: "not_confirmed" });
  });

  it("matches the name exactly, spaces at the ends and runs of spaces aside, and never an empty name", () => {
    expect(typedNameMatches("Acme Events", "Acme Events")).toBe(true);
    expect(typedNameMatches("  Acme   Events ", "Acme Events")).toBe(true);
    expect(typedNameMatches("acme events", "Acme Events")).toBe(false);
    expect(typedNameMatches("Acme", "Acme Events")).toBe(false);
    expect(typedNameMatches("", "")).toBe(false);
    expect(typedNameMatches("   ", "  ")).toBe(false);
    // A gate asked for an empty name can never be opened.
    const h = harness("");
    h.gate.setTypedName("");
    h.gate.setAcknowledged(true);
    expect(h.gate.getState().confirmed).toBe(false);
  });
});

import type { PlacementResult, TargetOrganization } from "@/lib/legacyCustomers/placement";
import { createTypeahead, MIN_DEBOUNCE_MS, type TypeaheadState } from "@/lib/legacyCustomers/typeahead";

const org = (name: string): TargetOrganization => ({ organizationId: "6a0000000000000000000001", name, slug: null });

const harness = (debounceMs?: number) => {
  const asked: string[] = [];
  const pending: Array<(result: PlacementResult<TargetOrganization[]>) => void> = [];
  const states: TypeaheadState[] = [];
  const typeahead = createTypeahead({
    search: (term) => {
      asked.push(term);
      return new Promise((resolve) => pending.push(resolve));
    },
    onChange: (state) => states.push(state),
    debounceMs,
  });
  return { typeahead, asked, pending, states };
};
const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("the organization search", () => {
  it("waits 300 ms after the last keystroke before asking, once", async () => {
    expect(MIN_DEBOUNCE_MS).toBe(300);
    const h = harness();
    for (const value of ["ac", "acm", "acme"]) {
      h.typeahead.input(value);
      await advance(299);
    }
    expect(h.asked).toEqual([]);
    expect(h.typeahead.getState()).toMatchObject({ phase: "waiting", term: "acme" });
    await advance(1);
    expect(h.asked).toEqual(["acme"]);
    expect(h.typeahead.getState().phase).toBe("loading");
    await advance(5000);
    expect(h.asked).toEqual(["acme"]);
  });

  it.each([0, 50, 299, -1, Number.NaN])("raises a wait of %p ms to 300", async (debounceMs) => {
    const h = harness(debounceMs);
    h.typeahead.input("acme");
    await advance(299);
    expect(h.asked).toEqual([]);
    await advance(1);
    expect(h.asked).toEqual(["acme"]);
  });

  it("keeps a longer wait when one is asked for", async () => {
    const h = harness(800);
    h.typeahead.input("acme");
    await advance(799);
    expect(h.asked).toEqual([]);
    await advance(1);
    expect(h.asked).toEqual(["acme"]);
  });

  it.each(["", "a", " a ", "  ", "a "])("asks nothing for %p: below two characters", async (value) => {
    const h = harness();
    h.typeahead.input(value);
    await advance(5000);
    expect(h.asked).toEqual([]);
    expect(h.typeahead.getState()).toMatchObject({ phase: "idle", results: [] });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("sends the trimmed text", async () => {
    const h = harness();
    h.typeahead.input("  acme events  ");
    await advance(300);
    expect(h.asked).toEqual(["acme events"]);
  });

  it("ignores the answer to a search that has been replaced, whatever order they arrive in", async () => {
    const h = harness();
    h.typeahead.input("ac");
    await advance(300);
    h.typeahead.input("acme");
    await advance(300);
    expect(h.asked).toEqual(["ac", "acme"]);
    // The newer answer first, then the older one late: the older one is dropped.
    h.pending[1]({ ok: true, data: [org("Acme Events")] });
    await advance(0);
    h.pending[0]({ ok: true, data: [org("Accent"), org("Acme Events")] });
    await advance(0);
    expect(h.typeahead.getState()).toMatchObject({ phase: "ready", term: "acme", results: [{ name: "Acme Events" }] });
  });

  it("ignores an answer that arrives after the box was cleared, or while the next search is waiting", async () => {
    const h = harness();
    h.typeahead.input("acme");
    await advance(300);
    h.typeahead.input("");
    h.pending[0]({ ok: true, data: [org("Acme Events")] });
    await advance(0);
    expect(h.typeahead.getState()).toMatchObject({ phase: "idle", results: [] });

    h.typeahead.input("beta");
    await advance(300);
    h.typeahead.input("beta c");
    h.pending[1]({ ok: true, data: [org("Beta")] });
    await advance(0);
    expect(h.typeahead.getState()).toMatchObject({ phase: "waiting", term: "beta c", results: [] });
  });

  it("shows a refusal as a state, with how long to wait when the answer says", async () => {
    const h = harness();
    h.typeahead.input("acme");
    await advance(300);
    h.pending[0]({ ok: false, failure: "rate_limited", retryAfterSeconds: 40 });
    await advance(0);
    expect(h.typeahead.getState()).toMatchObject({ phase: "failed", failure: "rate_limited", retryAfterSeconds: 40, results: [] });
  });

  it("treats a search that throws as unavailable", async () => {
    const states: TypeaheadState[] = [];
    const typeahead = createTypeahead({ search: () => Promise.reject(new Error("network")), onChange: (state) => states.push(state) });
    typeahead.input("acme");
    await advance(300);
    expect(typeahead.getState()).toMatchObject({ phase: "failed", failure: "unavailable" });
  });

  it("sends and reports nothing after it is disposed", async () => {
    const h = harness();
    h.typeahead.input("acme");
    h.typeahead.dispose();
    await advance(5000);
    expect(h.asked).toEqual([]);
    const h2 = harness();
    h2.typeahead.input("acme");
    await advance(300);
    h2.typeahead.dispose();
    const before = h2.states.length;
    h2.pending[0]({ ok: true, data: [org("Acme")] });
    await advance(0);
    expect(h2.states).toHaveLength(before);
  });
});

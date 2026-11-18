import { clearPlacementDrafts, draftStorageKey, emptyDraft, parseDraft, requestOfDraft, teamAfterListing } from "@/lib/legacyCustomers/draft";

const ORG = "6b0000000000000000000002";
const KEY = "3f1c9a52-7d7e-4b9e-9a51-0f6f6c1d2e3f";

describe("the place flow's saved choices", () => {
  it("is kept per customer", () => {
    expect(draftStorageKey("6a0000000000000000000001")).toBe("legacy-placement-draft:6a0000000000000000000001");
  });

  it("comes back as it was saved", () => {
    const draft = { ...emptyDraft(), target: "existing" as const, organizationId: ORG, organizationName: "Acme", role: "planner", step: "review" as const, idempotencyKey: KEY };
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it("keeps the chosen organization's slug with its name and id, for the review", () => {
    expect(emptyDraft().organizationSlug).toBe("");
    const draft = { ...emptyDraft(), target: "existing" as const, organizationId: ORG, organizationName: "Acme", organizationSlug: "acme-events", role: "planner" };
    expect(parseDraft(JSON.stringify(draft))).toMatchObject({ organizationId: ORG, organizationName: "Acme", organizationSlug: "acme-events" });
    expect(parseDraft(JSON.stringify({ ...draft, organizationSlug: 7 }))).toMatchObject({ organizationSlug: "" });
    expect(parseDraft(JSON.stringify({ ...draft, organizationSlug: "s".repeat(500) }))?.organizationSlug).toHaveLength(80);
  });

  it.each([null, undefined, "", "{", "[]", "null", "5", '"x"'])("reads %p as no draft", (stored) => {
    expect(parseDraft(stored)).toBeNull();
  });

  it("keeps only known fields, as text of a bounded length", () => {
    const parsed = parseDraft(JSON.stringify({ target: "holding", name: "x".repeat(5000), type: 5, organizationId: "nope", teamId: "nope", step: "sent", idempotencyKey: "bad key", extra: { a: 1 } }));
    expect(parsed).toEqual({ ...emptyDraft(), name: "x".repeat(300) });
  });

  it("does not restore a review whose request no longer passes, or that has no key", () => {
    const review = { ...emptyDraft(), target: "existing", organizationId: ORG, role: "owner", step: "review", idempotencyKey: KEY };
    expect(parseDraft(JSON.stringify(review))).toMatchObject({ step: "form", idempotencyKey: "" });
    expect(parseDraft(JSON.stringify({ ...review, role: "planner", idempotencyKey: "" }))).toMatchObject({ step: "form" });
  });

  it("builds the checked request from the draft's text", () => {
    expect(requestOfDraft({ ...emptyDraft(), target: "new", name: " Acme ", eventsPerYear: "12", country: "gb" })).toEqual({
      ok: true,
      request: { target: "new", organization: { name: "Acme", country: "GB", eventsPerYear: 12 } },
    });
    expect(requestOfDraft({ ...emptyDraft(), target: "existing", organizationId: ORG, role: "planner" })).toEqual({
      ok: true,
      request: { target: "existing", organizationId: ORG, role: "planner" },
    });
    expect(requestOfDraft(emptyDraft())).toMatchObject({ ok: false, errors: { target: expect.any(String) } });
  });
});

describe("a saved team against the organization's teams as they are now", () => {
  const TEAM = "6c0000000000000000000003";
  const OTHER = "6c0000000000000000000004";
  const saved = { ...emptyDraft(), target: "existing" as const, organizationId: ORG, role: "planner", teamId: TEAM, teamName: "East" };

  it("takes a team that is no longer listed out of the draft, and names it", () => {
    expect(teamAfterListing(saved, [{ id: OTHER, name: "West" }])).toEqual({ change: { teamId: "", teamName: "" }, dropped: "East" });
    expect(teamAfterListing(saved, [])).toEqual({ change: { teamId: "", teamName: "" }, dropped: "East" });
    expect(teamAfterListing({ teamId: TEAM, teamName: "  " }, [])).toEqual({ change: { teamId: "", teamName: "" }, dropped: "The team chosen earlier" });
  });

  it("no longer sends the old team once the change is applied", () => {
    expect(requestOfDraft(saved)).toMatchObject({ ok: true, request: { teamId: TEAM } });
    const after = teamAfterListing(saved, [{ id: OTHER, name: "West" }]);
    const cleared = requestOfDraft({ ...saved, ...after.change });
    expect(cleared).toEqual({ ok: true, request: { target: "existing", organizationId: ORG, role: "planner" } });
  });

  it("keeps a team that is still listed, with its name as it is now", () => {
    expect(teamAfterListing(saved, [{ id: OTHER, name: "West" }, { id: TEAM, name: "East" }])).toEqual({ change: null, dropped: null });
    expect(teamAfterListing(saved, [{ id: TEAM, name: "East Coast" }])).toEqual({ change: { teamId: TEAM, teamName: "East Coast" }, dropped: null });
  });

  it("has nothing to do when no team was saved", () => {
    expect(teamAfterListing({ teamId: "", teamName: "" }, [{ id: TEAM, name: "East" }])).toEqual({ change: null, dropped: null });
    expect(teamAfterListing({ teamId: "", teamName: "stale" }, [])).toEqual({ change: null, dropped: null });
  });
});

describe("saved choices are cleared on sign-out", () => {
  const storageOf = (entries: Record<string, string>) => {
    const map = new Map(Object.entries(entries));
    return {
      map,
      get length() {
        return map.size;
      },
      key: (index: number) => [...map.keys()][index] ?? null,
      removeItem: (key: string) => void map.delete(key),
    };
  };

  it("removes every placement draft and nothing else", () => {
    const storage = storageOf({
      [draftStorageKey("6a0000000000000000000001")]: "{}",
      theme: "dark",
      [draftStorageKey("6a0000000000000000000002")]: "{}",
      "legacy-placement": "not a draft",
      [draftStorageKey("6a0000000000000000000003")]: "{}",
    });
    expect(clearPlacementDrafts(storage)).toBe(3);
    expect([...storage.map.keys()].sort()).toEqual(["legacy-placement", "theme"]);
    expect(clearPlacementDrafts(storage)).toBe(0);
  });

  it("does nothing, and does not throw, without a storage or with one that refuses", () => {
    expect(clearPlacementDrafts(null)).toBe(0);
    expect(clearPlacementDrafts(undefined)).toBe(0);
    const refusing = { get length(): number { throw new Error("blocked"); }, key: () => null, removeItem: () => undefined };
    expect(clearPlacementDrafts(refusing)).toBe(0);
  });
});

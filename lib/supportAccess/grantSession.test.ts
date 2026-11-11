import { FRESH_RENDER_MS, checkGrants, grantDeadline, isFreshRender, screenState, secondsRemainingAt } from "./grantSession";

const READ_AT = Date.parse("2026-11-11T06:00:00.000Z");
const grant = (expiresAt: string | null, secondsRemaining: number) => ({ expiresAt, secondsRemaining });

describe("an open support access screen (ORG-406)", () => {
  it("counts down to the grant's expiry instant, not from when the screen was mounted", () => {
    const oneHour = grant("2026-11-11T07:00:00.000Z", 3_600);
    expect(grantDeadline(oneHour, READ_AT)).toBe(READ_AT + 3_600_000);
    expect(secondsRemainingAt([oneHour], READ_AT, READ_AT)).toEqual([3_600]);
    expect(secondsRemainingAt([oneHour], READ_AT, READ_AT + 1_800_000)).toEqual([1_800]);
    // A screen restored from cache two hours later has nothing left, however it was mounted.
    expect(secondsRemainingAt([oneHour], READ_AT, READ_AT + 7_200_000)).toEqual([0]);
  });

  it("takes the earlier of the expiry and the server's count, and survives a missing expiry", () => {
    expect(grantDeadline(grant("2026-11-11T09:00:00.000Z", 60), READ_AT)).toBe(READ_AT + 60_000);
    expect(grantDeadline(grant("2026-11-11T06:00:30.000Z", 600), READ_AT)).toBe(READ_AT + 30_000);
    expect(grantDeadline(grant(null, 120), READ_AT)).toBe(READ_AT + 120_000);
    expect(grantDeadline(grant("not a date", -5), READ_AT)).toBe(READ_AT);
  });

  it("treats only a just-rendered screen as fresh", () => {
    expect(isFreshRender(READ_AT, READ_AT + 2_000)).toBe(true);
    expect(isFreshRender(READ_AT, READ_AT + FRESH_RENDER_MS + 1)).toBe(false);
    expect(isFreshRender(READ_AT, READ_AT - FRESH_RENDER_MS - 1)).toBe(false);
  });

  it("decides what a grant check means", () => {
    expect(checkGrants(["a"], ["a", "b"])).toBe("active");
    expect(checkGrants(["a", "b"], ["a", "b"])).toBe("active");
    // Revoked, with nothing else granted: the screen closes.
    expect(checkGrants(["a"], [])).toBe("ended");
    // The RFP grant is gone but an organization grant remains: the server reads again.
    expect(checkGrants(["a"], ["b"])).toBe("reread");
    expect(checkGrants(["a", "b"], ["b"])).toBe("reread");
    expect(checkGrants(["a"], null)).toBe("unknown");
    expect(checkGrants([], ["b"])).toBe("reread");
  });

  it("shows customer content only under a confirmed, unexpired grant", () => {
    expect(screenState({ remaining: [120], lastCheck: "active" })).toBe("showing");
    expect(screenState({ remaining: [120, 30], lastCheck: "active" })).toBe("showing");
    // Restored from cache and not yet checked, or the check failed: hidden.
    expect(screenState({ remaining: [120], lastCheck: "pending" })).toBe("checking");
    expect(screenState({ remaining: [120], lastCheck: "unknown" })).toBe("checking");
    expect(screenState({ remaining: [120], lastCheck: "reread" })).toBe("checking");
    // Time ran out: hidden at once, even before the next check answers.
    expect(screenState({ remaining: [0], lastCheck: "active" })).toBe("checking");
    expect(screenState({ remaining: [120, 0], lastCheck: "active" })).toBe("checking");
    expect(screenState({ remaining: [], lastCheck: "active" })).toBe("checking");
    // An RFP grant that ran out does not by itself end access: only "no grant left" does.
    expect(screenState({ remaining: [0], lastCheck: "reread" })).toBe("checking");
    expect(screenState({ remaining: [0], lastCheck: "ended" })).toBe("ended");
    expect(screenState({ remaining: [120], lastCheck: "ended" })).toBe("ended");
  });
});

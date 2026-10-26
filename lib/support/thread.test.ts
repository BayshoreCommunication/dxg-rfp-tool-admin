import type { SupportMessage } from "@/app/actions/supportDesk";
import { buildThreadItems, dayLabel, initials, isAutomaticReply, isDxgSide, isEvent } from "./thread";

const msg = (
  id: string,
  authorRole: SupportMessage["authorRole"],
  createdAt: string,
  kind: SupportMessage["kind"] = "message",
  authorUserId: string | null = authorRole === "agent" ? "agent-1" : authorRole === "customer" ? "planner-1" : null,
): SupportMessage => ({ id, ticketId: "t1", authorUserId, authorRole, kind, body: id, attachments: [], createdAt });

describe("admin support thread layout", () => {
  const now = new Date(2026, 9, 26, 15, 0);

  it("labels today, yesterday and older days", () => {
    expect(dayLabel(new Date(2026, 9, 26, 9, 0), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 25, 9, 0), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 18, 9, 0), now)).toBe("Sunday, Oct 18");
    expect(dayLabel(new Date(2025, 0, 2, 9, 0), now)).toBe("Jan 2, 2025");
  });

  it("classifies sides, events and the automatic reply", () => {
    expect(isAutomaticReply(msg("ack", "system", "2026-10-26T10:00:00Z"))).toBe(true);
    expect(isEvent(msg("ev", "system", "2026-10-26T10:00:00Z", "system"))).toBe(true);
    expect(isEvent(msg("triage", "system", "2026-10-26T10:00:00Z", "internal_note"))).toBe(true);
    expect(isEvent(msg("note", "agent", "2026-10-26T10:00:00Z", "internal_note"))).toBe(false);
    expect(isDxgSide(msg("c", "customer", "2026-10-26T10:00:00Z"))).toBe(false);
    expect(isDxgSide(msg("a", "agent", "2026-10-26T10:00:00Z"))).toBe(true);
    expect(isDxgSide(msg("ack", "system", "2026-10-26T10:00:00Z"))).toBe(true);
  });

  it("adds day separators and groups same-author bursts, never mixing notes with replies", () => {
    const day1 = new Date(2026, 9, 25, 9, 0).getTime();
    const day2 = new Date(2026, 9, 26, 9, 0).getTime();
    const at = (ms: number) => new Date(ms).toISOString();
    const items = buildThreadItems([
      msg("c1", "customer", at(day1)),
      msg("c2", "customer", at(day1 + 60_000)),
      msg("ack", "system", at(day1 + 61_000)),
      msg("a1", "agent", at(day2)),
      msg("n1", "agent", at(day2 + 30_000), "internal_note"),
      msg("ev", "system", at(day2 + 40_000), "system"),
      msg("a2", "agent", at(day2 + 60_000)),
    ], now);
    expect(items.map((item) =>
      item.type === "message" ? `${item.key}:${item.startsGroup ? "S" : "-"}${item.endsGroup ? "E" : "-"}`
        : item.type === "day" ? `day:${item.label}` : `event:${item.key}`,
    )).toEqual([
      "day:Yesterday", "c1:S-", "c2:-E", "ack:SE",
      "day:Today", "a1:SE", "n1:SE", "event:ev", "a2:SE",
    ]);
  });

  it("omits day separators before hydration and builds initials", () => {
    expect(buildThreadItems([msg("c1", "customer", "2026-10-26T10:00:00Z")], null).map((item) => item.type)).toEqual(["message"]);
    expect(initials("Dana DXG Smith")).toBe("DS");
    expect(initials("Akib")).toBe("A");
    expect(initials("  ")).toBe("?");
  });
});

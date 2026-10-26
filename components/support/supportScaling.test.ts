import { readFileSync } from "node:fs";
import { join } from "node:path";
import { responseDue } from "./supportLabels";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const NOW = Date.parse("2026-10-26T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const MIN = 60_000;

describe("support desk scaling surfaces", () => {
  it("labels response targets as due, due soon, or overdue", () => {
    expect(responseDue(null, NOW)).toBeNull();
    expect(responseDue("not a date", NOW)).toBeNull();
    expect(responseDue(at(3 * 60 * MIN + 15 * MIN), NOW)).toEqual({ tone: "ok", label: "Reply due in 3h 15m" });
    expect(responseDue(at(20 * MIN), NOW)).toEqual({ tone: "soon", label: "Reply due in 20m" });
    expect(responseDue(at(-25 * MIN), NOW)).toEqual({ tone: "overdue", label: "Overdue 25m" });
    expect(responseDue(at(-26 * 60 * MIN), NOW)).toEqual({ tone: "overdue", label: "Overdue 1d 2h" });
  });

  it("sends presence heartbeats, leaves on unmount, and confirms before replying over a colleague", () => {
    const workspace = read("components/support/SupportTicketWorkspace.tsx");
    expect(workspace).toMatch(/supportPresenceAction\(ticket\.id, writingRef\.current \? "replying" : "viewing"\)/);
    expect(workspace).toMatch(/void leaveSupportPresenceAction\(ticket\.id\)/);
    expect(workspace).toMatch(/mode === "reply" && replyingOthers\.length > 0/);
    expect(workspace).toMatch(/title="Someone else is replying"/);
    const actions = read("app/actions/supportDesk.ts");
    expect(actions).toMatch(/\/tickets\/\$\{encodeURIComponent\(ticketId\)\}\/presence/);
  });

  it("sorts the inbox most urgent first by default and shows overdue counts", () => {
    const inbox = read("components/support/SupportInbox.tsx");
    expect(inbox).toMatch(/sort: filters\.sort === "recent" \? "recent" : "urgency"/);
    expect(inbox).toMatch(/<ResponseDueBadge dueAt=\{ticket\.responseDueAt\} \/>/);
    expect(read("components/support/SupportMetricsCards.tsx")).toMatch(/title="Overdue"/);
  });
});

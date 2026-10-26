import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fillCannedReply, matchesCannedReply } from "./CannedReplyPicker";
import { closesIn, responseDue } from "./supportLabels";

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
    expect(inbox).toMatch(/<ResponseDueBadge dueAt=\{ticket\.responseDueAt\} resolvedAt=/);
    expect(read("components/support/SupportMetricsCards.tsx")).toMatch(/title="Overdue"/);
  });

  it("counts down a resolved ticket's reopen window", () => {
    expect(closesIn(null, NOW)).toBeNull();
    expect(closesIn(at(-24 * 60 * MIN), NOW)).toBe("Closes in 2d 0h");
    expect(closesIn(at(-71 * 60 * MIN), NOW)).toBe("Closes in 1h");
    expect(closesIn(at(-4 * 24 * 60 * MIN), NOW)).toBe("Closing soon");
  });

  it("Send is the main button; resolving sits behind its menu so it is never clicked by accident", () => {
    const workspace = read("components/support/SupportTicketWorkspace.tsx");
    expect(workspace).toMatch(/onSend=\{\(\) => send\(\)\} onSendAndResolve=\{\(\) => send\("resolved"\)\}/);
    expect(workspace).not.toMatch(/Then set status to/);
    const button = read("components/support/SendReplyButton.tsx");
    expect(button).toMatch(/role="menu"/);
    expect(button).toMatch(/Send &amp; mark resolved/);
    expect(button).toMatch(/setMenuOpen\(false\);\s*onSendAndResolve\(\)/);
  });

  it("fills canned reply placeholders and searches titles and bodies", () => {
    const context = { customerName: "Pat  Planner", ticketNumber: 42 };
    expect(fillCannedReply("Hi {{first_name}}, about {{ ticket_number }} — {{agent_name}}", context)).toBe(
      "Hi Pat, about #42 — DXG support",
    );
    expect(fillCannedReply("Hi {{name}} {{unknown}}", { customerName: null, ticketNumber: 1 })).toBe("Hi there {{unknown}}");
    const reply = { id: "r1", title: "Password reset", body: "Open the sign-in page" } as Parameters<typeof matchesCannedReply>[0];
    expect(matchesCannedReply(reply, "")).toBe(true);
    expect(matchesCannedReply(reply, "PASSWORD")).toBe(true);
    expect(matchesCannedReply(reply, "sign-in")).toBe(true);
    expect(matchesCannedReply(reply, "invoice")).toBe(false);
  });

  it("opens canned replies from the toolbar or with / in an empty reply", () => {
    const workspace = read("components/support/SupportTicketWorkspace.tsx");
    expect(workspace).toMatch(/event\.key === "\/" && mode === "reply" && !body/);
    expect(workspace).toMatch(/<CannedReplyPicker/);
    expect(read("components/support/CannedReplyPicker.tsx")).toMatch(/href="\/support\/canned-replies"/);
  });
});

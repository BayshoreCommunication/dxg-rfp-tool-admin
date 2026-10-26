import {
  badgeLabel,
  mergeNotifications,
  notificationHref,
  parseSocketEvent,
  reconnectDelayMs,
  toAdminNotification,
  unreadForPath,
  type AdminNotification,
} from "./adminNotifications";

const note = (overrides: Partial<AdminNotification> = {}): AdminNotification => ({
  _id: "n1",
  type: "support_ticket",
  title: "New support ticket #12",
  message: "Can't upload my floor plan",
  isRead: false,
  createdAt: "2026-10-26T06:00:00.000Z",
  metadata: { ticketId: "t1", ticketNumber: 12, audience: "agent" },
  ...overrides,
});

describe("admin notification helpers", () => {
  it("parses a new-notification frame from the backend socket", () => {
    const event = parseSocketEvent(JSON.stringify({
      event: "notification:new",
      data: { _id: "n9", type: "support_ticket", title: "T", message: "M", isRead: false, createdAt: "2026-10-26T06:00:00.000Z", metadata: { ticketId: "t9", ticketNumber: 9 } },
    }));
    expect(event).toEqual({
      kind: "new",
      notification: expect.objectContaining({ _id: "n9", metadata: expect.objectContaining({ ticketId: "t9", ticketNumber: 9 }) }),
    });
  });

  it("parses unread-count frames and ignores anything else", () => {
    expect(parseSocketEvent('{"event":"notification:unread-count","data":{"count":3}}')).toEqual({ kind: "unread-count", count: 3 });
    expect(parseSocketEvent('{"event":"notification:unread-count","data":{"count":-1}}')).toEqual({ kind: "ignore" });
    expect(parseSocketEvent('{"event":"connected","data":{}}')).toEqual({ kind: "ignore" });
    expect(parseSocketEvent("not json")).toEqual({ kind: "ignore" });
    expect(parseSocketEvent('{"event":"notification:new","data":{"title":"no id"}}')).toEqual({ kind: "ignore" });
  });

  it("drops malformed metadata instead of trusting it", () => {
    expect(toAdminNotification({ _id: "n1", title: "T", metadata: { ticketId: 42 } })?.metadata?.ticketId).toBeUndefined();
  });

  it("links to the ticket, or to the inbox when there is none", () => {
    expect(notificationHref(note())).toBe("/support/t1");
    expect(notificationHref(note({ metadata: {} }))).toBe("/support");
  });

  it("finds unread alerts for the ticket that is open", () => {
    const list = [note(), note({ _id: "n2", isRead: true }), note({ _id: "n3", metadata: { ticketId: "t2" } })];
    expect(unreadForPath(list, "/support/t1").map((item) => item._id)).toEqual(["n1"]);
    expect(unreadForPath(list, "/support")).toEqual([]);
    expect(unreadForPath(list, "/dashboard")).toEqual([]);
  });

  it("merges newest first without duplicates and caps the list", () => {
    const older = note({ _id: "a", createdAt: "2026-10-25T00:00:00.000Z" });
    const newer = note({ _id: "b", createdAt: "2026-10-26T00:00:00.000Z" });
    expect(mergeNotifications([older], [newer, older]).map((item) => item._id)).toEqual(["b", "a"]);
    expect(mergeNotifications([older], [newer], 1).map((item) => item._id)).toEqual(["b"]);
  });

  it("formats the badge and backs off reconnects up to a minute", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(120)).toBe("99+");
    expect([0, 1, 2, 10].map(reconnectDelayMs)).toEqual([2000, 4000, 8000, 60000]);
  });
});

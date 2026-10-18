import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDuration, formatRelative, statusLabel } from "./supportLabels";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("support desk surfaces", () => {
  it("adds a Support entry to the primary navigation", () => {
    const navigation = read("config/navigation.tsx");
    expect(navigation).toMatch(/id: "support"/);
    expect(navigation).toMatch(/href: "\/support"/);
  });

  it("keeps internal notes visibly distinct and never sends them as replies", () => {
    const workspace = read("components/support/SupportTicketWorkspace.tsx");
    expect(workspace).toMatch(/Internal note/);
    expect(workspace).toMatch(/The customer never sees internal notes\./);
    expect(workspace).toMatch(/mode === "reply"\s*\?\s*await replySupportTicketAction/);
    expect(workspace).toMatch(/: await addSupportNoteAction/);
  });

  it("offers attachments only on customer replies and links them through the signed proxy", () => {
    const workspace = read("components/support/SupportTicketWorkspace.tsx");
    expect(workspace).toMatch(/mode === "reply" && \(\s*<div className="mt-3">\s*<AttachmentPicker/);
    expect(workspace).toMatch(/supportAttachmentHref\(ticketId, attachment\.id\)/);
    expect(workspace).toMatch(/rel="noopener noreferrer"/);
    const download = read("app/api/support/attachments/[ticketId]/[attachmentId]/route.ts");
    expect(download).toMatch(/\/api\/v1\/admin\/support\/tickets\/\$\{ticketId\}\/attachments\/\$\{attachmentId\}/);
    expect(download).toMatch(/NextResponse\.redirect\(url, \{ status: 302/);
    const upload = read("app/api/support/attachments/route.ts");
    expect(upload).toMatch(/sameOrigin\(request\)/);
    expect(upload).toMatch(/\/api\/v1\/admin\/support\/attachments/);
  });

  it("renders customer-authored text as text, never as HTML", () => {
    for (const file of [
      "components/support/SupportTicketWorkspace.tsx",
      "components/support/SupportInbox.tsx",
      "components/support/CannedRepliesManager.tsx",
      "components/support/AttachmentPicker.tsx",
    ]) {
      expect(read(file)).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });

  it("formats durations and relative times for the metrics cards", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(3 * 3_600_000)).toBe("3.0 h");
    expect(formatDuration(72 * 3_600_000)).toBe("3.0 d");
    const now = Date.parse("2026-10-18T12:00:00.000Z");
    expect(formatRelative("2026-10-18T11:59:50.000Z", now)).toBe("just now");
    expect(formatRelative("2026-10-18T11:30:00.000Z", now)).toBe("30m ago");
    expect(formatRelative("2026-10-17T12:00:00.000Z", now)).toBe("1d ago");
    expect(formatRelative(null, now)).toBe("—");
    expect(statusLabel("waiting_on_customer")).toBe("Waiting on customer");
  });
});

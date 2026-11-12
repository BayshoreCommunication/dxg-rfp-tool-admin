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
    expect(workspace).toMatch(/the customer never sees internal notes\./i);
    expect(workspace).toMatch(/mode === "reply"\s*\?\s*await replySupportTicketAction/);
    expect(workspace).toMatch(/: await addSupportNoteAction/);
  });

  it("offers attachments only on customer replies and links them through the signed proxy", () => {
    const workspace = read("components/support/SupportTicketWorkspace.tsx");
    expect(workspace).toMatch(/mode === "reply" && \(\s*<AttachmentPicker[^>]*iconOnly/);
    expect(workspace).toMatch(/mode === "reply" && draftFiles\.length > 0/);
    expect(workspace).toMatch(/supportAttachmentHref\(ticketId, attachment\.id\)/);
    expect(workspace).toMatch(/rel="noopener noreferrer"/);
    const download = read("app/api/support/attachments/[ticketId]/[attachmentId]/route.ts");
    expect(download).toMatch(/\/api\/v1\/admin\/support\/tickets\/\$\{ticketId\}\/attachments\/\$\{attachmentId\}/);
    expect(download).toMatch(/NextResponse\.redirect\(url, \{ status: 302/);
    const upload = read("app/api/support/attachments/route.ts");
    expect(upload).toMatch(/sameOrigin\(request\)/);
    expect(upload).toMatch(/\/api\/v1\/admin\/support\/attachments/);
  });

  it("shows the customer organization beside the ticket number, in the inbox and on the ticket", () => {
    const inbox = read("components/support/SupportInbox.tsx");
    expect(inbox).toMatch(/organizationName\(ticket\.organization\)/);
    expect(inbox).toMatch(/organization: filters\.organization \|\| undefined/);
    expect(inbox).toMatch(/Show every organization/);
    // Against a backend that ignores the filter (no `scope` in the response) the banner says so.
    expect(inbox).toMatch(/organizationFilterApplied = listResult\.ok && listResult\.data\.scope !== undefined/);
    expect(inbox).toMatch(/The organization filter is not available yet/);
    const workspace = read("components/support/SupportTicketWorkspace.tsx");
    expect(workspace).toMatch(/organizationName\(organization \?\? ticket\.organization\)/);
    expect(workspace).toMatch(/organizationInboxHref\(organization \?\? ticket\.organization\)/);
    const page = read("app/(page)/support/page.tsx");
    expect(page).toMatch(/organization: organizationFilter\(single\(params\.organization\)\)/);
    expect(read("components/support/SupportInboxFilters.tsx")).toMatch(/#number, organization, name, or email/);
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

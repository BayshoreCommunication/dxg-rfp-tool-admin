import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eventDates, humanizeKey, humanizeValue, isProposalView, proposalFields, publishedState, sectionFields } from "./proposalLabels";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("admin proposals", () => {
  it("replaces the AI tab with Proposals in the sidebar", () => {
    const navigation = read("config/navigation.tsx");
    expect(navigation).toMatch(/href: "\/proposals"/);
    expect(navigation).not.toMatch(/ai-operations/);
  });

  it("only accepts known status views", () => {
    expect(isProposalView("published")).toBe(true);
    expect(isProposalView("archived")).toBe(true);
    expect(isProposalView("everything")).toBe(false);
    expect(isProposalView(undefined)).toBe(false);
  });

  it("formats event dates from the planner's free text", () => {
    expect(eventDates({ startDate: "2026-11-12", endDate: "2026-11-14" })).toBe("Nov 12, 2026 – Nov 14, 2026");
    expect(eventDates({ startDate: "Spring 2027", endDate: null })).toBe("Spring 2027");
    expect(eventDates({ startDate: null, endDate: null })).toBe("Not set");
  });

  it("shows published proposals as Live or Offline, never the legacy Rejected status", () => {
    expect(publishedState({ isActive: true, status: "submitted" })).toBe("Live");
    expect(publishedState({ isActive: false, status: "submitted" })).toBe("Offline");
    expect(publishedState({ isActive: true, status: "rejected" })).toBe("Offline");
    expect(read("components/proposals/ProposalsDirectory.tsx")).not.toMatch(/Rejected/);
  });

  it("links a client's proposal count to their proposals", () => {
    expect(read("components/clients/ClientDetilas.tsx")).toMatch(/\/proposals\?search=\$\{encodeURIComponent\(client\.email\)\}/);
  });

  it("turns stored form data into readable rows and skips blanks", () => {
    expect(humanizeKey("venueAvContactName")).toBe("Venue AV contact name");
    expect(humanizeValue("CONTRACT_SIGNED")).toBe("Contract signed");
    expect(humanizeValue("NO")).toBe("No");
    expect(humanizeValue("2026-09-15T14:00:00.000Z")).toBe("Sep 15, 2026, 2:00 PM UTC");
    expect(humanizeValue("USD 180,000")).toBe("USD 180,000");
    const rows = proposalFields({
      venueName: "Lakeside Grand",
      venueAddress: "",
      unionJurisdictions: [],
      podiumMic: { podiumMic: "YES", podiumMicQty: "2" },
      evaluationMatrix: { pricing: "17" },
      brandGuideUrl: "https://example.com/brand",
    });
    expect(rows).toEqual([
      { kind: "text", label: "Venue name", value: "Lakeside Grand" },
      { kind: "text", label: "Podium mic", value: "Yes" },
      { kind: "text", label: "Podium mic qty", value: "2" },
      { kind: "text", label: "Evaluation matrix · Pricing", value: "17" },
      { kind: "link", label: "Brand guide URL", value: "https://example.com/brand" },
    ]);
  });

  it("shows each room as its own card titled by its function", () => {
    const [rooms] = sectionFields("roomByRoom", [
      { roomFunction: "Opening General Session", roomLocation: "Ballroom A", roomSetup: "" },
      { roomFunction: "", roomLocation: "" },
    ]);
    expect(rooms).toEqual({
      kind: "group",
      label: "Room by room",
      items: [{ title: "Opening General Session", fields: [
        { kind: "text", label: "Room function", value: "Opening General Session" },
        { kind: "text", label: "Room location", value: "Ballroom A" },
      ] }],
    });
  });
});

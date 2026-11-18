import { readFileSync } from "node:fs";
import { join } from "node:path";

import { formatContentDate } from "./content";
import { TEMPLATE_SECTIONS, UPLOAD_FILE_FIELDS, bareFilename, eventDates, formatDate, humanizeKey, humanizeValue, publishedState, proposalFields, sectionFields, stageLabel, uploadsFields, type ProposalField } from "./proposalFields";

describe("proposal wording", () => {
  it("names the lifecycle stage the planner sees", () => {
    expect(stageLabel({ stage: "receiving_responses" })).toBe("Receiving responses");
    expect(stageLabel({ stage: "under_review" })).toBe("Under review");
    expect(stageLabel({ stage: null, isDraft: true })).toBe("Draft");
    expect(stageLabel({ stage: null, isDraft: false, isArchived: true })).toBe("Archived");
    expect(stageLabel({ stage: "on_hold" })).toBe("On hold");
  });

  it("formats event dates from the planner's free text", () => {
    expect(eventDates({ startDate: "2026-11-12", endDate: "2026-11-14" })).toBe("Nov 12, 2026 – Nov 14, 2026");
    expect(eventDates({ startDate: "Spring 2027", endDate: null })).toBe("Spring 2027");
    expect(eventDates({ startDate: null, endDate: null })).toBe("Not set");
  });

  it("gives a full timestamp as its UTC day and says so, like the other content pages", () => {
    // Just before and just after midnight UTC: the day shown is the UTC one wherever the server runs.
    expect(formatDate("2026-11-17T23:30:00.000Z")).toBe("Nov 17, 2026 UTC");
    expect(formatDate("2026-11-18T00:15:00.000Z")).toBe("Nov 18, 2026 UTC");
    expect(formatDate("2026-11-18T03:00:00+06:00")).toBe("Nov 17, 2026 UTC");
    for (const iso of ["2026-11-17T23:30:00.000Z", "2026-11-18T00:15:00.000Z", "2026-03-01T00:00:00.000Z"]) {
      expect(formatDate(iso)).toBe(formatContentDate(iso));
    }
    // A plain date is a day, not a moment: it is not shifted and carries no zone.
    expect(formatDate("2026-11-18")).toBe("Nov 18, 2026");
    expect(formatDate("Spring 2027")).toBe("Spring 2027");
    expect(formatDate("")).toBeNull();
    expect(formatDate(null)).toBeNull();
    // No other date formatting in the proposal components: all three go through formatDate.
    for (const file of ["ProposalList.tsx", "ProposalDetail.tsx", "VendorResponses.tsx"]) {
      const source = readFileSync(join(process.cwd(), "components/organizations/content", file), "utf8");
      expect({ file, own: /toLocaleDateString|toLocaleTimeString|new Date\(|Intl\.DateTimeFormat/.test(source) }).toEqual({ file, own: false });
      expect(source).toMatch(/\bformatDate\(/);
    }
  });

  it("shows published RFPs as Live or Offline, never the legacy Rejected status", () => {
    expect(publishedState({ isActive: true, status: "submitted" })).toBe("Live");
    expect(publishedState({ isActive: false, status: "submitted" })).toBe("Offline");
    expect(publishedState({ isActive: true, status: "rejected" })).toBe("Offline");
  });

  it("turns stored form data into readable rows and skips blanks", () => {
    expect(humanizeKey("venueAvContactName")).toBe("Venue AV contact name");
    expect(humanizeKey("rfpTimeline")).toBe("Proposal timeline");
    expect(humanizeKey("vendorRfpNotes")).toBe("Vendor proposal notes");
    expect(humanizeKey("relatedRfps")).toBe("Related proposals");
    expect(humanizeValue("RFP_SENT")).toBe("Proposal sent");
    expect(stageLabel({ stage: "rfp_issued" })).toBe("Proposal issued");
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
      // Plain text since the content browser: only the uploads section links an address.
      { kind: "text", label: "Brand guide URL", value: "https://example.com/brand" },
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

describe("Files & references (the uploads allowlist)", () => {
  // The shape the staff proposal route returns (docs/API.md, "Staff access to an organization's content").
  const uploads = () => ({
    brandGuideFiles: ["brand-guide.pdf"],
    eventLogoFiles: ["logo.png", "logo-dark.png"],
    referenceFiles: [],
    venueDocs: ["floor plan.pdf"],
    ndaDocumentFiles: ["nda.docx"],
    scenicInspirationFiles: ["stage.jpg"],
    venueCoiFiles: ["coi.pdf"],
    brandGuideUrl: "https://brand.acme.example/guide",
    referenceUrls: [{ url: "https://example.com/last-year", label: "Last year's show" }, { url: "", label: "" }],
    ndaRequired: true,
    ndaType: "MUTUAL_NDA",
    coVendors: {
      inHouseVenueAv: { companyName: "House AV", contactName: "Sam", contactEmail: "sam@house.example", contactPhone: "", status: "CONFIRMED", notes: "" },
      photographer: { companyName: "", contactName: "" },
    },
  });

  const allFields = (fields: ProposalField[]): ProposalField[] =>
    fields.flatMap((field) => (field.kind === "group" ? [field, ...field.items.flatMap((item) => allFields(item.fields))] : [field]));

  it("shows each file as its name in plain text, one per line", () => {
    const fields = uploadsFields(uploads());
    expect(fields.slice(0, 6)).toEqual([
      { kind: "text", label: "Brand guide files", value: "brand-guide.pdf" },
      { kind: "text", label: "Event logo files", value: "logo.png\nlogo-dark.png" },
      { kind: "text", label: "Venue documents", value: "floor plan.pdf" },
      { kind: "text", label: "NDA document files", value: "nda.docx" },
      { kind: "text", label: "Scenic inspiration files", value: "stage.jpg" },
      { kind: "text", label: "Venue COI files", value: "coi.pdf" },
    ]);
    expect(UPLOAD_FILE_FIELDS.map(([key]) => key)).toEqual(["brandGuideFiles", "eventLogoFiles", "referenceFiles", "venueDocs", "ndaDocumentFiles", "scenicInspirationFiles", "venueCoiFiles"]);
  });

  it("shows what the planner typed: the brand guide address, reference addresses, the NDA and co-vendors", () => {
    expect(uploadsFields(uploads()).slice(6)).toEqual([
      { kind: "link", label: "Brand guide URL", value: "https://brand.acme.example/guide" },
      { kind: "group", label: "Reference URLs", items: [{ title: "Last year's show", fields: [{ kind: "link", label: "URL", value: "https://example.com/last-year" }] }] },
      { kind: "text", label: "NDA required", value: "Yes" },
      { kind: "text", label: "NDA type", value: "Mutual NDA" },
      {
        kind: "group",
        label: "Co-vendors",
        items: [{ title: "In-house venue AV", fields: [
          { kind: "text", label: "Company name", value: "House AV" },
          { kind: "text", label: "Contact name", value: "Sam" },
          { kind: "text", label: "Contact email", value: "sam@house.example" },
          { kind: "text", label: "Status", value: "Confirmed" },
        ] }],
      },
    ]);
    expect(uploadsFields({ brandGuideUrl: "javascript:alert(1)" })).toEqual([{ kind: "text", label: "Brand guide URL", value: "javascript:alert(1)" }]);
  });

  it("never turns a file into a link, even if a stored address came back instead of a name", () => {
    const hostile = {
      brandGuideFiles: ["https://customer-files.example/private/org/1712345-brand.pdf?X-Amz-Signature=abc#frag", "uploads/org/guide v2.pdf", 7, null, { url: "https://x.example/y.pdf" }, "https://x.example/"],
      venueDocs: "https://customer-files.example/venue/plan.pdf?sig=1",
      eventLogoFiles: ["s3://bucket/key/logo.png", "C:\\files\\logo.png", "javascript:alert(1)"],
    };
    const fields = uploadsFields(hostile);
    expect(fields).toEqual([
      { kind: "text", label: "Brand guide files", value: "1712345-brand.pdf\nguide v2.pdf" },
      { kind: "text", label: "Event logo files", value: "logo.png\nlogo.png" },
      { kind: "text", label: "Venue documents", value: "plan.pdf" },
    ]);
    expect(JSON.stringify(fields)).not.toMatch(/https?:|s3:|javascript:|customer-files|X-Amz|sig=|\?|#|uploads\/org/);
    for (const [key] of UPLOAD_FILE_FIELDS) {
      const rows = allFields(uploadsFields({ [key]: ["https://files.example/a/report.pdf?token=1", "plain.pdf"] }));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "text", value: "report.pdf\nplain.pdf" });
    }
    expect(bareFilename("a/b/c.pdf?x=1#y")).toBe("c.pdf");
    expect(bareFilename("https://x.example/")).toBeNull();
    expect(bareFilename("mailto:x")).toBeNull();
    expect(bareFilename(undefined)).toBeNull();
  });

  it("drops every key the allowlist does not name", () => {
    const fields = allFields(uploadsFields({ ...uploads(), supportDocuments: ["https://files.example/secret.pdf"], presignedUrl: "https://files.example/x?sig=1", coVendors: { other: { companyName: "Nope" }, photographer: { companyName: "Lens Co", objectKey: "k/1" } } }));
    expect(JSON.stringify(fields)).not.toMatch(/secret|presigned|sig=|Nope|objectKey|k\/1/);
    expect(JSON.stringify(fields)).toMatch(/Lens Co/);
    expect(uploadsFields("text")).toEqual([]);
    expect(uploadsFields([])).toEqual([]);
    expect(uploadsFields({})).toEqual([]);
  });

  it("is what the proposal page uses for its uploads section", () => {
    expect(sectionFields("uploads", { brandGuideFiles: ["https://files.example/a.pdf"] })).toEqual([{ kind: "text", label: "Brand guide files", value: "a.pdf" }]);
    expect(sectionFields("venue", { venueName: "Lakeside" })).toEqual([{ kind: "text", label: "Venue name", value: "Lakeside" }]);
  });

  it("links nothing in any other section, and shows a file there as its bare name", () => {
    const stored = {
      venueWebsite: "https://venue.example/ballroom",
      floorPlanFiles: ["https://customer-files.example/org/1/floor.pdf?X-Amz-Signature=abc", "uploads/org/1/rigging.pdf"],
      supportDocuments: [{ fileName: "https://customer-files.example/org/1/run-of-show.xlsx?sig=1", url: "https://customer-files.example/k?sig=2", size: 12 }, { url: "https://customer-files.example/org/1/only-url.pdf?sig=3" }, { size: 4 }],
      venueDocs: "s3://bucket/org/1/coi.pdf",
      rooms: [{ roomFunction: "General session", roomFiles: [{ originalName: "plot.pdf", key: "org/1/plot.pdf" }], fileName: "https://customer-files.example/org/1/seating.pdf?sig=4" }],
    };
    for (const section of ["event", "contact", "venueSchedule", "venue", "roomByRoom", "production", "hybridVirtual", "contentCreative", "videoRecordingStep", "budget"]) {
      const rows = allFields(sectionFields(section, stored));
      expect(rows.filter((row) => row.kind === "link")).toEqual([]);
      const text = JSON.stringify(rows);
      expect(text).not.toMatch(/customer-files|X-Amz|sig=|s3:|uploads\/org|org\/1/);
      expect(text).toMatch(/floor\.pdf\\nrigging\.pdf/);
      expect(text).toMatch(/run-of-show\.xlsx\\nonly-url\.pdf/);
      expect(text).toMatch(/coi\.pdf/);
      expect(text).toMatch(/plot\.pdf/);
      // An address the planner typed is still shown, as text.
      expect(rows).toContainEqual({ kind: "text", label: "Venue website", value: "https://venue.example/ballroom" });
    }
    const [rooms] = sectionFields("roomByRoom", stored.rooms);
    expect(rooms).toMatchObject({ kind: "group", items: [{ title: "General session" }] });
    expect(proposalFields({ items: [{ fileName: "https://customer-files.example/a/b.pdf?sig=1", note: "x" }] })).toEqual([
      { kind: "group", label: "Items", items: [{ title: "b.pdf", fields: [{ kind: "text", label: "File name", value: "b.pdf" }, { kind: "text", label: "Note", value: "x" }] }] },
    ]);
  });

  it("shows a template's content sections only: no contact and no files", () => {
    expect(TEMPLATE_SECTIONS.map((section) => section.key)).toEqual(["event", "venueSchedule", "venue", "roomByRoom", "production", "hybridVirtual", "contentCreative", "budget"]);
  });
});

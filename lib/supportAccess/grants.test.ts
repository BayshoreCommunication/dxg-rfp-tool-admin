import {
  ACCESS_NOTICES,
  accessEndedPath,
  formatGrantExpiry,
  formatTimeLeft,
  grantScopeLabel,
  grantedAccessPath,
  isAccessNotice,
  isGrantEndingSoon,
  isSupportAccessId,
  parseGrantBanner,
  parseGrantedAccessList,
  parseGrantedRfpDetail,
  parseGrantedRfpPage,
  parseGrantedVendorResponses,
  supportAccessFailure,
} from "./grants";

const ORG = "6a0000000000000000000001";
const RFP = "6b0000000000000000000002";
const GRANT = "6c0000000000000000000003";
const NOW = Date.parse("2026-11-11T06:00:00.000Z");
const IN_TWO_DAYS = "2026-11-13T06:00:00.000Z";

const grant = (overrides: Record<string, unknown> = {}) => ({
  id: GRANT,
  scope: "organization",
  proposalId: null,
  expiresAt: IN_TWO_DAYS,
  secondsRemaining: 172_800,
  ...overrides,
});

describe("support access grants (ORG-406)", () => {
  it("accepts only lower-case 24-character hex ids, as the backend does", () => {
    expect(isSupportAccessId(ORG)).toBe(true);
    expect(isSupportAccessId(ORG.toUpperCase())).toBe(false);
    expect(isSupportAccessId("6a00")).toBe(false);
    expect(isSupportAccessId(`${ORG}/../x`)).toBe(false);
    expect(isSupportAccessId(undefined)).toBe(false);
  });

  it("lists what is granted to me with organization, scope, expiry and time left", () => {
    const list = parseGrantedAccessList(
      {
        grants: [
          { ...grant(), organization: { id: ORG, name: "Northwind Events" }, rfp: null, reason: "Export fails", createdAt: "2026-11-10T06:00:00.000Z" },
          { ...grant({ id: "6c0000000000000000000004", scope: "rfp", proposalId: RFP }), organization: { id: ORG, name: "" }, rfp: { id: RFP } },
        ],
      },
      NOW,
    );
    expect(list).toEqual([
      {
        id: GRANT, scope: "organization", rfpId: null, expiresAt: IN_TWO_DAYS, secondsRemaining: 172_800,
        organization: { id: ORG, name: "Northwind Events" }, reason: "Export fails", createdAt: "2026-11-10T06:00:00.000Z",
      },
      {
        id: "6c0000000000000000000004", scope: "rfp", rfpId: RFP, expiresAt: IN_TWO_DAYS, secondsRemaining: 172_800,
        organization: { id: ORG, name: null }, reason: null, createdAt: null,
      },
    ]);
    expect(grantedAccessPath(list[0])).toBe(`/support-access/${ORG}`);
    expect(grantedAccessPath(list[1])).toBe(`/support-access/${ORG}/rfps/${RFP}`);
    expect(grantScopeLabel("organization")).toBe("Whole organization");
    expect(grantScopeLabel("rfp")).toBe("One RFP");
  });

  it("drops unreadable rows and grants with no time left instead of guessing", () => {
    const row = { ...grant(), organization: { id: ORG, name: "Northwind" } };
    expect(parseGrantedAccessList(null, NOW)).toEqual([]);
    expect(parseGrantedAccessList({ grants: "nope" }, NOW)).toEqual([]);
    expect(
      parseGrantedAccessList(
        {
          grants: [
            { ...row, id: "not-an-id" },
            { ...row, organization: { id: "../admin", name: "x" } },
            { ...row, organization: null },
            { ...row, expiresAt: "2026-11-11T05:59:59.000Z", secondsRemaining: 0 },
            // A stale count never outlives the expiry instant.
            { ...row, expiresAt: "2026-11-11T05:00:00.000Z", secondsRemaining: 9_999 },
            { ...row, scope: "rfp", proposalId: null, rfp: null },
          ],
        },
        NOW,
      ),
    ).toEqual([]);
  });

  it("never widens a grant that names an RFP to the whole organization", () => {
    expect(parseGrantBanner(grant({ scope: "organization", proposalId: RFP }), NOW)).toMatchObject({ scope: "rfp", rfpId: RFP });
    expect(parseGrantBanner(grant({ scope: "rfp", proposalId: null }), NOW)).toBeNull();
  });

  it("counts time left from the expiry instant, capped by what the server reported", () => {
    expect(parseGrantBanner(grant({ secondsRemaining: 60 }), NOW)?.secondsRemaining).toBe(60);
    expect(parseGrantBanner(grant({ secondsRemaining: 999_999 }), NOW)?.secondsRemaining).toBe(172_800);
    expect(parseGrantBanner(grant({ secondsRemaining: undefined }), NOW)?.secondsRemaining).toBe(172_800);
    expect(parseGrantBanner(grant({ expiresAt: "soon", secondsRemaining: -5 }), NOW)).toMatchObject({ expiresAt: null, secondsRemaining: 0 });
  });

  it("reads an RFP list only together with the grant it was read under", () => {
    const rfps = [
      { id: RFP, eventName: "Annual Summit", status: "submitted", stage: "sent", isDraft: false, isArchived: false, startDate: "2026-12-01", endDate: null, createdAt: null, updatedAt: null, owner: { id: "u1", name: "Pat Planner", email: "pat@example.com" } },
      { id: "bad id", eventName: "Skipped" },
    ];
    expect(parseGrantedRfpPage({ grants: [], rfps, pagination: {} }, NOW)).toBeNull();
    expect(parseGrantedRfpPage({ grants: [grant()] }, NOW)).toBeNull();
    const page = parseGrantedRfpPage({ grants: [grant()], rfps, pagination: { page: 2, perPage: 20, total: 21, totalPages: 2 } }, NOW);
    expect(page?.rfps).toHaveLength(1);
    expect(page?.rfps[0]).toMatchObject({ id: RFP, eventName: "Annual Summit", stage: "sent", owner: { name: "Pat Planner" } });
    expect(page?.pagination).toEqual({ page: 2, perPage: 20, total: 21, totalPages: 2 });
    expect(page?.grants[0].scope).toBe("organization");
  });

  it("reads an RFP and its vendor responses only with their grant", () => {
    expect(parseGrantedRfpDetail({ rfp: { id: RFP }, owner: null }, NOW)).toBeNull();
    expect(parseGrantedRfpDetail({ grant: grant(), rfp: { id: "x" } }, NOW)).toBeNull();
    expect(parseGrantedRfpDetail({ grant: grant(), rfp: { id: RFP, event: { eventName: "Summit" } }, owner: null }, NOW)).toMatchObject({
      grant: { id: GRANT },
      rfp: { id: RFP },
      owner: null,
    });
    expect(parseGrantedVendorResponses({ vendorResponses: [] }, NOW)).toBeNull();
    expect(
      parseGrantedVendorResponses(
        { grant: grant(), vendorResponses: [{ id: "v1", vendorName: "Stagecraft AV", documentCount: 2, currentVersionNumber: 1, documents: [{ url: "https://files.example/x" }] }, null] },
        NOW,
      )?.vendorResponses,
    ).toEqual([
      { id: "v1", vendorName: "Stagecraft AV", submittedBy: null, email: null, message: null, documentCount: 2, currentVersionNumber: 1, createdAt: null, updatedAt: null },
    ]);
  });

  it("turns refusals into screen states: no grant goes back to the list, an uncovered RFP is not found", () => {
    expect(supportAccessFailure(403, "SUPPORT_GRANT_REQUIRED")).toBe("grant_required");
    expect(supportAccessFailure(404, "PROPOSAL_NOT_FOUND")).toBe("not_found");
    expect(supportAccessFailure(404, null)).toBe("not_found");
    expect(supportAccessFailure(403, "SUPPORT_ACCESS_FORBIDDEN")).toBe("error");
    expect(supportAccessFailure(500, "SUPPORT_ACCESS_INTERNAL_ERROR")).toBe("error");
    expect(accessEndedPath()).toBe("/support-access?notice=ended");
    expect(isAccessNotice("ended")).toBe(true);
    expect(isAccessNotice("toString")).toBe(false);
    expect(isAccessNotice("<script>")).toBe(false);
    expect(ACCESS_NOTICES.ended).toMatch(/ended or was revoked/);
  });

  it("says how long is left in plain words", () => {
    expect(formatTimeLeft(6 * 86_400 + 4 * 3_600 + 59)).toBe("6 days 4 hours");
    expect(formatTimeLeft(86_400)).toBe("1 day");
    expect(formatTimeLeft(3 * 3_600 + 12 * 60)).toBe("3 hours 12 minutes");
    expect(formatTimeLeft(61)).toBe("1 minute");
    expect(formatTimeLeft(45)).toBe("45 seconds");
    expect(formatTimeLeft(0)).toBe("Ended");
    expect(formatTimeLeft(Number.NaN)).toBe("Ended");
    expect(isGrantEndingSoon(3_600)).toBe(true);
    expect(isGrantEndingSoon(3_601)).toBe(false);
    expect(isGrantEndingSoon(0)).toBe(false);
    expect(formatGrantExpiry(IN_TWO_DAYS)).toBe("Nov 13, 2026, 6:00 AM UTC");
    expect(formatGrantExpiry(null)).toBe("Unknown");
  });
});

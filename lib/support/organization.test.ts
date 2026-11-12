import { organizationFilter, organizationInboxHref, organizationName } from "./organization";

const BAYSHORE = "6af570293393d07387d6e684";

describe("ticket organization labels", () => {
  it("names the organization, or nothing when the backend sends none", () => {
    expect(organizationName({ id: BAYSHORE, name: " Bayshore Communication " })).toBe("Bayshore Communication");
    expect(organizationName({ id: BAYSHORE, name: null })).toBeNull();
    expect(organizationName({ id: BAYSHORE, name: "   " })).toBeNull();
    expect(organizationName(null)).toBeNull();
    expect(organizationName(undefined)).toBeNull();
  });

  it("links to one organization's tickets only for a real organization id", () => {
    expect(organizationInboxHref({ id: BAYSHORE, name: "Bayshore Communication" })).toBe(`/support?status=all&organization=${BAYSHORE}`);
    expect(organizationInboxHref({ id: "../clients", name: "x" })).toBeNull();
    expect(organizationInboxHref(undefined)).toBeNull();
  });

  it("drops a malformed organization filter instead of sending it", () => {
    expect(organizationFilter(BAYSHORE)).toBe(BAYSHORE);
    expect(organizationFilter(` ${BAYSHORE} `)).toBe(BAYSHORE);
    expect(organizationFilter("bayshore")).toBe("");
    expect(organizationFilter(undefined)).toBe("");
  });
});

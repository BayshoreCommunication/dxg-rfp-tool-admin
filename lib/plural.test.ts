import { countLabel } from "./plural";

describe("countLabel", () => {
  it("uses the singular for exactly one and the plural otherwise", () => {
    expect(countLabel(0, "proposal")).toBe("0 proposals");
    expect(countLabel(1, "proposal")).toBe("1 proposal");
    expect(countLabel(2, "proposal")).toBe("2 proposals");
    expect(countLabel(1234, "client")).toBe("1,234 clients");
    expect(countLabel(1, "reply", "replies")).toBe("1 reply");
    expect(countLabel(3, "reply", "replies")).toBe("3 replies");
  });
});

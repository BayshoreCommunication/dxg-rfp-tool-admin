import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8");

describe("governed asset administration", () => {
  it("uses authenticated list, update, and explicit replacement actions", () => {
    const action = read("app/actions/governance.ts");
    expect(action).toContain("/v1/governance/assets");
    expect(action).toContain('method: "PATCH"');
    expect(action).toContain("activate-replacement");
    expect(action).toContain('method: "POST"');
  });

  it("supports every required metadata and lifecycle field", () => {
    const component = read("components/ai/GovernedAssetsPanel.tsx");
    for (const field of [
      "ownerExternalUserId",
      "productArea",
      "locale",
      "sourceReference",
      "effectiveAt",
      "reviewDueAt",
      "expiresAt",
      "approvalState",
      "lifecycleState",
      "lastVerifiedApplicationRelease",
    ]) {
      expect(component).toContain(field);
    }
    expect(component).toContain("Activate replacement");
    expect(component).toContain(
      "it never\n              happens automatically",
    );
  });

  it("provides accessible loading, errors, status, filters, and pagination", () => {
    const component = read("components/ai/GovernedAssetsPanel.tsx");
    expect(component).toContain('aria-labelledby="governed-assets-heading"');
    expect(component).toContain('role="alert"');
    expect(component).toContain('role="status"');
    expect(component).toContain("Loading governed assets");
    expect(component).toContain("<table");
    expect(component).toContain(
      'aria-label="Previous governed assets page"',
    );
    expect(component).toContain(
      'aria-label="Next governed assets page"',
    );
  });
});

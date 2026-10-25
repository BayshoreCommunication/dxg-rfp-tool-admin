import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8");

describe("Onboarding funnel administration", () => {
  it("loads the aggregate funnel endpoint with only the page's date window", () => {
    const action = read("app/actions/aiOperations.ts");
    expect(action).toContain("/dashboard/onboarding-funnel");
    expect(action).toContain("qualityQuery({ from: filters.from, to: filters.to })");
    expect(action).toContain("Onboarding funnel data is unavailable.");
    expect(action).toContain("funnel: funnel.status === \"fulfilled\" ? funnel.value : null");
  });

  it("shows both milestones as a within-window share and as time from account start", () => {
    const component = read("components/ai/OnboardingFunnelSection.tsx");
    for (const text of [
      "Onboarding funnel",
      "Accounts started",
      "Matured",
      "Not yet matured",
      "First message sent",
      "First draft generated",
      "Reached at any time",
      "Median time",
      "90th percentile",
      "Sample protected",
      "Aggregate only",
    ]) {
      expect(component).toContain(text);
    }
    // Protected values render as a word, never as a misleading zero.
    expect(component).toMatch(/value === null \? "Protected"/);
    expect(component).toContain("legacyExcluded");
  });

  it("is mounted on the AI Operations page beside Assistant Quality", () => {
    const page = read("components/ai/AiOperationsPage.tsx");
    expect(page).toContain("<OnboardingFunnelSection report={funnel} />");
  });
});

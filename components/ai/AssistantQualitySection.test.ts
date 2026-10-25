import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8");

describe("Assistant Quality administration", () => {
  it("loads the aggregate quality endpoint with every approved filter", () => {
    const action = read("app/actions/aiOperations.ts");
    expect(action).toContain("/v1/ai/assistant-quality");
    for (const filter of [
      "from",
      "to",
      "organizationCohort",
      "model",
      "promptVersion",
      "intent",
      "findingCategory",
    ]) {
      expect(action).toContain(filter);
    }
    expect(action).toContain("Assistant Quality data is unavailable.");
  });

  it("shows protected quality, latency, cost, and comparison views without knowledge or pricing", () => {
    const component = read(
      "components/ai/AssistantQualitySection.tsx",
    );
    for (const text of [
      "Eligible sessions",
      "Resolved-session rate",
      "Helpful rate",
      "Completion / error",
      "Clarification / abstention",
      "Citation usage / validity",
      "First token p50 / p95",
      "Completion p50 / p95",
      "Estimated cost",
      "Top intents",
      "Lowest-performing intents",
      "Model comparison",
      "Prompt-version comparison",
      "Negative feedback",
      "Finding categories",
    ]) {
      expect(component).toContain(text);
    }
    for (const removed of [
      "knowledgeVersion",
      "Knowledge-version comparison",
      "Rule / pricing-version comparison",
      "Governance attention",
      "Missing approved prices",
    ]) {
      expect(component).not.toContain(removed);
    }
    expect(component).toContain("Samples below");
    expect(component).toContain("Raw conversations and direct identifiers");
  });

  it("uses a native GET form, labels, tables, loading state, and reset path", () => {
    const component = read(
      "components/ai/AssistantQualitySection.tsx",
    );
    expect(component).toContain('method="get"');
    expect(component).toContain('aria-label="Assistant Quality filters"');
    expect(component).toContain("<label");
    expect(component).toContain("<table");
    expect(component).toContain('role="status"');
    expect(component).toContain('href="/ai-operations"');
  });
});

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
      "knowledgeVersion",
      "intent",
      "findingCategory",
    ]) {
      expect(action).toContain(filter);
    }
    expect(action).toContain("Assistant Quality data is unavailable.");
  });

  it("shows required protected quality, latency, cost, comparison, and governance views", () => {
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
      "Knowledge-version comparison",
      "Rule / pricing-version comparison",
      "Negative feedback",
      "Finding categories",
      "Expiring knowledge",
      "Stale or retired rules",
      "Missing approved prices",
    ]) {
      expect(component).toContain(text);
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

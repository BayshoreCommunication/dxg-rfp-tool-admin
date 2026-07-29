import AiOperationsPage from "@/components/ai/AiOperationsPage";
import type { AssistantQualityFilters } from "@/app/actions/aiOperations";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

const first = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const qualityFilters: AssistantQualityFilters = {
    from: first(query.from),
    to: first(query.to),
    organizationCohort: first(query.organizationCohort),
    model: first(query.model),
    promptVersion: first(query.promptVersion),
    knowledgeVersion: first(query.knowledgeVersion),
    intent: first(query.intent),
    findingCategory: first(query.findingCategory),
  };
  return <AiOperationsPage qualityFilters={qualityFilters} />;
}

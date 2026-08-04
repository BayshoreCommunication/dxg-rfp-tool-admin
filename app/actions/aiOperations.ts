"use server";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import type { LiveAiPilotStatus } from "./liveAiPilot";

export type AiUsageDaily = {
  day: string;
  provider: string;
  model: string;
  state: string;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
};

export type AiUsageTotal = {
  provider: string;
  attempts: number;
  succeeded: number;
  failedOrOrphaned: number;
  inputTokens: number;
  outputTokens: number;
};

export type AiOperationUsage = {
  runType: string;
  operation: string;
  state: string;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
};

export type AiProviderAttempt = {
  id: string;
  runType: string;
  runId: string;
  attemptNumber: number;
  state: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiUsageReport = {
  windowDays: number;
  daily: AiUsageDaily[];
  totals: AiUsageTotal[];
  operations: AiOperationUsage[];
  recentAttempts: AiProviderAttempt[];
  operationsAvailable: boolean;
  recentAttemptsAvailable: boolean;
  note: string;
};

export type AiGatewayRun = {
  id: string;
  operation: string;
  purpose: string;
  classification: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  latencyMs: number | null;
  finishReason: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AiOperationsData = {
  status: LiveAiPilotStatus | null;
  usage: AiUsageReport | null;
  runs: AiGatewayRun[];
  quality: AssistantQualityReport | null;
  errors: string[];
};

export type AssistantQualityFilters = {
  from?: string;
  to?: string;
  organizationCohort?: string;
  model?: string;
  promptVersion?: string;
  knowledgeVersion?: string;
  intent?: string;
  findingCategory?: string;
};

export type AssistantQualityBreakdown = {
  dimension: string;
  submitted: number;
  completed: number;
  failed: number;
  helpful: number;
  feedbackTotal: number;
  completionRate: number | null;
  helpfulRate: number | null;
};

export type AssistantQualityReport = {
  schemaVersion: "assistant-quality-report.v1";
  generatedAt: string;
  window: { from: string; to: string; days: number };
  privacy: {
    minimumSampleSize: number;
    sampleProtected: boolean;
    conversationsIncluded: false;
    directIdentifiersIncluded: false;
  };
  summary: {
    eligibleSessions: number | null;
    resolvedSessions: number | null;
    resolvedSessionRate: number | null;
    helpfulRate: number | null;
    completionRate: number | null;
    errorRate: number | null;
    retryRate: number | null;
    clarificationRate: number | null;
    abstentionRate: number | null;
    citationUsageRate: number | null;
    citationValidityRate: number | null;
    p50FirstTokenMs: number | null;
    p95FirstTokenMs: number | null;
    p50CompletionMs: number | null;
    p95CompletionMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    estimatedCostMicros: number | null;
  };
  breakdowns: {
    intents: AssistantQualityBreakdown[];
    models: AssistantQualityBreakdown[];
    promptVersions: AssistantQualityBreakdown[];
    knowledgeVersions: AssistantQualityBreakdown[];
    ruleVersions: AssistantQualityBreakdown[];
    pricingVersions: AssistantQualityBreakdown[];
    negativeFeedback: Array<{ dimension: string; count: number }>;
    findingCategories: Array<{ dimension: string; count: number }>;
  };
  governance: {
    expiringKnowledge: Array<{
      releaseNumber: number;
      state: string;
      condition: string;
      expiresAt: string;
    }>;
    staleOrRetiredRules: Array<{
      ruleKey: string;
      status: string;
      condition: string;
      updatedAt: string;
    }>;
    unavailableApprovedPriceCategories: string[];
  };
};

const base = BACKEND_URL.endsWith("/api") ? BACKEND_URL : `${BACKEND_URL}/api`;

const read = async <T,>(path: string): Promise<T> => {
  const response = await authenticatedBackendFetch(`${base}${path}`, {
    cache: "no-store",
    headers: {
      "X-Correlation-ID": crypto.randomUUID(),
    },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const body = (await response.json()) as { data: T };
  return body.data;
};

const normalizeUsageReport = (
  report: Partial<AiUsageReport> | null | undefined,
): AiUsageReport => ({
  windowDays:
    typeof report?.windowDays === "number" ? report.windowDays : 30,
  daily: Array.isArray(report?.daily) ? report.daily : [],
  totals: Array.isArray(report?.totals) ? report.totals : [],
  operations: Array.isArray(report?.operations) ? report.operations : [],
  recentAttempts: Array.isArray(report?.recentAttempts)
    ? report.recentAttempts
    : [],
  operationsAvailable: Array.isArray(report?.operations),
  recentAttemptsAvailable: Array.isArray(report?.recentAttempts),
  note: typeof report?.note === "string" ? report.note : "",
});

const qualityQuery = (filters: AssistantQualityFilters) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      query.set(key, value.trim());
    }
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
};

export const getAiOperationsData = async (
  filters: AssistantQualityFilters = {},
): Promise<AiOperationsData> => {
  const [status, usage, runs, quality] = await Promise.allSettled([
    read<LiveAiPilotStatus>("/v1/ai/pilot/status"),
    read<AiUsageReport>("/v1/ai/usage-report?days=30"),
    read<AiGatewayRun[]>("/v1/ai/runs?limit=50"),
    read<AssistantQualityReport>(
      `/v1/ai/assistant-quality${qualityQuery(filters)}`,
    ),
  ]);

  const errors: string[] = [];
  if (status.status === "rejected") errors.push("Runtime status is unavailable.");
  if (usage.status === "rejected") errors.push("Provider usage is unavailable.");
  if (runs.status === "rejected") errors.push("Gateway run history is unavailable.");
  if (quality.status === "rejected") {
    errors.push("Assistant Quality data is unavailable.");
  }

  return {
    status: status.status === "fulfilled" ? status.value : null,
    usage:
      usage.status === "fulfilled"
        ? normalizeUsageReport(usage.value)
        : null,
    runs:
      runs.status === "fulfilled" && Array.isArray(runs.value)
        ? runs.value
        : [],
    quality: quality.status === "fulfilled" ? quality.value : null,
    errors,
  };
};

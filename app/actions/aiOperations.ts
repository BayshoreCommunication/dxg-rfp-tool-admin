"use server";

import { BACKEND_URL } from "@/lib/config";
import { getBackendAccessToken } from "@/lib/server/backendSession";
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
  errors: string[];
};

const base = BACKEND_URL.endsWith("/api") ? BACKEND_URL : `${BACKEND_URL}/api`;

const read = async <T,>(path: string, token: string): Promise<T> => {
  const response = await fetch(`${base}${path}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
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

export const getAiOperationsData = async (): Promise<AiOperationsData> => {
  const token = await getBackendAccessToken();
  if (!token) return { status: null, usage: null, runs: [], errors: ["Your admin session has expired."] };

  const [status, usage, runs] = await Promise.allSettled([
    read<LiveAiPilotStatus>("/v1/ai/pilot/status", token),
    read<AiUsageReport>("/v1/ai/usage-report?days=30", token),
    read<AiGatewayRun[]>("/v1/ai/runs?limit=50", token),
  ]);

  const errors: string[] = [];
  if (status.status === "rejected") errors.push("Runtime status is unavailable.");
  if (usage.status === "rejected") errors.push("Provider usage is unavailable.");
  if (runs.status === "rejected") errors.push("Gateway run history is unavailable.");

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
    errors,
  };
};

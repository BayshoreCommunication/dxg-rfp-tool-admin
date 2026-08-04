"use server";
import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

export type Result<T> =
  | { success: true; data: T; correlationId: string }
  | { success: false; message: string; code: string; correlationId: string };

export type PricingRecordStatus = "draft" | "approved" | "retired";
export type ExpertRuleStatus = "draft" | "active" | "retired";

export type PricingRecord = {
  id: string;
  category: string;
  itemLabel: string;
  unit: string;
  amountLowMinor: number;
  amountMidMinor: number;
  amountHighMinor: number;
  currency: string;
  market: string | null;
  dayType: string;
  laborRole: string | null;
  sourceFragmentId: string | null;
  sourceNote: string;
  status: PricingRecordStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type RuleCondition = { path: string; op: string; value: string | number | boolean | null };
export type RuleEffect = {
  kind: "recommendation" | "cost_factor" | "ancillary_flag";
  category: string | null;
  guidanceText: string;
  factorPercent: number | null;
};
export type ExpertRule = {
  id: string;
  ruleKey: string;
  title: string;
  explanation: string;
  conditions: RuleCondition[];
  effect: RuleEffect;
  status: ExpertRuleStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

const friendlyMessages: Record<string, string> = {
  PRICING_DISABLED: "The pricing knowledge base is not enabled in this environment.",
  PRICING_RECORD_NOT_EDITABLE: "Only draft pricing records can be edited. Approved and retired records are locked.",
  PRICING_RECORD_NOT_DELETABLE: "Only retired pricing records can be permanently deleted.",
  EXPERT_RULE_NOT_EDITABLE: "Only draft expert rules can be edited. Active and retired rules are locked.",
  REVISION_CONFLICT: "This item was changed by someone else since you loaded it. Refresh the list and try again.",
  RULE_KEY_IMMUTABLE: "The rule key cannot be changed after a rule is created.",
  PRICING_RECORD_NOT_FOUND: "This pricing record no longer exists.",
  EXPERT_RULE_NOT_FOUND: "This expert rule no longer exists.",
  AUTHORIZATION_DENIED: "You do not have permission to perform this action.",
};

const base = BACKEND_URL.endsWith("/api") ? BACKEND_URL : `${BACKEND_URL}/api`;

const record = (value: unknown): PricingRecord | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.itemLabel === "string" && typeof item.status === "string"
    ? (item as PricingRecord)
    : null;
};
const rule = (value: unknown): ExpertRule | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.ruleKey === "string" && typeof item.status === "string"
    ? ({ ...item, conditions: Array.isArray(item.conditions) ? item.conditions : [] } as ExpertRule)
    : null;
};
const listOf = <T,>(parse: (value: unknown) => T | null) => (value: unknown): T[] | null =>
  Array.isArray(value) ? value.map(parse).filter((item): item is T => Boolean(item)) : null;

const call = async <T,>(path: string, init?: RequestInit, parse?: (value: unknown) => T | null): Promise<Result<T>> => {
  const correlationId = crypto.randomUUID();
  try {
    const response = await authenticatedBackendFetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "X-Correlation-ID": correlationId, ...(init?.headers || {}) },
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const code = typeof body.code === "string" ? body.code : `HTTP_${response.status}`;
      return {
        success: false,
        message:
          friendlyMessages[code] ??
          (typeof body.message === "string" ? body.message : typeof body.title === "string" ? body.title : "The operation could not be completed safely."),
        code,
        correlationId: response.headers.get("x-correlation-id") || correlationId,
      };
    }
    const data = parse ? parse(body.data) : (body.data as T);
    return data == null
      ? { success: false, message: "The service returned an unexpected response.", code: "INVALID_RESPONSE", correlationId }
      : { success: true, data, correlationId };
  } catch {
    return { success: false, message: "The service could not be reached.", code: "NETWORK_ERROR", correlationId };
  }
};

const query = (filters: Record<string, string | undefined>) => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) if (value) params.set(name, value);
  const text = params.toString();
  return text ? `?${text}` : "";
};

const json = (value: unknown, headers?: Record<string, string>): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...(headers || {}) },
  body: JSON.stringify(value),
});

export const listPricingRecordsAction = async (filters: { status?: string; category?: string } = {}) =>
  call<PricingRecord[]>(`/v1/knowledge/pricing-records${query(filters)}`, undefined, listOf(record));

export const createPricingRecordAction = async (input: Record<string, unknown>) =>
  call<PricingRecord>("/v1/knowledge/pricing-records", json(input), record);

export const updatePricingRecordAction = async (recordId: string, input: Record<string, unknown>, expectedRevision: number) =>
  call<PricingRecord>(
    `/v1/knowledge/pricing-records/${encodeURIComponent(recordId)}`,
    { ...json({ ...input, expectedRevision }), method: "PUT" },
    record,
  );

export const setPricingRecordStatusAction = async (recordId: string, status: "draft" | "approved" | "retired") =>
  call<PricingRecord>(`/v1/knowledge/pricing-records/${encodeURIComponent(recordId)}/status`, json({ status }), record);

export const deletePricingRecordAction = async (recordId: string) =>
  call<{ id: string; deleted: boolean }>(
    `/v1/knowledge/pricing-records/${encodeURIComponent(recordId)}`,
    { method: "DELETE" },
  );

export const listExpertRulesAction = async (filters: { status?: string } = {}) =>
  call<ExpertRule[]>(`/v1/knowledge/expert-rules${query(filters)}`, undefined, listOf(rule));

export const createExpertRuleAction = async (input: Record<string, unknown>) =>
  call<ExpertRule>("/v1/knowledge/expert-rules", json(input), rule);

export const updateExpertRuleAction = async (ruleId: string, input: Record<string, unknown>, expectedRevision: number) =>
  call<ExpertRule>(
    `/v1/knowledge/expert-rules/${encodeURIComponent(ruleId)}`,
    { ...json({ ...input, expectedRevision }), method: "PUT" },
    rule,
  );

export const setExpertRuleStatusAction = async (ruleId: string, status: "active" | "retired") =>
  call<ExpertRule>(`/v1/knowledge/expert-rules/${encodeURIComponent(ruleId)}/status`, json({ status }), rule);

"use server";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

export type GovernedAsset = {
  id: string;
  assetType: string;
  assetId: string;
  ownerExternalUserId: string;
  productArea: string;
  locale: string;
  sourceReference: string;
  effectiveAt: string;
  reviewDueAt: string;
  expiresAt: string | null;
  approvalState: "draft" | "approved" | "revoked";
  lifecycleState: "active" | "retired";
  lastVerifiedApplicationRelease: string;
  replacementAssetId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type GovernedAssetPage = {
  items: GovernedAsset[];
  total: number;
  limit: number;
  offset: number;
};

export type GovernanceResult<T> =
  | { success: true; data: T; correlationId: string }
  | {
      success: false;
      message: string;
      code: string;
      correlationId: string;
    };

const base = BACKEND_URL.endsWith("/api")
  ? BACKEND_URL
  : `${BACKEND_URL}/api`;

const call = async <T,>(
  path: string,
  init?: RequestInit,
): Promise<GovernanceResult<T>> => {
  const correlationId = crypto.randomUUID();
  try {
    const response = await authenticatedBackendFetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "X-Correlation-ID": correlationId,
        ...(init?.headers || {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const responseCorrelation =
      response.headers.get("x-correlation-id") || correlationId;
    if (!response.ok) {
      return {
        success: false,
        message:
          typeof body.title === "string"
            ? body.title
            : "The governance operation could not be completed.",
        code:
          typeof body.code === "string"
            ? body.code
            : `HTTP_${response.status}`,
        correlationId: responseCorrelation,
      };
    }
    return {
      success: true,
      data: body.data as T,
      correlationId: responseCorrelation,
    };
  } catch {
    return {
      success: false,
      message: "The governance service could not be reached.",
      code: "NETWORK_ERROR",
      correlationId,
    };
  }
};

const query = (filters: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([name, value]) => {
    if (value !== undefined && value !== "") {
      params.set(name, String(value));
    }
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
};

export const listGovernedAssetsAction = async (
  filters: {
    assetType?: string;
    approvalState?: string;
    lifecycleState?: string;
    dueWithinDays?: number;
    limit?: number;
    offset?: number;
  } = {},
) =>
  call<GovernedAssetPage>(
    `/v1/governance/assets${query(filters)}`,
  );

export const updateGovernedAssetAction = async (
  governedAssetId: string,
  input: Record<string, unknown>,
) =>
  call<GovernedAsset>(
    `/v1/governance/assets/${encodeURIComponent(governedAssetId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

export const activateGovernedAssetReplacementAction = async (
  governedAssetId: string,
  input: {
    replacementGovernedAssetId: string;
    expectedRevision: number;
    replacementExpectedRevision: number;
  },
) =>
  call<{
    retired: GovernedAsset;
    activeReplacement: GovernedAsset;
  }>(
    `/v1/governance/assets/${encodeURIComponent(governedAssetId)}/activate-replacement`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

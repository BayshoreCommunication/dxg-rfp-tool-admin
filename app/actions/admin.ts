"use server";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

export interface AdminOverviewData {
  totals: {
    totalProposals: number;
    totalEmailSent: number;
    totalClick: number;
  };
}

const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/* Only the three totals the dashboard shows leave this action. The backend's overview also
   carries customer accounts (`latestClients`: names, emails, companies) and `totalClients`;
   the result is built field by field so neither can reach a caller. */
const overviewOf = (data: unknown): AdminOverviewData | null => {
  if (typeof data !== "object" || data === null) return null;
  const totals = (data as { totals?: unknown }).totals;
  const source = typeof totals === "object" && totals !== null ? (totals as Record<string, unknown>) : {};
  return {
    totals: {
      totalProposals: count(source.totalProposals),
      totalEmailSent: count(source.totalEmailSent),
      totalClick: count(source.totalClick),
    },
  };
};

export async function getAdminOverviewAction(): Promise<{
  ok: boolean;
  error?: string;
  data: AdminOverviewData | null;
}> {
  try {
    const response = await authenticatedBackendFetch(
      `${BACKEND_URL}/api/admin/overview`,
      {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      },
    );

    const result = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: result?.message || "Failed to fetch admin overview.",
        data: null,
      };
    }

    return {
      ok: true,
      data: overviewOf(result?.data),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      data: null,
    };
  }
}

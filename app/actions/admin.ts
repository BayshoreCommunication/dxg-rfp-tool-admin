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
      data: (result?.data as AdminOverviewData) || null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      data: null,
    };
  }
}

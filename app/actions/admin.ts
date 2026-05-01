"use server";

import { auth } from "@/auth";

import { BACKEND_URL } from "@/lib/config";

export interface AdminOverviewClient {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  totalProposals: number;
  totalEmailSent: number;
}

export interface AdminOverviewData {
  totals: {
    totalClients: number;
    totalProposals: number;
    totalEmailSent: number;
    totalClick: number;
  };
  latestClients: AdminOverviewClient[];
}

export async function getAdminOverviewAction(): Promise<{
  ok: boolean;
  error?: string;
  data: AdminOverviewData | null;
}> {
  const session = await auth();
  const accessToken = session?.user?.accessToken;

  if (!accessToken) {
    return { ok: false, error: "User is not authenticated.", data: null };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/overview`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

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

"use server";

import { revalidatePath } from "next/cache";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

export interface AllClientItem {
  id: string;
  name: string;
  email: string;
  company?: string;
  joinDate: string;
  totalProposals: number;
  totalEmailSent: number;
  isBlocked: boolean;
}

export interface AllClientsResponse {
  success: boolean;
  message?: string;
  data: AllClientItem[];
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters?: {
    search?: string;
  };
}

export async function getAllClientsAction(
  search: string = "",
  page: number = 1,
): Promise<{
  ok: boolean;
  error?: string;
  data: AllClientsResponse | null;
}> {
  try {
    const query = new URLSearchParams({
      search: search.trim(),
      page: String(Math.max(1, page)),
    }).toString();

    const response = await authenticatedBackendFetch(
      `${BACKEND_URL}/api/all-clients?${query}`,
      {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      },
    );

    const result = (await response.json()) as AllClientsResponse;

    if (!response.ok) {
      return {
        ok: false,
        error: result?.message || "Failed to fetch clients.",
        data: null,
      };
    }

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      data: null,
    };
  }
}

export async function blockClientAction(
  clientId: string,
  isBlocked: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await authenticatedBackendFetch(
      `${BACKEND_URL}/api/all-clients/${clientId}/block`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isBlocked }),
        cache: "no-store",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: result?.message || "Failed to update client status.",
      };
    }

    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function deleteClientAction(
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await authenticatedBackendFetch(
      `${BACKEND_URL}/api/all-clients/${clientId}`,
      {
        method: "DELETE",
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
        error: result?.message || "Failed to delete client.",
      };
    }

    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

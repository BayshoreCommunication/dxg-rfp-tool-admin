"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export interface AllClientItem {
  id: string;
  name: string;
  email: string;
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
  const session = await auth();
  const accessToken = session?.user?.accessToken;

  if (!accessToken) {
    return {
      ok: false,
      error: "User is not authenticated.",
      data: null,
    };
  }

  try {
    const query = new URLSearchParams({
      search: search.trim(),
      page: String(Math.max(1, page)),
    }).toString();

    const response = await fetch(`${BACKEND_URL}/api/all-clients?${query}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

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
  const session = await auth();
  const accessToken = session?.user?.accessToken;

  if (!accessToken) {
    return { ok: false, error: "User is not authenticated." };
  }

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/all-clients/${clientId}/block`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
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

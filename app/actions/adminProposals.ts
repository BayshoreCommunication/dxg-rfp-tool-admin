"use server";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

export type AdminProposalView = "all" | "draft" | "published" | "archived";

export interface AdminProposalItem {
  id: string;
  eventName: string;
  status: "unsubmitted" | "submitted" | "reviewed" | "approved" | "rejected" | string;
  isDraft: boolean;
  isActive: boolean;
  isArchived: boolean;
  isCopy: boolean;
  viewsCount: number;
  startDate: string | null;
  endDate: string | null;
  attendees: string | null;
  eventFormat: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  planner: { id: string; name: string | null; email: string | null; company: string | null } | null;
}

export interface AdminProposalsResponse {
  success: boolean;
  message?: string;
  data: AdminProposalItem[];
  counts?: Record<AdminProposalView, number>;
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters?: { search?: string; view?: AdminProposalView };
}

export async function getAdminProposalsAction(
  search: string = "",
  page: number = 1,
  view: AdminProposalView = "all",
): Promise<{ ok: boolean; error?: string; data: AdminProposalsResponse | null }> {
  try {
    const query = new URLSearchParams({
      search: search.trim(),
      page: String(Math.max(1, page)),
      view,
    }).toString();

    const response = await authenticatedBackendFetch(`${BACKEND_URL}/api/admin/proposals?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const result = (await response.json()) as AdminProposalsResponse;

    if (!response.ok) {
      return { ok: false, error: result?.message || "Failed to fetch proposals.", data: null };
    }

    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      data: null,
    };
  }
}

export interface AdminProposalDetail {
  proposal: Record<string, unknown> & {
    id: string;
    status?: string;
    isDraft?: boolean;
    isActive?: boolean;
    isArchived?: boolean;
    isCopy?: boolean;
    viewsCount?: number;
    version?: number;
    createdAt?: string;
    updatedAt?: string;
    event?: Record<string, unknown> & { eventName?: string };
  };
  planner: AdminProposalItem["planner"];
}

export async function getAdminProposalAction(
  id: string,
): Promise<{ ok: boolean; notFound?: boolean; error?: string; data: AdminProposalDetail | null }> {
  try {
    const response = await authenticatedBackendFetch(
      `${BACKEND_URL}/api/admin/proposals/${encodeURIComponent(id)}`,
      { method: "GET", headers: { "Content-Type": "application/json" }, cache: "no-store" },
    );
    const result = (await response.json()) as { message?: string; data?: AdminProposalDetail };
    if (response.status === 404) return { ok: false, notFound: true, data: null };
    if (!response.ok || !result.data) {
      return { ok: false, error: result?.message || "Failed to fetch the proposal.", data: null };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error", data: null };
  }
}

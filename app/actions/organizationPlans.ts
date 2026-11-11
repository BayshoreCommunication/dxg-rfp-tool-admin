"use server";

import { revalidatePath } from "next/cache";

import { BACKEND_URL } from "@/lib/config";
import type { OrganizationPlanDetail, OrganizationPlansPage } from "@/lib/organizationPlans";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

// Plan management for RFPilot staff (ORG-603). The backend checks the staff role and the
// admin account on every call; these actions only carry the signed-in admin's session.

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

const BASE = `${BACKEND_URL}/api/v1/admin/organization-plans`;

const FALLBACK_ERRORS: Record<number, string> = {
  401: "Your session has ended. Sign in again.",
  403: "Only RFPilot staff can view or change plans.",
  404: "Organization not found.",
  409: "This organization's plan was just changed by someone else. Reload and try again.",
  429: "Too many plan changes in a short time. Wait a few minutes and try again.",
};

const request = async <T>(url: string, init: RequestInit, fallback: string): Promise<ActionResult<T>> => {
  try {
    const response = await authenticatedBackendFetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; code?: string; message?: string; data?: T }
      | null;
    if (!response.ok || !body?.data) {
      return {
        ok: false,
        error: body?.message || FALLBACK_ERRORS[response.status] || fallback,
        ...(body?.code ? { code: body.code } : {}),
      };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, error: "The server couldn't be reached. Check your connection and try again." };
  }
};

export async function listOrganizationPlansAction(
  search: string = "",
  page: number = 1,
): Promise<ActionResult<OrganizationPlansPage>> {
  const query = new URLSearchParams({ page: String(Math.max(1, Math.floor(page) || 1)) });
  if (search.trim()) query.set("search", search.trim());
  return request<OrganizationPlansPage>(`${BASE}?${query.toString()}`, { method: "GET" }, "Organizations couldn't be loaded.");
}

export async function getOrganizationPlanAction(
  organizationId: string,
): Promise<ActionResult<OrganizationPlanDetail>> {
  return request<OrganizationPlanDetail>(
    `${BASE}/${encodeURIComponent(organizationId)}`,
    { method: "GET" },
    "The organization's plan couldn't be loaded.",
  );
}

export async function changeOrganizationPlanAction(
  organizationId: string,
  plan: string,
  note: string = "",
): Promise<ActionResult<OrganizationPlanDetail>> {
  const trimmed = note.trim();
  const result = await request<OrganizationPlanDetail>(
    `${BASE}/${encodeURIComponent(organizationId)}`,
    { method: "PUT", body: JSON.stringify({ plan, ...(trimmed ? { note: trimmed } : {}) }) },
    "The plan couldn't be changed.",
  );
  if (result.ok) revalidatePath("/organizations");
  return result;
}

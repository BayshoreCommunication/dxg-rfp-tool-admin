"use server";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import {
  isSupportAccessId,
  parseGrantedAccessList,
  parseGrantedRfpDetail,
  parseGrantedRfpPage,
  parseGrantedVendorResponses,
  supportAccessFailure,
  type GrantedAccess,
  type GrantedRfpDetail,
  type GrantedRfpPage,
  type GrantedVendorResponses,
  type SupportAccessFailure,
} from "@/lib/supportAccess/grants";

// ORG-406. The only way the admin app reads a customer organization's RFPs: the grant-gated
// routes from ORG-404. The backend checks the grant on every request and records each read in
// the customer's organization, so nothing here is cached and nothing is fetched ahead of the
// screen that shows it.

const API = `${BACKEND_URL}/api/v1/admin/support-access`;

export type SupportAccessResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: SupportAccessFailure; error: string };

const MESSAGES: Record<SupportAccessFailure, string> = {
  grant_required: "This organization hasn't granted RFPilot Support access, or the access has ended.",
  not_found: "RFP not found.",
  error: "Support access could not be loaded. Please try again in a moment.",
};

const refused = (failure: SupportAccessFailure): { ok: false; failure: SupportAccessFailure; error: string } => ({
  ok: false,
  failure,
  error: MESSAGES[failure],
});

const read = async <T>(path: string, parse: (data: unknown) => T | null): Promise<SupportAccessResult<T>> => {
  try {
    const response = await authenticatedBackendFetch(`${API}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { code?: unknown; data?: unknown } | null;
    if (!response.ok) {
      return refused(supportAccessFailure(response.status, typeof body?.code === "string" ? body.code : null));
    }
    const data = parse(body?.data);
    return data === null ? refused("error") : { ok: true, data };
  } catch {
    return refused("error");
  }
};

/** "Granted to me": every organization's active grants. Grant details only, no RFP content. */
export async function listGrantedAccessAction(): Promise<SupportAccessResult<GrantedAccess[]>> {
  return read("/grants", (data) => parseGrantedAccessList(data));
}

export async function listGrantedRfpsAction(
  organizationId: string,
  query: { page?: number; search?: string } = {},
): Promise<SupportAccessResult<GrantedRfpPage>> {
  // The backend answers a malformed organization id exactly like an organization with no grant.
  if (!isSupportAccessId(organizationId)) return refused("grant_required");
  const params = new URLSearchParams();
  const page = Number.isInteger(query.page) && (query.page as number) > 1 ? (query.page as number) : 1;
  if (page > 1) params.set("page", String(page));
  const search = (query.search ?? "").trim().slice(0, 200);
  if (search) params.set("search", search);
  return read(`/organizations/${organizationId}/rfps${params.size ? `?${params.toString()}` : ""}`, (data) => parseGrantedRfpPage(data));
}

export async function getGrantedRfpAction(organizationId: string, rfpId: string): Promise<SupportAccessResult<GrantedRfpDetail>> {
  if (!isSupportAccessId(organizationId)) return refused("grant_required");
  if (!isSupportAccessId(rfpId)) return refused("not_found");
  return read(`/organizations/${organizationId}/rfps/${rfpId}`, (data) => {
    const detail = parseGrantedRfpDetail(data);
    // Never show an RFP other than the one asked for, or one outside the grant it came with.
    if (!detail || detail.rfp.id !== rfpId || (detail.grant.rfpId !== null && detail.grant.rfpId !== rfpId)) return null;
    return detail;
  });
}

export async function listGrantedVendorResponsesAction(
  organizationId: string,
  rfpId: string,
): Promise<SupportAccessResult<GrantedVendorResponses>> {
  if (!isSupportAccessId(organizationId)) return refused("grant_required");
  if (!isSupportAccessId(rfpId)) return refused("not_found");
  return read(`/organizations/${organizationId}/rfps/${rfpId}/vendor-responses`, (data) => {
    const responses = parseGrantedVendorResponses(data);
    if (!responses || (responses.grant.rfpId !== null && responses.grant.rfpId !== rfpId)) return null;
    return responses;
  });
}

/**
 * Which of an organization's grants are still active, for the open workspace to notice a
 * revocation without re-reading (and re-auditing) any RFP. `null` when that can't be told.
 */
export async function activeGrantIdsAction(organizationId: string): Promise<string[] | null> {
  if (!isSupportAccessId(organizationId)) return [];
  const result = await listGrantedAccessAction();
  if (!result.ok) return null;
  return result.data.filter((grant) => grant.organization.id === organizationId).map((grant) => grant.id);
}

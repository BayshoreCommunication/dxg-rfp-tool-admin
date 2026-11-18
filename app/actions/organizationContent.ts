"use server";

import { BACKEND_URL } from "@/lib/config";
import {
  contentFailure,
  isContentId,
  pageOf,
  parseMembersPage,
  parseProposalDetail,
  parseProposalsPage,
  parseTeams,
  parseTemplateDetail,
  parseTemplatesPage,
  parseVendorResponses,
  parseVendorsPage,
  searchOf,
  STATUS_FILTERS,
  TEMPLATE_SCOPES,
  type ContentFailure,
  type ContentResult,
  type MembersPage,
  type ProposalDetail,
  type ProposalsPage,
  type TeamsList,
  type TemplateDetail,
  type TemplatesPage,
  type VendorResponses,
  type VendorsPage,
} from "@/lib/organizationContent/content";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { checkStaffAdmin } from "@/lib/server/staffAdmin";

/* The organization content browser (owner decision, 2026-11-17). RFPilot staff view a customer
   organization's proposals, vendor responses, members, teams, templates and vendor list with no
   grant. Every action here is a GET: nothing in the admin app edits or deletes customer content.

   The backend records each successful read, and each 404, in the staff organization's audit
   trail. So nothing here is cached, nothing is fetched ahead of the screen that shows it, and
   each action makes exactly one request. All eight routes share one rate limit (300 reads per
   15 minutes per staff account): nothing polls them.

   Order of every action: the signed-in session must be a staff admin, the ids must be ids
   (24 lower-case hex), and only then is the backend asked. The organization is always the one
   in the path. */

const API = `${BACKEND_URL}/api/v1/admin/organizations`;

const refused = (failure: ContentFailure): { ok: false; failure: ContentFailure } => ({ ok: false, failure });

type Query = Record<string, string | number | undefined>;

/* A list is asked with the organization alone. A record action always passes `recordId`, whatever
   it was called with (a server action can be posted with nothing there), and it is always checked:
   a record route is never asked with an empty or made-up id. */
const read = async <T>(
  ids: { organizationId: string } | { organizationId: string; recordId: unknown },
  path: (organizationId: string, recordId: string) => string,
  query: Query,
  parse: (data: unknown) => T | null,
): Promise<ContentResult<T>> => {
  const staff = await checkStaffAdmin();
  if (staff !== "staff") return refused(staff === "signed_out" ? "session_ended" : "forbidden");
  if (!isContentId(ids.organizationId)) return refused("invalid_id");
  const recordId = "recordId" in ids ? ids.recordId : "";
  if ("recordId" in ids && !isContentId(recordId)) return refused("record_not_found");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const url = `${API}/${ids.organizationId}${path(ids.organizationId, typeof recordId === "string" ? recordId : "")}${params.size ? `?${params.toString()}` : ""}`;
  try {
    const response = await authenticatedBackendFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { code?: unknown; data?: unknown } | null;
    if (!response.ok) return refused(contentFailure(response.status, typeof body?.code === "string" ? body.code : null));
    const data = parse(body?.data);
    return data === null ? refused("unavailable") : { ok: true, data };
  } catch {
    return refused("unavailable");
  }
};

/** What a caller passed as the query: a server action can be called with anything. */
const asQuery = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Page 1 and "all" are the backend's defaults, so they are left off the request. */
const pageParam = (page: unknown) => (pageOf(page) > 1 ? pageOf(page) : undefined);
const filterParam = <T extends string>(value: unknown, allowed: readonly T[]) =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) && value !== "all" ? value : undefined;

export async function listOrganizationProposalsAction(
  organizationId: string,
  query: { page?: number; search?: string } = {},
): Promise<ContentResult<ProposalsPage>> {
  const asked = asQuery(query);
  return read({ organizationId }, () => "/proposals", { page: pageParam(asked.page), search: searchOf(asked.search) }, (data) =>
    parseProposalsPage(data, organizationId),
  );
}

export async function getOrganizationProposalAction(organizationId: string, proposalId: string): Promise<ContentResult<ProposalDetail>> {
  return read({ organizationId, recordId: proposalId }, (_, id) => `/proposals/${id}`, {}, (data) =>
    parseProposalDetail(data, organizationId, proposalId),
  );
}

export async function listOrganizationVendorResponsesAction(organizationId: string, proposalId: string): Promise<ContentResult<VendorResponses>> {
  return read({ organizationId, recordId: proposalId }, (_, id) => `/proposals/${id}/vendor-responses`, {}, (data) =>
    parseVendorResponses(data, organizationId, proposalId),
  );
}

export async function listOrganizationMembersAction(organizationId: string, query: { page?: number } = {}): Promise<ContentResult<MembersPage>> {
  return read({ organizationId }, () => "/members", { page: pageParam(asQuery(query).page) }, (data) => parseMembersPage(data, organizationId));
}

export async function listOrganizationTeamsAction(organizationId: string): Promise<ContentResult<TeamsList>> {
  return read({ organizationId }, () => "/teams", {}, (data) => parseTeams(data, organizationId));
}

export async function listOrganizationTemplatesAction(
  organizationId: string,
  query: { page?: number; search?: string; scope?: string; status?: string } = {},
): Promise<ContentResult<TemplatesPage>> {
  const asked = asQuery(query);
  return read(
    { organizationId },
    () => "/templates",
    {
      page: pageParam(asked.page),
      search: searchOf(asked.search),
      scope: filterParam(asked.scope, TEMPLATE_SCOPES),
      status: filterParam(asked.status, STATUS_FILTERS),
    },
    (data) => parseTemplatesPage(data, organizationId),
  );
}

export async function getOrganizationTemplateAction(organizationId: string, templateId: string): Promise<ContentResult<{ template: TemplateDetail }>> {
  return read({ organizationId, recordId: templateId }, (_, id) => `/templates/${id}`, {}, (data) =>
    parseTemplateDetail(data, organizationId, templateId),
  );
}

export async function listOrganizationVendorsAction(
  organizationId: string,
  query: { page?: number; search?: string; status?: string } = {},
): Promise<ContentResult<VendorsPage>> {
  const asked = asQuery(query);
  return read(
    { organizationId },
    () => "/vendors",
    { page: pageParam(asked.page), search: searchOf(asked.search), status: filterParam(asked.status, STATUS_FILTERS) },
    (data) => parseVendorsPage(data, organizationId),
  );
}

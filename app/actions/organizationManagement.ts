"use server";

import { listOrganizationMembersAction } from "@/app/actions/organizationContent";
import { getOrganizationAccountAction } from "@/app/actions/organizationPlans";
import { BACKEND_URL } from "@/lib/config";
import {
  canReceiveProposals,
  isAssignableRole,
  isManagementId,
  parseBlockAnswer,
  parseManagedMember,
  parseMemberChange,
  parseReassignment,
  parseTransfer,
  reasonOf,
  refusalOf,
  refused,
  versionOf,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementRefusal,
  type ManagementResult,
  type MemberChangeAnswer,
  type OrganizationBlockAnswer,
  type OrganizationWrite,
  type ReassignAnswer,
  type ReassignCandidatesPage,
  type RequestMode,
  type TransferAnswer,
} from "@/lib/organizationManagement/management";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { checkStaffAdmin } from "@/lib/server/staffAdmin";

/* Staff management of a customer organization (owner decisions, 2026-11-18): a member's role,
   deactivate and reactivate, reassign the member's proposals, transfer ownership, and block or
   reactivate the whole organization. These change real customers' access, so every action keeps
   the same order: the signed-in session must be a staff admin; every id must be an id
   (24 lower-case hex); the body is rebuilt field by field from checked values (the role from a
   fixed list, the reason trimmed and 10 to 500 characters, the version a whole number), never the
   caller's object; only then is the backend asked, once. A refusal is returned as a fixed kind
   with the backend's code (lib/organizationManagement/management.ts): its message text is never
   passed on.

   Every request is recorded in the staff organization's audit trail, the single-member read
   included, and never in the customer's. Nothing here is cached, and nothing is read ahead of
   the screen that shows it. Member, team and block writes share one allowance of 60 per
   15 minutes per staff account; the reads count toward the 300 of the content browser.

   Nothing here edits or deletes a proposal, a template or the vendor list: the backend has no
   staff route that does. */

const API = `${BACKEND_URL}/api/v1/admin/organizations`;

/** The one request an action makes, and its refusal as a fixed kind. */
const ask = async <T>(
  mode: RequestMode,
  path: string,
  init: { method: "GET" } | { method: "POST" | "PATCH"; body: Record<string, string | number> },
  parse: (data: unknown) => T | null,
): Promise<ManagementResult<T>> => {
  // A write that was sent and not confirmed may have been saved: it is never reported as "nothing happened".
  const unknown = refused(mode === "write" ? "outcome_unknown" : "unavailable");
  try {
    const response = await authenticatedBackendFetch(`${API}${path}`, {
      method: init.method,
      headers: init.method === "GET" ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
      ...(init.method === "GET" ? {} : { body: JSON.stringify(init.body) }),
    });
    const body = (await response.json().catch(() => null)) as { data?: unknown } | null;
    if (!response.ok) return refusalOf(response.status, body, response.headers?.get?.("Retry-After"), mode);
    const data = parse(body?.data);
    return data === null ? unknown : { ok: true, data };
  } catch {
    return unknown;
  }
};

const staffRefusal = async (): Promise<ManagementRefusal | null> => {
  const staff = await checkStaffAdmin();
  return staff === "staff" ? null : refused(staff === "signed_out" ? "session_ended" : "forbidden");
};

/** What a caller passed as the input: a server action can be called with anything. */
const fieldsOf = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** GET members/:userId: one member with the version every member write needs. Recorded like every
    other request, so it is asked once per page view and once more only when staff ask for it. */
export async function getManagedMemberAction(organizationId: string, userId: string): Promise<ManagementResult<ManagedMember>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId) || !isManagementId(userId)) return refused("invalid_id");
  return ask("read", `/${organizationId}/members/${userId}`, { method: "GET" }, (data) => parseManagedMember(data, organizationId, userId));
}

/* The organization as the write pages show it: its name (stated in every review, and typed to
   confirm a transfer or a block), its standing, its Owner and whether it is blocked. There is no
   management route for this: it is the organization account read
   (GET /api/v1/admin/organizations/:organizationId), recorded like any other view of it. Only
   those facts are handed on, and the Owner's name and email only to the one page that shows
   them: the transfer of ownership. `write` is the page asking; anything else gets no Owner. */
export async function getManagedOrganizationAction(organizationId: string, write?: unknown): Promise<ManagementResult<ManagedOrganization>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId)) return refused("invalid_id");
  const result = await getOrganizationAccountAction(organizationId);
  if (result.ok) {
    const { organization, owner } = result.data;
    if (organization.id !== organizationId) return refused("unavailable");
    return {
      ok: true,
      data: {
        id: organization.id,
        name: organization.name,
        standing: organization.standing,
        blocked: organization.blocked ? { at: organization.blocked.at } : null,
        owner: write === "transfer" && owner ? { name: owner.name, email: owner.email } : null,
      },
    };
  }
  switch (result.failure) {
    case "invalid_id":
    case "not_available":
    case "forbidden":
    case "session_ended":
    case "rate_limited":
      return refused(result.failure);
    case "not_found":
      return refused("organization_not_found");
    default:
      return refused("unavailable");
  }
}

/* One page of the organization's members, to choose who receives a member's proposals. There is
   no management route for this either: it is the content browser's members read (50 a page,
   recorded, and counted in that browser's allowance), so it is asked only when staff press the
   control that loads it, one page at a time. Only what the choice shows is handed on: the
   members of that page who can receive the proposals (the API's rule, applied here and not in
   the browser), and how many of the page cannot. A member who cannot receive them is counted,
   never named. `fromUserId` is the member the proposals come from, who is never a receiver. */
export async function listReassignCandidatesAction(organizationId: string, fromUserId: string, page: unknown): Promise<ManagementResult<ReassignCandidatesPage>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId) || !isManagementId(fromUserId)) return refused("invalid_id");
  const asked = typeof page === "number" && Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
  const result = await listOrganizationMembersAction(organizationId, { page: asked });
  if (result.ok) {
    const candidates = result.data.members
      .map((member) => ({ userId: member.userId, name: member.name, email: member.email, roles: member.roles, status: member.status }))
      .filter((candidate) => canReceiveProposals(candidate, fromUserId));
    return {
      ok: true,
      data: { candidates, notEligibleCount: result.data.members.length - candidates.length, pagination: result.data.pagination },
    };
  }
  switch (result.failure) {
    case "invalid_id":
    case "organization_not_found":
    case "not_available":
    case "forbidden":
    case "session_ended":
    case "rate_limited":
      return refused(result.failure);
    default:
      return refused("unavailable");
  }
}

/** PATCH members/:userId/role `{ role, version, reason }`. Never to or from Owner. */
export async function changeMemberRoleAction(organizationId: string, userId: string, input: unknown): Promise<ManagementResult<MemberChangeAnswer>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId) || !isManagementId(userId)) return refused("invalid_id");
  const fields = fieldsOf(input);
  // Owner and anything outside the list stop here: the Owner role only moves by a transfer.
  if (!isAssignableRole(fields.role)) return refused("invalid_role");
  const version = versionOf(fields.version);
  if (version === null) return refused("version_required");
  const reason = reasonOf(fields.reason);
  if (reason === null) return refused("invalid_reason");
  return ask("write", `/${organizationId}/members/${userId}/role`, { method: "PATCH", body: { role: fields.role, version, reason } }, (data) =>
    parseMemberChange(data, organizationId, userId),
  );
}

const memberStatusWrite = async (organizationId: string, userId: string, input: unknown, route: "deactivate" | "reactivate"): Promise<ManagementResult<MemberChangeAnswer>> => {
  if (!isManagementId(organizationId) || !isManagementId(userId)) return refused("invalid_id");
  const fields = fieldsOf(input);
  const version = versionOf(fields.version);
  if (version === null) return refused("version_required");
  const reason = reasonOf(fields.reason);
  if (reason === null) return refused("invalid_reason");
  return ask("write", `/${organizationId}/members/${userId}/${route}`, { method: "POST", body: { version, reason } }, (data) =>
    parseMemberChange(data, organizationId, userId),
  );
};

/** POST members/:userId/deactivate `{ version, reason }`. */
export async function deactivateMemberAction(organizationId: string, userId: string, input: unknown): Promise<ManagementResult<MemberChangeAnswer>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  return memberStatusWrite(organizationId, userId, input, "deactivate");
}

/** POST members/:userId/reactivate `{ version, reason }`. */
export async function reactivateMemberAction(organizationId: string, userId: string, input: unknown): Promise<ManagementResult<MemberChangeAnswer>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  return memberStatusWrite(organizationId, userId, input, "reactivate");
}

/* POST members/:userId/reassign-rfps `{ toUserId, reason }`. `rfpIds` is never sent: without it
   the API moves every proposal the member owns, which is what the screen offers. */
export async function reassignMemberProposalsAction(organizationId: string, userId: string, input: unknown): Promise<ManagementResult<ReassignAnswer>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId) || !isManagementId(userId)) return refused("invalid_id");
  const fields = fieldsOf(input);
  if (!isManagementId(fields.toUserId)) return refused("invalid_request");
  if (fields.toUserId === userId) return refused("reassign_to_self");
  const reason = reasonOf(fields.reason);
  if (reason === null) return refused("invalid_reason");
  return ask("write", `/${organizationId}/members/${userId}/reassign-rfps`, { method: "POST", body: { toUserId: fields.toUserId, reason } }, (data) =>
    parseReassignment(data, organizationId),
  );
}

/** POST ownership/transfer `{ toUserId, version, reason }`: `version` is the new Owner's membership version. */
export async function transferOwnershipAction(organizationId: string, input: unknown): Promise<ManagementResult<TransferAnswer>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId)) return refused("invalid_id");
  const fields = fieldsOf(input);
  const toUserId = fields.toUserId;
  if (!isManagementId(toUserId)) return refused("invalid_id");
  const version = versionOf(fields.version);
  if (version === null) return refused("version_required");
  const reason = reasonOf(fields.reason);
  if (reason === null) return refused("invalid_reason");
  return ask("write", `/${organizationId}/ownership/transfer`, { method: "POST", body: { toUserId, version, reason } }, (data) =>
    parseTransfer(data, organizationId, toUserId),
  );
}

const organizationWrite = async (organizationId: string, input: unknown, write: OrganizationWrite): Promise<ManagementResult<OrganizationBlockAnswer>> => {
  if (!isManagementId(organizationId)) return refused("invalid_id");
  const reason = reasonOf(fieldsOf(input).reason);
  if (reason === null) return refused("invalid_reason");
  return ask("write", `/${organizationId}/${write === "block" ? "block" : "reactivate"}`, { method: "POST", body: { reason } }, (data) =>
    parseBlockAnswer(data, organizationId, write),
  );
};

/** POST block `{ reason }`. Idempotent: `changed: false` when it was already blocked. */
export async function blockOrganizationAction(organizationId: string, input: unknown): Promise<ManagementResult<OrganizationBlockAnswer>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  return organizationWrite(organizationId, input, "block");
}

/** POST reactivate `{ reason }`. Idempotent: `changed: false` when it was not blocked. */
export async function reactivateOrganizationAction(organizationId: string, input: unknown): Promise<ManagementResult<OrganizationBlockAnswer>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  return organizationWrite(organizationId, input, "unblock");
}

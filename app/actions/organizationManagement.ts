"use server";

import { getOrganizationAccountAction } from "@/app/actions/organizationPlans";
import { BACKEND_URL } from "@/lib/config";
import {
  isManagementId,
  parseBlockAnswer,
  parseManagedMember,
  reasonOf,
  refusalOf,
  refused,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementRefusal,
  type ManagementResult,
  type OrganizationBlockAnswer,
  type OrganizationWrite,
  type RequestMode,
} from "@/lib/organizationManagement/management";
import { parseManagedTeam, type ManagedTeam } from "@/lib/organizationManagement/teams";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { checkStaffAdmin } from "@/lib/server/staffAdmin";

/* What RFPilot staff do with a customer organization from the management pages (owner decision,
   2026-11-24, which reverses the member and team writes of 2026-11-18): view one member, view
   one team, and block or reactivate the whole organization. Nothing here changes a member or a
   team: there is no action for a role, a deactivation, a reassignment, a transfer of ownership or
   any team change, and app/actions/staffViewOnly.test.ts keeps it so. An exported server action
   is a public endpoint, so the list of exports is the list of what staff can do.

   Every action keeps the same order: the signed-in session must be a staff admin; every id must
   be an id (24 lower-case hex); the body of a block or a reactivation is rebuilt from the checked
   reason (trimmed, 10 to 500 characters), never the caller's object; only then is the backend
   asked, once. A refusal is returned as a fixed kind with the backend's code
   (lib/organizationManagement/management.ts): its message text is never passed on.

   Every request is recorded in the staff organization's audit trail, the member read and the
   team read included, and never in the customer's. Nothing here is cached, and nothing is read
   ahead of the screen that shows it. The reads count toward the 300 of the content browser.

   Nothing here edits or deletes a proposal, a template or the vendor list. */

const API = `${BACKEND_URL}/api/v1/admin/organizations`;

/** The one request an action makes, and its refusal as a fixed kind. */
const ask = async <T>(
  mode: RequestMode,
  path: string,
  init: { method: "GET" } | { method: "POST"; body: Record<string, string> },
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

/** GET members/:userId: one member, to view. Recorded like every other request, so it is asked
    once per page view. */
export async function getManagedMemberAction(organizationId: string, userId: string): Promise<ManagementResult<ManagedMember>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId) || !isManagementId(userId)) return refused("invalid_id");
  return ask("read", `/${organizationId}/members/${userId}`, { method: "GET" }, (data) => parseManagedMember(data, organizationId, userId));
}

/* The organization as the block and reactivate pages show it: its name (stated in the review, and
   typed to confirm a block), its standing and whether it is blocked. There is no management route
   for this: it is the organization account read (GET /api/v1/admin/organizations/:organizationId),
   recorded like any other view of it. Only those facts are handed on: the Owner is not. */
export async function getManagedOrganizationAction(organizationId: string): Promise<ManagementResult<ManagedOrganization>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId)) return refused("invalid_id");
  const result = await getOrganizationAccountAction(organizationId);
  if (result.ok) {
    const { organization } = result.data;
    if (organization.id !== organizationId) return refused("unavailable");
    return {
      ok: true,
      data: {
        id: organization.id,
        name: organization.name,
        standing: organization.standing,
        blocked: organization.blocked ? { at: organization.blocked.at } : null,
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

/** GET teams/:teamId: one team with the members the backend lists (at most 200). Recorded like
    every other request, so it is asked once per page view. */
export async function getManagedTeamAction(organizationId: string, teamId: string): Promise<ManagementResult<ManagedTeam>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isManagementId(organizationId)) return refused("invalid_id");
  if (!isManagementId(teamId)) return refused("invalid_team_id");
  return ask("read", `/${organizationId}/teams/${teamId}`, { method: "GET" }, (data) => parseManagedTeam(data, organizationId, teamId));
}

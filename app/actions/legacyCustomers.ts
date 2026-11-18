"use server";

import { listOrganizationTeamsAction } from "@/app/actions/organizationContent";
import { BACKEND_URL } from "@/lib/config";
import {
  isIdempotencyKey,
  isPlacementId,
  isRunId,
  parseLegacyCustomers,
  parsePlacementRun,
  parseTargetOrganizations,
  placementFailure,
  retryAfterSecondsOf,
  searchTermOf,
  startedRunOf,
  validatePlacementRequest,
  type LegacyCustomer,
  type PlacementAction,
  type PlacementFailure,
  type PlacementResult,
  type PlacementRun,
  type StartedRun,
  type TargetOrganization,
} from "@/lib/legacyCustomers/placement";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { checkStaffAdmin } from "@/lib/server/staffAdmin";

/* Legacy customer placement (backend ORG-110). Staff move a legacy customer, with their
   proposals, into a new or an existing organization; on production the move runs as a one-off
   task and the screen follows the run. The five routes are under /api/admin/legacy-customers
   (not /api/v1/admin).

   Placement moves tenant data, so every action here keeps the same order: the signed-in session
   must be a staff admin; every id must be an id (24 lower-case hex, or a run id); the body is
   rebuilt field by field from checked values, never the caller's object; only then is the
   backend asked, once. A refusal is returned as a fixed kind (lib/legacyCustomers/placement.ts):
   the backend's message text is never passed on.

   Allowances per staff member per 15 minutes: 1,500 run reads, 600 list and search reads
   together, 120 placements and rollbacks. Two different refusals are both a 429:
   PLACEMENT_RATE_LIMITED (an allowance is used up) and PLACEMENT_CAPACITY_REACHED (another
   placement or rollback is running). */

const API = `${BACKEND_URL}/api/admin/legacy-customers`;

type Refused = { ok: false; failure: PlacementFailure; retryAfterSeconds?: number; runId?: string };
const refused = (failure: PlacementFailure): Refused => ({ ok: false, failure });

type Body = { code?: unknown; data?: unknown; details?: unknown } | null;

/** The one request an action makes, and its refusal as a fixed kind. */
const ask = async <T>(
  action: PlacementAction,
  path: string,
  init: { method: "GET" } | { method: "POST"; body?: unknown; idempotencyKey: string },
  parse: (data: unknown) => T | null,
): Promise<PlacementResult<T>> => {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.method === "POST") {
      headers["Content-Type"] = "application/json";
      headers["Idempotency-Key"] = init.idempotencyKey;
    }
    const response = await authenticatedBackendFetch(`${API}${path}`, {
      method: init.method,
      headers,
      cache: "no-store",
      ...(init.method === "POST" ? { body: JSON.stringify(init.body ?? {}) } : {}),
    });
    const body = (await response.json().catch(() => null)) as Body;
    if (!response.ok) {
      const failure = placementFailure(response.status, typeof body?.code === "string" ? body.code : null, action);
      const retryAfterSeconds = response.status === 429 ? retryAfterSecondsOf(response.headers?.get?.("Retry-After")) : null;
      // A task that could not be started names the run it journaled; nothing moved.
      const details = typeof body?.details === "object" && body.details !== null ? (body.details as { runId?: unknown }) : null;
      return {
        ok: false,
        failure,
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
        ...(failure === "start_failed" && isRunId(details?.runId) ? { runId: details.runId } : {}),
      };
    }
    const data = parse(body?.data);
    return data === null ? refused("unavailable") : { ok: true, data };
  } catch {
    return refused("unavailable");
  }
};

const staffRefusal = async (): Promise<Refused | null> => {
  const staff = await checkStaffAdmin();
  return staff === "staff" ? null : refused(staff === "signed_out" ? "session_ended" : "forbidden");
};

/** GET /api/admin/legacy-customers: every legacy customer not yet placed, with a proposal count. */
export async function listLegacyCustomersAction(): Promise<PlacementResult<LegacyCustomer[]>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  return ask("list", "", { method: "GET" }, parseLegacyCustomers);
}

/** GET /target-organizations?q=: the organizations a customer can be placed in, by name. */
export async function searchPlacementTargetsAction(search: string): Promise<PlacementResult<TargetOrganization[]>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  const term = searchTermOf(search);
  // Below two characters nothing is asked: the caller gets no results, not every organization.
  if (!term) return { ok: true, data: [] };
  return ask("search", `/target-organizations?${new URLSearchParams({ q: term }).toString()}`, { method: "GET" }, parseTargetOrganizations);
}

export type PlacementTeam = { id: string; name: string };

/* The active teams of the organization chosen as the target, for the optional team. There is no
   placement route for this: it is the content browser's teams read
   (GET /api/v1/admin/organizations/:organizationId/teams), which is recorded in the staff
   organization's audit trail and counts toward that browser's allowance. So it is asked only
   when staff press "Choose a team". */
export async function listPlacementTeamsAction(organizationId: string): Promise<PlacementResult<PlacementTeam[]>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isPlacementId(organizationId)) return refused("invalid_id");
  const result = await listOrganizationTeamsAction(organizationId);
  if (result.ok) {
    return { ok: true, data: result.data.teams.filter((team) => !team.archived && isPlacementId(team.id)).map((team) => ({ id: team.id, name: team.name })) };
  }
  switch (result.failure) {
    case "session_ended":
    case "forbidden":
    case "rate_limited":
    case "organization_not_found":
    case "invalid_id":
    case "not_available":
      return refused(result.failure);
    default:
      return refused("unavailable");
  }
}

/* POST /:userId/placements. Answers 202 with the run on production (201 where the server places
   inside the request). The Idempotency-Key is the one the review step was opened with: a second
   submit of the same review returns the same run and starts nothing. */
export async function placeLegacyCustomerAction(
  userId: string,
  request: unknown,
  idempotencyKey: string,
): Promise<PlacementResult<StartedRun>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isPlacementId(userId)) return refused("invalid_id");
  if (!isIdempotencyKey(idempotencyKey)) return refused("invalid_request");
  const checked = validatePlacementRequest(request);
  if (!checked.ok) return refused("invalid_request");
  return ask("place", `/${userId}/placements`, { method: "POST", body: checked.request, idempotencyKey }, startedRunOf);
}

/** GET /placements/:runId: the run, as the run page shows and follows it. */
export async function getPlacementRunAction(runId: string): Promise<PlacementResult<PlacementRun>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isRunId(runId)) return refused("invalid_id");
  return ask("run", `/placements/${encodeURIComponent(runId)}`, { method: "GET" }, (data) =>
    parsePlacementRun(typeof data === "object" && data !== null ? (data as { placement?: unknown }).placement : null),
  );
}

/* POST /placements/:runId/rollback. The rollback is a second task on the same run: the answer
   names that run, and the run page goes on following it. No body is sent. */
export async function rollbackPlacementRunAction(runId: string, idempotencyKey: string): Promise<PlacementResult<StartedRun>> {
  const denied = await staffRefusal();
  if (denied) return denied;
  if (!isRunId(runId)) return refused("invalid_id");
  if (!isIdempotencyKey(idempotencyKey)) return refused("invalid_request");
  return ask("rollback", `/placements/${encodeURIComponent(runId)}/rollback`, { method: "POST", idempotencyKey }, startedRunOf);
}

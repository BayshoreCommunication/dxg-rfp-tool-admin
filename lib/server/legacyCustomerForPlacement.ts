import "server-only";

import { BACKEND_URL } from "@/lib/config";
import {
  isPlacementId,
  parseLegacyCustomers,
  placementFailure,
  retryAfterSecondsOf,
  type LegacyCustomer,
  type PlacementResult,
} from "@/lib/legacyCustomers/placement";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { checkStaffAdmin } from "@/lib/server/staffAdmin";

/* The one legacy customer the place page is about. The API has no route for a single legacy
   customer, only the whole list (GET /api/admin/legacy-customers), so the list is read once here
   and one row of it is returned: every other customer's name, email and company stays in this
   function. It is a server-only helper and not a server action, so no browser can call it and be
   answered with the list.

   The same order as the placement actions (app/actions/legacyCustomers.ts): the signed-in
   session must be a staff admin, the id must be an id, and only then is the backend asked, once.
   A refusal is a fixed kind; the backend's message text is never passed on. `data: null` means
   the read worked and this customer is not in the list (placed already, or never a legacy
   customer). */
export async function loadLegacyCustomerForPlacement(userId: unknown): Promise<PlacementResult<LegacyCustomer | null>> {
  const staff = await checkStaffAdmin();
  if (staff !== "staff") return { ok: false, failure: staff === "signed_out" ? "session_ended" : "forbidden" };
  if (!isPlacementId(userId)) return { ok: false, failure: "invalid_id" };
  try {
    const response = await authenticatedBackendFetch(`${BACKEND_URL}/api/admin/legacy-customers`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { code?: unknown; data?: unknown } | null;
    if (!response.ok) {
      const failure = placementFailure(response.status, typeof body?.code === "string" ? body.code : null, "list");
      const retryAfterSeconds = response.status === 429 ? retryAfterSecondsOf(response.headers?.get?.("Retry-After")) : null;
      return { ok: false, failure, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) };
    }
    const customers = parseLegacyCustomers(body?.data);
    if (customers === null) return { ok: false, failure: "unavailable" };
    return { ok: true, data: customers.find((customer) => customer.userId === userId) ?? null };
  } catch {
    return { ok: false, failure: "unavailable" };
  }
}

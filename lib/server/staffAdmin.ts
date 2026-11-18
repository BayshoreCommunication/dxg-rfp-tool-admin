import "server-only";

import { auth } from "@/auth";
import { SESSION_EXPIRED_ERROR } from "@/lib/authTokenState";

/* Who is asking, read from the signed-in session before a server action calls the backend.
   The same rule as proxy.ts: a session that has not ended, whose role is an admin role. The
   backend checks the stored account again on every call; this keeps a request that could
   never be allowed from being sent at all. */

export type StaffCheck = "staff" | "signed_out" | "not_staff";

const ADMIN_ROLES = ["admin", "superadmin", "super_admin"];

type SessionLike = { user?: { role?: unknown } | null; authError?: unknown } | null | undefined;

export const staffCheckOf = (session: SessionLike): StaffCheck => {
  if (!session?.user || session.authError === SESSION_EXPIRED_ERROR) return "signed_out";
  return ADMIN_ROLES.includes(String(session.user.role ?? "").toLowerCase()) ? "staff" : "not_staff";
};

export async function checkStaffAdmin(): Promise<StaffCheck> {
  try {
    return staffCheckOf(await auth());
  } catch {
    return "signed_out";
  }
}

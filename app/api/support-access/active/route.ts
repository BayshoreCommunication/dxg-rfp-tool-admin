import { NextResponse } from "next/server";

import { listGrantedAccessAction } from "@/app/actions/supportAccess";
import { isSupportAccessId } from "@/lib/supportAccess/grants";

// Which of an organization's grants are still active, for an open support access screen to
// notice a revocation. Grant details only: no RFP is read, so nothing is audited. A route
// handler rather than a server action, so a session refresh during the check can never
// re-render the open screen (which would read, and audit, the RFP again).
export const dynamic = "force-dynamic";

const answer = (body: { active: string[] } | { error: string }, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!isSupportAccessId(organizationId)) return answer({ active: [] });
  const granted = await listGrantedAccessAction();
  if (!granted.ok) return answer({ error: "unavailable" }, 503);
  return answer({ active: granted.data.filter((grant) => grant.organization.id === organizationId).map((grant) => grant.id) });
}

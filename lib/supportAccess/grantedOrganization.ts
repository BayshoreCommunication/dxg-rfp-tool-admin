import "server-only";

import { redirect } from "next/navigation";

import { listGrantedAccessAction } from "@/app/actions/supportAccess";
import { accessEndedPath, isSupportAccessId } from "@/lib/supportAccess/grants";

/**
 * The organization a grant screen is about, from "Granted to me" (grant details only, not an
 * audited read). With no active grant there, the agent goes straight back to the list instead
 * of asking for RFP data that would be refused. The audited read still decides for itself.
 */
export async function grantedOrganizationName(organizationId: string): Promise<string | null> {
  if (!isSupportAccessId(organizationId)) redirect(accessEndedPath());
  const granted = await listGrantedAccessAction();
  if (!granted.ok) return null;
  const grant = granted.data.find((item) => item.organization.id === organizationId);
  if (!grant) redirect(accessEndedPath());
  return grant.organization.name;
}

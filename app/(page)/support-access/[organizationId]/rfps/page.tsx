import { redirect } from "next/navigation";

import { SUPPORT_ACCESS_PATH, isSupportAccessId, organizationRfpsPath } from "@/lib/supportAccess/grants";

export default async function GrantedRfpsIndexPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  redirect(isSupportAccessId(organizationId) ? organizationRfpsPath(organizationId) : SUPPORT_ACCESS_PATH);
}

import { redirect } from "next/navigation";

import { getGrantedRfpAction } from "@/app/actions/supportAccess";
import GrantWorkspace from "@/components/supportAccess/GrantWorkspace";
import GrantedRfpDetail from "@/components/supportAccess/GrantedRfpDetail";
import { RfpNotFound, SupportAccessError } from "@/components/supportAccess/SupportAccessStates";
import { grantedOrganizationName } from "@/lib/supportAccess/grantedOrganization";
import { accessEndedPath, organizationRfpsPath } from "@/lib/supportAccess/grants";

export const metadata = { title: "RFP" };
export const dynamic = "force-dynamic";

type GrantedRfpPageProps = {
  params: Promise<{ organizationId: string; rfpId: string }>;
};

export default async function GrantedRfpPage({ params }: GrantedRfpPageProps) {
  const { organizationId, rfpId } = await params;
  const organizationName = await grantedOrganizationName(organizationId);
  const response = await getGrantedRfpAction(organizationId, rfpId);
  if (!response.ok) {
    if (response.failure === "grant_required") redirect(accessEndedPath());
    const back = { backHref: organizationRfpsPath(organizationId), backLabel: "Back to this organization's granted RFPs" };
    return response.failure === "not_found" ? <RfpNotFound {...back} /> : <SupportAccessError message={response.error} {...back} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 pb-10">
      <GrantWorkspace organizationId={organizationId} organizationName={organizationName} grants={[response.data.grant]} readAt={response.readAt}>
        <GrantedRfpDetail organizationId={organizationId} data={response.data} />
      </GrantWorkspace>
    </div>
  );
}

import { redirect } from "next/navigation";

import { listGrantedVendorResponsesAction } from "@/app/actions/supportAccess";
import GrantWorkspace from "@/components/supportAccess/GrantWorkspace";
import { BackToRfps, RfpViewTabs } from "@/components/supportAccess/GrantedRfpDetail";
import GrantedVendorResponses from "@/components/supportAccess/GrantedVendorResponses";
import { RfpNotFound, SupportAccessError } from "@/components/supportAccess/SupportAccessStates";
import { grantedOrganizationName } from "@/lib/supportAccess/grantedOrganization";
import { accessEndedPath, organizationRfpsPath } from "@/lib/supportAccess/grants";

export const metadata = { title: "Vendor responses" };
export const dynamic = "force-dynamic";

type GrantedVendorResponsesPageProps = {
  params: Promise<{ organizationId: string; rfpId: string }>;
};

export default async function GrantedVendorResponsesPage({ params }: GrantedVendorResponsesPageProps) {
  const { organizationId, rfpId } = await params;
  const organizationName = await grantedOrganizationName(organizationId);
  const response = await listGrantedVendorResponsesAction(organizationId, rfpId);
  if (!response.ok) {
    if (response.failure === "grant_required") redirect(accessEndedPath());
    const back = { backHref: organizationRfpsPath(organizationId), backLabel: "Back to this organization's granted RFPs" };
    return response.failure === "not_found" ? <RfpNotFound {...back} /> : <SupportAccessError message={response.error} {...back} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 pb-10">
      <GrantWorkspace organizationId={organizationId} organizationName={organizationName} grants={[response.data.grant]}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToRfps organizationId={organizationId} scope={response.data.grant.scope} />
          <RfpViewTabs organizationId={organizationId} rfpId={rfpId} active="vendor-responses" />
        </div>
        <GrantedVendorResponses responses={response.data.vendorResponses} />
      </GrantWorkspace>
    </div>
  );
}

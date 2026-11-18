import { listOrganizationVendorResponsesAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import { BackToProposals, ProposalViewTabs } from "@/components/organizations/content/ProposalDetail";
import VendorResponses from "@/components/organizations/content/VendorResponses";
import { isContentId, loadVendorResponsesPage, organizationVendorResponsesPath, organizationProposalsPath } from "@/lib/organizationContent/content";

export const metadata = { title: "Vendor responses" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; proposalId: string }> };

export default async function OrganizationVendorResponsesPage({ params }: Props) {
  const { organizationId, proposalId } = await params;
  const result = await loadVendorResponsesPage({ vendorResponses: listOrganizationVendorResponsesAction }, organizationId, proposalId);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="proposals">
      {result.ok ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackToProposals organizationId={organizationId} />
            <ProposalViewTabs organizationId={organizationId} proposalId={proposalId} active="vendor-responses" />
          </div>
          <VendorResponses responses={result.data.vendorResponses} />
        </div>
      ) : (
        <ContentFailureState
          failure={result.failure}
          kind="vendor_responses"
          retryHref={known && isContentId(proposalId) ? organizationVendorResponsesPath(known, proposalId) : undefined}
          back={known ? { href: organizationProposalsPath(known), label: "Back to this organization's proposals" } : undefined}
        />
      )}
    </ContentFrame>
  );
}

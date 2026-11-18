import { getOrganizationProposalAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import ProposalDetail from "@/components/organizations/content/ProposalDetail";
import { isContentId, loadProposalPage, organizationProposalPath, organizationProposalsPath } from "@/lib/organizationContent/content";

export const metadata = { title: "Proposal" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; proposalId: string }> };

export default async function OrganizationProposalPage({ params }: Props) {
  const { organizationId, proposalId } = await params;
  const result = await loadProposalPage({ proposal: getOrganizationProposalAction }, organizationId, proposalId);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="proposals" here={false}>
      {result.ok ? (
        <ProposalDetail organizationId={organizationId} data={result.data} />
      ) : (
        <ContentFailureState
          failure={result.failure}
          kind="proposal"
          retryHref={known && isContentId(proposalId) ? organizationProposalPath(known, proposalId) : undefined}
          back={known ? { href: organizationProposalsPath(known), label: "Back to this organization's proposals" } : undefined}
        />
      )}
    </ContentFrame>
  );
}

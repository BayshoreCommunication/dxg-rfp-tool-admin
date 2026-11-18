import { listOrganizationProposalsAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import ProposalList from "@/components/organizations/content/ProposalList";
import { isContentId, loadProposalsPage, organizationProposalsPath, withQuery } from "@/lib/organizationContent/content";

export const metadata = { title: "Proposals" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizationProposalsPage({ params, searchParams }: Props) {
  const { organizationId } = await params;
  const { query, result } = await loadProposalsPage({ proposals: listOrganizationProposalsAction }, organizationId, await searchParams);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="proposals">
      {result.ok ? (
        <ProposalList organizationId={organizationId} search={query.search} page={result.data} />
      ) : (
        <ContentFailureState
          failure={result.failure}
          kind="proposals"
          retryHref={known ? withQuery(organizationProposalsPath(known), query) : undefined}
        />
      )}
    </ContentFrame>
  );
}

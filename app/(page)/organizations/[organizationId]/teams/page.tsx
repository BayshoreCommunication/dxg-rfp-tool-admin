import { listOrganizationTeamsAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import TeamsList from "@/components/organizations/content/TeamsList";
import { isContentId, loadTeamsPage, organizationTeamsPath } from "@/lib/organizationContent/content";

export const metadata = { title: "Teams" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string }> };

export default async function OrganizationTeamsPage({ params }: Props) {
  const { organizationId } = await params;
  const result = await loadTeamsPage({ teams: listOrganizationTeamsAction }, organizationId);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="teams">
      {result.ok ? (
        <TeamsList data={result.data} />
      ) : (
        <ContentFailureState failure={result.failure} kind="teams" retryHref={known ? organizationTeamsPath(known) : undefined} />
      )}
    </ContentFrame>
  );
}

import { listOrganizationMembersAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import MembersList from "@/components/organizations/content/MembersList";
import { isContentId, loadMembersPage, organizationMembersPath, withQuery } from "@/lib/organizationContent/content";

export const metadata = { title: "Members" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizationMembersPage({ params, searchParams }: Props) {
  const { organizationId } = await params;
  const { query, result } = await loadMembersPage({ members: listOrganizationMembersAction }, organizationId, await searchParams);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="members">
      {result.ok ? (
        <MembersList organizationId={organizationId} page={result.data} />
      ) : (
        <ContentFailureState
          failure={result.failure}
          kind="members"
          retryHref={known ? withQuery(organizationMembersPath(known), query) : undefined}
        />
      )}
    </ContentFrame>
  );
}

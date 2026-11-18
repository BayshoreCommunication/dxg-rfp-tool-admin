import { listOrganizationTemplatesAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import TemplatesList from "@/components/organizations/content/TemplatesList";
import { isContentId, loadTemplatesPage, organizationTemplatesPath, withQuery } from "@/lib/organizationContent/content";

export const metadata = { title: "Templates" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizationTemplatesPage({ params, searchParams }: Props) {
  const { organizationId } = await params;
  const { query, result } = await loadTemplatesPage({ templates: listOrganizationTemplatesAction }, organizationId, await searchParams);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="templates">
      {result.ok ? (
        <TemplatesList organizationId={organizationId} query={query} page={result.data} />
      ) : (
        <ContentFailureState
          failure={result.failure}
          kind="templates"
          retryHref={known ? withQuery(organizationTemplatesPath(known), { ...query, scope: query.scope === "all" ? undefined : query.scope, status: query.status === "all" ? undefined : query.status }) : undefined}
        />
      )}
    </ContentFrame>
  );
}

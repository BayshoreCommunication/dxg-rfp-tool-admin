import { listOrganizationVendorsAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import VendorsList from "@/components/organizations/content/VendorsList";
import { isContentId, loadVendorsPage, organizationVendorsPath, withQuery } from "@/lib/organizationContent/content";

export const metadata = { title: "Vendors" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizationVendorsPage({ params, searchParams }: Props) {
  const { organizationId } = await params;
  const { query, result } = await loadVendorsPage({ vendors: listOrganizationVendorsAction }, organizationId, await searchParams);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="vendors">
      {result.ok ? (
        <VendorsList organizationId={organizationId} query={query} page={result.data} />
      ) : (
        <ContentFailureState
          failure={result.failure}
          kind="vendors"
          retryHref={known ? withQuery(organizationVendorsPath(known), { ...query, status: query.status === "all" ? undefined : query.status }) : undefined}
        />
      )}
    </ContentFrame>
  );
}

import { getOrganizationTemplateAction } from "@/app/actions/organizationContent";
import { ContentFailureState, ContentFrame } from "@/components/organizations/content/ContentChrome";
import TemplateDetail from "@/components/organizations/content/TemplateDetail";
import { isContentId, loadTemplatePage, organizationTemplatePath, organizationTemplatesPath } from "@/lib/organizationContent/content";

export const metadata = { title: "Template" };
// One recorded read per view: the page is rendered for every request, links into it opt out of
// prefetching, and it asks the backend for nothing but what it shows.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; templateId: string }> };

export default async function OrganizationTemplatePage({ params }: Props) {
  const { organizationId, templateId } = await params;
  const result = await loadTemplatePage({ template: getOrganizationTemplateAction }, organizationId, templateId);
  const known = isContentId(organizationId) ? organizationId : null;

  return (
    <ContentFrame organizationId={known} active="templates">
      {result.ok ? (
        <TemplateDetail organizationId={organizationId} template={result.data.template} />
      ) : (
        <ContentFailureState
          failure={result.failure}
          kind="template"
          retryHref={known && isContentId(templateId) ? organizationTemplatePath(known, templateId) : undefined}
          back={known ? { href: organizationTemplatesPath(known), label: "Back to this organization's templates" } : undefined}
        />
      )}
    </ContentFrame>
  );
}

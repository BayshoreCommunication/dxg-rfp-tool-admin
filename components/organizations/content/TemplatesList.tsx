import { countLabel } from "@/lib/plural";
import {
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  TEMPLATE_SCOPES,
  TEMPLATE_SCOPE_LABELS,
  formatContentDate,
  organizationTemplatePath,
  organizationTemplatesPath,
  pageRange,
  personName,
  templateScopeLabel,
  withQuery,
  type TemplatesPage,
  type TemplatesQuery,
} from "@/lib/organizationContent/content";
import { LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { ContentBadge, ContentCard, ContentSearch, EmptyState, FilterPills, Pager } from "./ContentChrome";

type Props = { organizationId: string; query: TemplatesQuery; page: TemplatesPage };

/** Organization templates and every member's personal templates, by title. View only. */
export default function TemplatesList({ organizationId, query, page }: Props) {
  const { templates, pagination } = page;
  const range = pageRange(pagination, templates.length);
  const filtered = Boolean(query.search) || query.scope !== "all" || query.status !== "all";
  const hrefFor = (change: Partial<TemplatesQuery>) => {
    const next = { ...query, page: 1, ...change };
    return withQuery(organizationTemplatesPath(organizationId), {
      search: next.search,
      scope: next.scope === "all" ? undefined : next.scope,
      status: next.status === "all" ? undefined : next.status,
      page: next.page,
    });
  };

  return (
    <ContentCard
      icon={LayoutTemplate}
      title="Templates"
      count={`${pagination.total.toLocaleString("en-US")} ${filtered ? "matching" : "total"}`}
      description="The organization's templates and each member's personal templates, by title."
      controls={
        <>
          <ContentSearch
            action={organizationTemplatesPath(organizationId)}
            search={query.search}
            label="Search templates"
            placeholder="Search title or description"
            keep={{ scope: query.scope === "all" ? undefined : query.scope, status: query.status === "all" ? undefined : query.status }}
          />
          <FilterPills
            label="Template kind"
            options={TEMPLATE_SCOPES.map((value) => ({ value, label: TEMPLATE_SCOPE_LABELS[value] }))}
            active={query.scope}
            hrefFor={(scope) => hrefFor({ scope })}
          />
          <FilterPills
            label="Template status"
            options={STATUS_FILTERS.map((value) => ({ value, label: STATUS_FILTER_LABELS[value] }))}
            active={query.status}
            hrefFor={(status) => hrefFor({ status })}
          />
        </>
      }
    >
      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title={pagination.total > 0 ? "No templates on this page" : "No templates found"}
          message={pagination.total > 0 ? "Go back to an earlier page." : filtered ? "Try a different search or filter." : "This organization has no templates yet."}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {templates.map((template) => (
            <li key={template.id} className="grid gap-2 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-4">
              <div className="min-w-0">
                <Link
                  href={organizationTemplatePath(organizationId, template.id)}
                  prefetch={false}
                  className="break-words text-sm font-bold text-[#20304b] underline-offset-2 hover:text-[#007f86] hover:underline"
                >
                  {template.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <ContentBadge tone="neutral">{templateScopeLabel(template.scope)}</ContentBadge>
                  {template.archived ? <ContentBadge tone="warning">Archived</ContentBadge> : null}
                </div>
                {template.description ? <p className="mt-1 line-clamp-2 break-words text-xs text-slate-600">{template.description}</p> : null}
              </div>
              <div className="min-w-0 text-[13px] text-slate-600">
                {template.owner ? (
                  <>
                    <p className="break-words font-semibold text-[#20304b]">{personName(template.owner)}</p>
                    {template.owner.email ? <p className="break-all text-xs">{template.owner.email}</p> : null}
                  </>
                ) : (
                  <p>Owner no longer a member</p>
                )}
              </div>
              <p className="text-xs text-slate-600">Updated {formatContentDate(template.updatedAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <Pager
        pagination={pagination}
        summary={`Showing ${range.start.toLocaleString("en-US")}–${range.end.toLocaleString("en-US")} of ${countLabel(pagination.total, "template")}`}
        label="Template pagination"
        hrefFor={(next) => hrefFor({ page: next })}
      />
    </ContentCard>
  );
}

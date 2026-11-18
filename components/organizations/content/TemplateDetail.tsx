import {
  formatContentDate,
  organizationTemplatesPath,
  personName,
  templateScopeLabel,
  type TemplateDetail as Template,
} from "@/lib/organizationContent/content";
import { TEMPLATE_SECTIONS, sectionFields } from "@/lib/organizationContent/proposalFields";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { ContentBadge } from "./ContentChrome";
import { Fields } from "./ProposalDetail";

/** A view-only page of what a template keeps from a proposal: its content sections. */
export default function TemplateDetail({ organizationId, template }: { organizationId: string; template: Template }) {
  const sections = TEMPLATE_SECTIONS.map((section) => ({ ...section, fields: sectionFields(section.key, template.content[section.key]) }));
  const filled = sections.filter((section) => section.fields.length > 0);
  const empty = sections.filter((section) => section.fields.length === 0);
  return (
    <div className="space-y-6">
      <Link
        href={organizationTemplatesPath(organizationId)}
        prefetch={false}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-[#007f86]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All templates in this organization
      </Link>

      <header className="rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#007f86] dark:text-cyan-300">
            <LayoutTemplate className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-bold tracking-[-0.02em] text-[#12213a]">{template.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ContentBadge tone="neutral">{templateScopeLabel(template.scope)}</ContentBadge>
              <ContentBadge tone={template.archived ? "warning" : "good"}>{template.archived ? "Archived" : "Active"}</ContentBadge>
            </div>
            {template.description ? <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-600">{template.description}</p> : null}
          </div>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-slate-500">Owner</dt>
            <dd className="mt-1 min-w-0 break-words font-semibold text-[#20304b]">
              {template.owner ? personName(template.owner) : "No longer a member"}
              {template.owner?.email ? <span className="block break-all text-xs font-medium text-slate-600">{template.owner.email}</span> : null}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-slate-500">Event name</dt>
            <dd className="mt-1 break-words font-semibold text-[#20304b]">{template.eventName ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Created</dt>
            <dd className="mt-1 font-semibold text-[#20304b]">{formatContentDate(template.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Updated</dt>
            <dd className="mt-1 font-semibold text-[#20304b]">{formatContentDate(template.updatedAt)}</dd>
          </div>
        </dl>
      </header>

      <div className="space-y-4">
        {filled.map((section) => (
          <section key={section.key} className="rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
            <h2 className="mb-4 text-base font-bold text-[#12213a]">{section.title}</h2>
            <Fields fields={section.fields} />
          </section>
        ))}
        {filled.length === 0 ? (
          <p className="rounded-2xl border border-[#dce5ee] bg-white px-5 py-8 text-center text-sm text-slate-600" role="status">
            This template has no content yet.
          </p>
        ) : empty.length ? (
          <p className="px-1 text-xs text-slate-500">Not filled in: {empty.map((section) => section.title).join(", ")}.</p>
        ) : null}
      </div>
    </div>
  );
}

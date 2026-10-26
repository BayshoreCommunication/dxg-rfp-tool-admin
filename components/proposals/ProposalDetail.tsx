import type { AdminProposalDetail } from "@/app/actions/adminProposals";
import { ArrowLeft, CalendarDays, Eye, FileText, History, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import {
  PROPOSAL_SECTIONS,
  eventDates,
  formatDate,
  publishedState,
  sectionFields,
  type ProposalField,
} from "./proposalLabels";

const badgeClass = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

const Badge = ({ tone, children }: { tone: keyof typeof badgeClass; children: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeClass[tone]}`}>
    {children}
  </span>
);

const Fields = ({ fields, nested = false }: { fields: ProposalField[]; nested?: boolean }) => (
  <dl className={`grid gap-x-6 gap-y-3 sm:grid-cols-2 ${nested ? "xl:grid-cols-3" : ""}`}>
    {fields.map((field, index) =>
      field.kind === "group" ? (
        <div key={`${field.label}-${index}`} className="sm:col-span-full">
          <dt className="mb-2 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
            {field.label} · {field.items.length}
          </dt>
          <dd className="space-y-3">
            {field.items.map((item, itemIndex) => (
              <div key={itemIndex} className={`rounded-xl border p-4 ${nested ? "border-slate-100" : "border-slate-100 bg-[#f8fafc]"}`}>
                <p className="mb-3 text-sm font-bold text-[#20304b]">{item.title}</p>
                {item.fields.length ? (
                  <Fields fields={item.fields} nested />
                ) : (
                  <p className="text-xs text-slate-400">No details</p>
                )}
              </div>
            ))}
          </dd>
        </div>
      ) : (
        <div key={`${field.label}-${index}`} className="min-w-0">
          <dt className="text-xs font-semibold text-slate-500">{field.label}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-[#20304b]">
            {field.kind === "link" ? (
              <a href={field.value} target="_blank" rel="noreferrer noopener" className="text-[#008f96] underline-offset-2 hover:underline">
                {field.value}
              </a>
            ) : (
              field.value
            )}
          </dd>
        </div>
      ),
    )}
  </dl>
);

/** A read-only view of everything the planner filled in. */
export default function ProposalDetail({ data }: { data: AdminProposalDetail }) {
  const { proposal, planner } = data;
  const event = (proposal.event ?? {}) as Record<string, unknown>;
  const eventName = typeof event.eventName === "string" && event.eventName.trim() ? event.eventName : "Untitled event";
  const sections = PROPOSAL_SECTIONS.map((section) => ({
    ...section,
    fields: sectionFields(section.key, proposal[section.key]),
  }));
  const filled = sections.filter((section) => section.fields.length > 0);
  const empty = sections.filter((section) => section.fields.length === 0);

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 pb-10">
      <Link href="/proposals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-[#008f96]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All proposals
      </Link>

      <header className="rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#12213a]">{eventName}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {proposal.isArchived ? <Badge tone="slate">Archived</Badge> : null}
              {proposal.isCopy ? <Badge tone="violet">Saved copy</Badge> : null}
              {proposal.isDraft ? (
                <Badge tone="amber">Draft</Badge>
              ) : publishedState({ isActive: proposal.isActive !== false, status: String(proposal.status ?? "") }) === "Live" ? (
                <Badge tone="emerald">Live</Badge>
              ) : (
                <Badge tone="slate">Offline</Badge>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Planner
            </dt>
            <dd className="mt-1 min-w-0">
              {planner ? (
                <>
                  <p className="truncate font-semibold text-[#20304b]">{planner.name || "Unnamed planner"}</p>
                  {planner.email ? (
                    <Link
                      href={`/clients?search=${encodeURIComponent(planner.email)}`}
                      className="flex items-center gap-1 truncate text-xs text-slate-500 hover:text-[#008f96]"
                    >
                      <Mail className="h-3 w-3 shrink-0" aria-hidden="true" /> {planner.email}
                    </Link>
                  ) : null}
                </>
              ) : (
                <span className="text-slate-400">Deleted account</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Event dates
            </dt>
            <dd className="mt-1 font-semibold text-[#20304b]">
              {eventDates({
                startDate: typeof event.startDate === "string" ? event.startDate : null,
                endDate: typeof event.endDate === "string" ? event.endDate : null,
              })}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Vendor views
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-[#20304b]">{Number(proposal.viewsCount ?? 0).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <History className="h-3.5 w-3.5" aria-hidden="true" /> Created · updated
            </dt>
            <dd className="mt-1 font-semibold text-[#20304b]">
              {formatDate(proposal.createdAt) ?? "—"} · {formatDate(proposal.updatedAt) ?? "—"}
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Proposal sections" className="hidden lg:block">
          <ul className="sticky top-6 space-y-1 text-sm">
            {filled.map((section) => (
              <li key={section.key}>
                <a href={`#${section.key}`} className="block rounded-lg px-3 py-1.5 font-semibold text-slate-500 transition hover:bg-[#eaf9f8] hover:text-[#008f96]">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          {filled.map((section) => (
            <section
              key={section.key}
              id={section.key}
              className="scroll-mt-6 rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6"
            >
              <h2 className="mb-4 text-base font-bold text-[#12213a]">{section.title}</h2>
              <Fields fields={section.fields} />
            </section>
          ))}
          {empty.length ? (
            <p className="px-1 text-xs text-slate-400">
              Not filled in yet: {empty.map((section) => section.title).join(", ")}.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

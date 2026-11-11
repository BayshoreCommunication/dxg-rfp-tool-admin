import {
  grantedRfpPath,
  grantedVendorResponsesPath,
  organizationRfpsPath,
  type GrantedRfpDetail as GrantedRfp,
} from "@/lib/supportAccess/grants";
import {
  RFP_SECTIONS,
  eventDates,
  formatDate,
  publishedState,
  sectionFields,
  stageLabel,
  type RfpField,
} from "@/lib/supportAccess/rfpFields";
import { ArrowLeft, CalendarDays, Eye, FileText, History, Mail, UserRound } from "lucide-react";
import Link from "next/link";

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

const Fields = ({ fields, nested = false }: { fields: RfpField[]; nested?: boolean }) => (
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

/** Which view of a granted RFP is open. Each one is its own audited read, so they are separate pages. */
export const RfpViewTabs = ({
  organizationId,
  rfpId,
  active,
}: {
  organizationId: string;
  rfpId: string;
  active: "rfp" | "vendor-responses";
}) => (
  <nav aria-label="RFP views" className="flex flex-wrap gap-2">
    {(
      [
        { id: "rfp", label: "RFP", href: grantedRfpPath(organizationId, rfpId) },
        { id: "vendor-responses", label: "Vendor responses", href: grantedVendorResponsesPath(organizationId, rfpId) },
      ] as const
    ).map((tab) => (
      <Link
        key={tab.id}
        href={tab.href}
        prefetch={false}
        aria-current={tab.id === active ? "page" : undefined}
        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition ${
          tab.id === active
            ? "border-[#aee9e8] bg-[#eaf9f8] text-[#008f96]"
            : "border-slate-200 text-slate-500 hover:border-[#00aeb5] hover:text-[#009ca4]"
        }`}
      >
        {tab.label}
      </Link>
    ))}
  </nav>
);

export const BackToRfps = ({ organizationId, scope }: { organizationId: string; scope: "organization" | "rfp" }) => (
  <Link
    href={organizationRfpsPath(organizationId)}
    prefetch={false}
    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-[#008f96]"
  >
    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {scope === "organization" ? "All RFPs in this organization" : "Granted RFPs"}
  </Link>
);

/** A read-only view of everything the planner filled in, shown only under a grant. */
export default function GrantedRfpDetail({ organizationId, data }: { organizationId: string; data: GrantedRfp }) {
  const { rfp: proposal, owner, grant } = data;
  const event = (proposal.event && typeof proposal.event === "object" ? proposal.event : {}) as Record<string, unknown>;
  const eventName = typeof event.eventName === "string" && event.eventName.trim() ? event.eventName : "Untitled event";
  const lifecycle = (proposal.lifecycle && typeof proposal.lifecycle === "object" ? proposal.lifecycle : {}) as Record<string, unknown>;
  const stage = stageLabel({
    stage: typeof lifecycle.stage === "string" ? lifecycle.stage : null,
    isDraft: proposal.isDraft === true,
    isArchived: proposal.isArchived === true,
  });
  const sections = RFP_SECTIONS.map((section) => ({
    ...section,
    fields: sectionFields(section.key, proposal[section.key]),
  }));
  const filled = sections.filter((section) => section.fields.length > 0);
  const empty = sections.filter((section) => section.fields.length === 0);

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackToRfps organizationId={organizationId} scope={grant.scope} />
        <RfpViewTabs organizationId={organizationId} rfpId={proposal.id} active="rfp" />
      </div>

      <header className="rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#12213a]">{eventName}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={stage === "Draft" ? "amber" : stage === "Archived" ? "slate" : stage === "Awarded" ? "violet" : "emerald"}>
                {stage}
              </Badge>
              {proposal.isCopy === true ? <Badge tone="violet">Saved copy</Badge> : null}
              {proposal.isDraft === true ? null : publishedState({
                  isActive: proposal.isActive !== false,
                  status: String(proposal.status ?? ""),
                }) === "Live" ? (
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
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Owner
            </dt>
            <dd className="mt-1 min-w-0">
              {owner ? (
                <>
                  <p className="truncate font-semibold text-[#20304b]">{owner.name || "Unnamed member"}</p>
                  {owner.email ? (
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                      <Mail className="h-3 w-3 shrink-0" aria-hidden="true" /> {owner.email}
                    </p>
                  ) : null}
                </>
              ) : (
                <span className="text-slate-400">No longer a member</span>
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
              {formatDate(typeof proposal.createdAt === "string" ? proposal.createdAt : null) ?? "—"} ·{" "}
              {formatDate(typeof proposal.updatedAt === "string" ? proposal.updatedAt : null) ?? "—"}
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="RFP sections" className="hidden lg:block">
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

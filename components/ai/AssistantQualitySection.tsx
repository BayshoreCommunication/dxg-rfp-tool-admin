import {
  BarChart3,
  BookOpenCheck,
  Clock3,
  Filter,
  Gauge,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import type {
  AssistantQualityBreakdown,
  AssistantQualityFilters,
  AssistantQualityReport,
} from "@/app/actions/aiOperations";

const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const intents = [
  "greeting_or_thanks",
  "platform_navigation",
  "proposal_creation",
  "proposal_review",
  "pre_send_checklist",
  "event_planning",
  "form_field_help",
  "proposal_specific_request",
  "equipment_scope_review",
  "budget_estimation",
  "historical_reference_request",
  "action_request",
  "unsupported_or_off_topic",
  "ambiguous",
];
const findingCategories = [
  "completeness",
  "schedule",
  "production",
  "budget",
  "risk",
  "scope",
  "room",
  "application",
  "other",
];

const label = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const percent = (value: number | null) =>
  value === null ? "Protected" : `${Math.round(value * 100)}%`;
const duration = (value: number | null) =>
  value === null
    ? "Protected"
    : value >= 1_000
      ? `${(value / 1_000).toFixed(1)}s`
      : `${number.format(value)}ms`;
const count = (value: number | null) =>
  value === null ? "Protected" : number.format(value);
const safeDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : date.format(parsed);
};

const Metric = ({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) => (
  <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#203541] dark:bg-[#0a1923]">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {title}
    </p>
    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
      {value}
    </p>
    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
      {note}
    </p>
  </article>
);

const ComparisonTable = ({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: AssistantQualityBreakdown[];
  empty: string;
}) => (
  <article className="rounded-xl border border-slate-200 dark:border-[#203541]">
    <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-[#203541] dark:text-slate-100">
      {title}
    </h3>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-[#0a1923] dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Group</th>
            <th className="px-4 py-3">Submitted</th>
            <th className="px-4 py-3">Completion</th>
            <th className="px-4 py-3">Helpful</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr
                key={row.dimension}
                className="border-t border-slate-100 dark:border-[#1b2d3a]"
              >
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {label(row.dimension)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {number.format(row.submitted)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {percent(row.completionRate)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {percent(row.helpfulRate)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </article>
);

const filterInput =
  "mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-[#304653] dark:bg-[#0a1923] dark:text-slate-100";

export default function AssistantQualitySection({
  report,
  filters,
}: {
  report: AssistantQualityReport | null;
  filters: AssistantQualityFilters;
}) {
  const summary = report?.summary;
  const minimum = report?.privacy.minimumSampleSize ?? 5;
  const topIntents = [...(report?.breakdowns.intents ?? [])]
    .sort((a, b) => b.submitted - a.submitted)
    .slice(0, 8);
  const lowestIntents = [...(report?.breakdowns.intents ?? [])]
    .filter(
      (row) =>
        row.helpfulRate !== null || row.completionRate !== null,
    )
    .sort(
      (a, b) =>
        (a.helpfulRate ?? a.completionRate ?? 1) -
        (b.helpfulRate ?? b.completionRate ?? 1),
    )
    .slice(0, 8);

  return (
    <section
      aria-labelledby="assistant-quality-heading"
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 dark:border-[#283c4a] dark:bg-[#0d1d28]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-[#009ca4] dark:bg-cyan-500/10 dark:text-cyan-300">
              <BarChart3 size={20} />
            </span>
            <div>
              <h2
                id="assistant-quality-heading"
                className="text-lg font-semibold text-slate-950 dark:text-slate-50"
              >
                Assistant Quality
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Privacy-safe product outcomes and governed-content readiness
              </p>
            </div>
          </div>
        </div>
        {report && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {safeDate(report.window.from)}–{safeDate(report.window.to)} ·
            generated {safeDate(report.generatedAt)}
          </p>
        )}
      </div>

      <form
        method="get"
        className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#203541] dark:bg-[#0a1923]"
        aria-label="Assistant Quality filters"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Filter size={16} /> Filters
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            From
            <input
              name="from"
              type="date"
              defaultValue={filters.from}
              className={filterInput}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            To
            <input
              name="to"
              type="date"
              defaultValue={filters.to}
              className={filterInput}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Organization cohort
            <input
              name="organizationCohort"
              defaultValue={filters.organizationCohort}
              placeholder="e.g. staging_limited"
              maxLength={100}
              className={filterInput}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Model
            <input
              name="model"
              defaultValue={filters.model}
              placeholder="Exact model"
              maxLength={100}
              className={filterInput}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Prompt version
            <input
              name="promptVersion"
              defaultValue={filters.promptVersion}
              placeholder="Exact version"
              maxLength={100}
              className={filterInput}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Knowledge version
            <input
              name="knowledgeVersion"
              defaultValue={filters.knowledgeVersion}
              placeholder="Exact version"
              maxLength={100}
              className={filterInput}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Intent
            <select
              name="intent"
              defaultValue={filters.intent}
              className={filterInput}
            >
              <option value="">All intents</option>
              {intents.map((intent) => (
                <option key={intent} value={intent}>
                  {label(intent)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Finding category
            <select
              name="findingCategory"
              defaultValue={filters.findingCategory}
              className={filterInput}
            >
              <option value="">All findings</option>
              {findingCategories.map((category) => (
                <option key={category} value={category}>
                  {label(category)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="min-h-10 rounded-lg bg-[#102033] px-4 text-sm font-semibold text-white transition hover:bg-[#19314c] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:bg-cyan-500 dark:text-[#06212a]"
          >
            Apply filters
          </button>
          <a
            href="/ai-operations"
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-[#304653] dark:text-slate-200 dark:hover:bg-[#102532]"
          >
            Reset
          </a>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Maximum 90 days. Samples below {minimum} are protected.
          </p>
        </div>
      </form>

      {!report || !summary ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-[#304653] dark:text-slate-400"
        >
          Assistant Quality data is unavailable. Collection may be disabled or
          the report service may not be ready.
        </div>
      ) : (
        <>
          {report.privacy.sampleProtected && (
            <div className="mt-6 flex gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
              <ShieldCheck className="mt-0.5 shrink-0" size={18} />
              <p>
                This window has fewer than {minimum} eligible sessions.
                Protected metrics remain hidden until the sample threshold is
                met.
              </p>
            </div>
          )}

          <div
            className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Assistant Quality summary"
          >
            <Metric
              title="Eligible sessions"
              value={count(summary.eligibleSessions)}
              note="30-minute sessions with a submitted message"
            />
            <Metric
              title="Resolved-session rate"
              value={percent(summary.resolvedSessionRate)}
              note={`${count(summary.resolvedSessions)} sessions with an explicit outcome signal`}
            />
            <Metric
              title="Helpful rate"
              value={percent(summary.helpfulRate)}
              note="Helpful responses divided by submitted feedback"
            />
            <Metric
              title="Completion / error"
              value={`${percent(summary.completionRate)} / ${percent(summary.errorRate)}`}
              note={`Retry ${percent(summary.retryRate)}`}
            />
            <Metric
              title="Clarification / abstention"
              value={`${percent(summary.clarificationRate)} / ${percent(summary.abstentionRate)}`}
              note="Share of completed responses"
            />
            <Metric
              title="Citation usage / validity"
              value={`${percent(summary.citationUsageRate)} / ${percent(summary.citationValidityRate)}`}
              note="Validity means completion validator accepted every citation"
            />
            <Metric
              title="First token p50 / p95"
              value={`${duration(summary.p50FirstTokenMs)} / ${duration(summary.p95FirstTokenMs)}`}
              note="Observed streaming time to first token"
            />
            <Metric
              title="Completion p50 / p95"
              value={`${duration(summary.p50CompletionMs)} / ${duration(summary.p95CompletionMs)}`}
              note="End-to-end response completion latency"
            />
            <Metric
              title="Input / output tokens"
              value={`${count(summary.inputTokens)} / ${count(summary.outputTokens)}`}
              note="Completed responses only"
            />
            <Metric
              title="Estimated cost"
              value={
                summary.estimatedCostMicros === null
                  ? "Protected"
                  : money.format(summary.estimatedCostMicros / 1_000_000)
              }
              note="Versioned model-price estimate, not an invoice"
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <ComparisonTable
              title="Top intents"
              rows={topIntents}
              empty="No intent group meets the minimum sample."
            />
            <ComparisonTable
              title="Lowest-performing intents"
              rows={lowestIntents}
              empty="No intent group has enough outcome data."
            />
            <ComparisonTable
              title="Model comparison"
              rows={report.breakdowns.models}
              empty="No model group meets the minimum sample."
            />
            <ComparisonTable
              title="Prompt-version comparison"
              rows={report.breakdowns.promptVersions}
              empty="No prompt version meets the minimum sample."
            />
            <ComparisonTable
              title="Knowledge-version comparison"
              rows={report.breakdowns.knowledgeVersions}
              empty="No knowledge version meets the minimum sample."
            />
            <ComparisonTable
              title="Rule / pricing-version comparison"
              rows={[
                ...report.breakdowns.ruleVersions,
                ...report.breakdowns.pricingVersions,
              ]}
              empty="No rule or pricing version meets the minimum sample."
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 p-4 dark:border-[#203541]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <MessageSquareText size={17} /> Negative feedback
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {report.breakdowns.negativeFeedback.length ? (
                  report.breakdowns.negativeFeedback.map((row) => (
                    <li
                      key={row.dimension}
                      className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 dark:bg-[#0a1923]"
                    >
                      <span>{label(row.dimension)}</span>
                      <strong>{number.format(row.count)}</strong>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 dark:text-slate-400">
                    No category meets the minimum sample.
                  </li>
                )}
              </ul>
            </article>
            <article className="rounded-xl border border-slate-200 p-4 dark:border-[#203541]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Gauge size={17} /> Finding categories
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {report.breakdowns.findingCategories.length ? (
                  report.breakdowns.findingCategories.map((row) => (
                    <li
                      key={row.dimension}
                      className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 dark:bg-[#0a1923]"
                    >
                      <span>{label(row.dimension)}</span>
                      <strong>{number.format(row.count)}</strong>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 dark:text-slate-400">
                    No finding category meets the minimum sample.
                  </li>
                )}
              </ul>
            </article>
          </div>

          <article className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-[#203541]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <BookOpenCheck size={17} /> Governance attention
            </h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Expiring knowledge
                </h4>
                <ul className="mt-2 space-y-2 text-sm">
                  {report.governance.expiringKnowledge.length ? (
                    report.governance.expiringKnowledge.map((item) => (
                      <li
                        key={`${item.releaseNumber}-${item.expiresAt}`}
                        className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-[#0a1923]"
                      >
                        Release {item.releaseNumber} · {label(item.condition)} ·{" "}
                        {safeDate(item.expiresAt)}
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 dark:text-slate-400">
                      No active release expires within 30 days.
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Stale or retired rules
                </h4>
                <ul className="mt-2 space-y-2 text-sm">
                  {report.governance.staleOrRetiredRules.length ? (
                    report.governance.staleOrRetiredRules.map((item) => (
                      <li
                        key={item.ruleKey}
                        className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-[#0a1923]"
                      >
                        {item.ruleKey} · {label(item.condition)} ·{" "}
                        {safeDate(item.updatedAt)}
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 dark:text-slate-400">
                      No stale or retired rule requires attention.
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Missing approved prices
                </h4>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  {report.governance.unavailableApprovedPriceCategories
                    .map(label)
                    .join(", ") || "Every category has an approved price."}
                </p>
              </div>
            </div>
          </article>

          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <Clock3 className="mt-0.5 shrink-0" size={14} />
            Aggregate metadata only. Raw conversations and direct identifiers
            are never included; every report access is audited.
          </p>
        </>
      )}
    </section>
  );
}

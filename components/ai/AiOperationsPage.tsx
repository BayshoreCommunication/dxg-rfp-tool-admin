import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Database,
  FileCheck2,
  Gauge,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { getAiOperationsData, type AiProviderAttempt } from "@/app/actions/aiOperations";
import AdminPageHeader from "@/components/layout/AdminPageHeader";

const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const stateClass = (state: string) => {
  if (state === "succeeded") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
  }
  if (state === "failed" || state === "orphaned" || state === "rejected") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
};

const label = (value?: string | null) =>
  value
    ? value
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Unknown";

const safeNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : date.format(parsed);
};

const Metric = ({ icon, title, value, note }: { icon: React.ReactNode; title: string; value: string; note: string }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-[#283c4a] dark:bg-[#0d1d28]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-50">{value}</p>
      </div>
      <span className="rounded-xl bg-cyan-50 p-3 text-[#009ca4] dark:bg-cyan-500/10 dark:text-cyan-300">{icon}</span>
    </div>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{note}</p>
  </article>
);

const AttemptRow = ({ attempt }: { attempt: AiProviderAttempt }) => (
  <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-[#1b2d3a] dark:hover:bg-[#102532]">
    <td className="px-4 py-3">
      <p className="font-medium text-slate-900 dark:text-slate-100">{label(attempt.runType)}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label(attempt.operation)} · attempt {safeNumber(attempt.attemptNumber)}</p>
    </td>
    <td className="px-4 py-3">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(attempt.state)}`}>{label(attempt.state)}</span>
      {attempt.errorCode && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{label(attempt.errorCode)}</p>}
    </td>
    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
      {number.format(safeNumber(attempt.inputTokens))} / {number.format(safeNumber(attempt.outputTokens))}
    </td>
    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatDate(attempt.createdAt)}</td>
  </tr>
);

export default async function AiOperationsPage() {
  const { status, usage, runs, errors } = await getAiOperationsData();
  const usageTotals = Array.isArray(usage?.totals) ? usage.totals : [];
  const operationRows = Array.isArray(usage?.operations)
    ? usage.operations
    : [];
  const recentAttempts = Array.isArray(usage?.recentAttempts)
    ? usage.recentAttempts
    : [];
  const gatewayRuns = Array.isArray(runs) ? runs : [];
  const loadErrors = Array.isArray(errors) ? errors : [];
  const totals = usageTotals.reduce(
    (current, row) => ({
      attempts: current.attempts + safeNumber(row.attempts),
      succeeded: current.succeeded + safeNumber(row.succeeded),
      failed: current.failed + safeNumber(row.failedOrOrphaned),
      inputTokens: current.inputTokens + safeNumber(row.inputTokens),
      outputTokens: current.outputTokens + safeNumber(row.outputTokens),
    }),
    { attempts: 0, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0 },
  );
  const successRate = totals.attempts ? Math.round((totals.succeeded / totals.attempts) * 100) : 0;
  const active = Boolean(status?.enabled && !status.killSwitch);

  return (
    <div className="mx-auto w-full max-w-[1540px] pb-4">
      <AdminPageHeader
        eyebrow="AI administration"
        title="AI Operations"
        description="Monitor runtime readiness, provider usage, processing outcomes, and governed AI activity without exposing proposal content."
        icon={BrainCircuit}
        actions={
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              active
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"
            }`}
          >
            {active ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            {status?.killSwitch
              ? "Emergency stop active"
              : active
                ? "Live AI operational"
                : "Live AI unavailable"}
          </div>
        }
      />

      {loadErrors.length > 0 && (
        <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">Some operational data could not be loaded.</p>
          <p className="mt-1">{loadErrors.join(" ")}</p>
        </div>
      )}

      <section aria-label="AI summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Activity size={22} />} title="Provider attempts" value={number.format(totals.attempts)} note="Lifetime provider-attempt ledger" />
        <Metric icon={<CheckCircle2 size={22} />} title="Success rate" value={`${successRate}%`} note={`${number.format(totals.failed)} failed or orphaned`} />
        <Metric icon={<Gauge size={22} />} title="Input tokens" value={number.format(totals.inputTokens)} note="Provider-reported where available" />
        <Metric icon={<Sparkles size={22} />} title="Output tokens" value={number.format(totals.outputTokens)} note="Provider-reported where available" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-[#283c4a] dark:bg-[#0d1d28]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-[#009ca4] dark:bg-cyan-500/10 dark:text-cyan-300">
              <BrainCircuit size={20} />
            </span>
            <div><h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Runtime configuration</h2><p className="text-sm text-slate-500 dark:text-slate-400">Current governed provider controls</p></div>
          </div>
          {status ? (
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Provider", status.provider],
                ["Model", status.model],
                ["Credential", status.credentialConfigured ? "Configured" : "Missing"],
                ["Token ceilings", `${number.format(status.inputTokenLimit)} in / ${number.format(status.outputTokenLimit)} out`],
                ["Synthetic data", status.syntheticEnabled ? "Allowed" : "Denied"],
                ["Non-confidential data", status.nonConfidentialEnabled ? "Allowed" : "Denied"],
                ["Proposal sources", status.proposalSourceEnabled ? "Allowed" : "Denied"],
                ["Direct AI publication", status.publication ? "Enabled" : "Disabled"],
              ].map(([term, description]) => <div key={term} className="rounded-xl border border-transparent bg-slate-50 p-4 dark:border-[#203541] dark:bg-[#0a1923]"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{term}</dt><dd className="mt-1 break-words font-medium text-slate-900 dark:text-slate-100">{description}</dd></div>)}
            </dl>
          ) : <p className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:bg-[#0a1923] dark:text-slate-400">Runtime status is unavailable.</p>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-[#283c4a] dark:bg-[#0d1d28]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-[#009ca4] dark:bg-cyan-500/10 dark:text-cyan-300">
              <ShieldCheck size={20} />
            </span>
            <div><h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Governance boundaries</h2><p className="text-sm text-slate-500 dark:text-slate-400">Controls that remain enforced</p></div>
          </div>
          <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
            {[
              ["Evidence validation", "Structured output and citations are checked before use.", FileCheck2],
              ["Proposal authority", "MongoDB remains authoritative; AI cannot publish.", Database],
              ["Pricing safety", "Investment values come from approved deterministic pricing.", CircleDollarSign],
              ["Failure isolation", "Failed and orphaned attempts remain visible in the ledger.", XCircle],
            ].map(([title, text, Icon]) => (
              <li key={String(title)} className="flex gap-3 rounded-xl border border-slate-100 p-4 dark:border-[#203541]">
                <Icon className="mt-0.5 shrink-0 text-[#009ca4] dark:text-cyan-300" size={18} />
                <span><strong className="block text-slate-900 dark:text-slate-100">{String(title)}</strong>{String(text)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 dark:border-[#283c4a] dark:bg-[#0d1d28]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Usage by capability</h2><p className="text-sm text-slate-500 dark:text-slate-400">Last {safeNumber(usage?.windowDays) || 30} days, grouped by durable run type and operation</p></div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tokens: input / output</p>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100 dark:border-[#203541]">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-[#0a1923] dark:text-slate-400"><tr><th className="px-4 py-3">Capability</th><th className="px-4 py-3">Operation</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Tokens</th></tr></thead>
            <tbody>
              {operationRows.length ? operationRows.map((row) => (
                <tr key={`${row.runType}-${row.operation}-${row.state}`} className="border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-[#1b2d3a] dark:hover:bg-[#102532]">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{label(row.runType)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{label(row.operation)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(row.state)}`}>{label(row.state)}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{number.format(safeNumber(row.attempts))}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{number.format(safeNumber(row.inputTokens))} / {number.format(safeNumber(row.outputTokens))}</td>
                </tr>
              )) : <tr><td colSpan={5} className="border-t border-slate-100 px-4 py-10 text-center text-sm text-slate-500 dark:border-[#1b2d3a] dark:text-slate-400">{usage && !usage.operationsAvailable ? "Capability-level usage is not available from the current API response." : "No provider usage has been recorded in this window."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 dark:border-[#283c4a] dark:bg-[#0d1d28]">
        <div><h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Recent provider attempts</h2><p className="text-sm text-slate-500 dark:text-slate-400">Latest 50 content-free ledger entries</p></div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100 dark:border-[#203541]">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-[#0a1923] dark:text-slate-400"><tr><th className="px-4 py-3">Capability</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Tokens in / out</th><th className="px-4 py-3">Started</th></tr></thead>
            <tbody>
              {recentAttempts.length ? recentAttempts.map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} />) : <tr><td colSpan={4} className="border-t border-slate-100 px-4 py-10 text-center text-sm text-slate-500 dark:border-[#1b2d3a] dark:text-slate-400">{usage && !usage.recentAttemptsAvailable ? "Detailed provider attempts are not available from the current API response." : "No provider attempts recorded yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 dark:border-[#283c4a] dark:bg-[#0d1d28]">
        <div><h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Gateway contract runs</h2><p className="text-sm text-slate-500 dark:text-slate-400">Synthetic policy and schema test history; proposal operations appear in the provider ledger above.</p></div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100 dark:border-[#203541]">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-[#0a1923] dark:text-slate-400"><tr><th className="px-4 py-3">Operation</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Latency</th><th className="px-4 py-3">Created</th></tr></thead>
            <tbody>
              {gatewayRuns.length ? gatewayRuns.map((run) => <tr key={run.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-[#1b2d3a] dark:hover:bg-[#102532]"><td className="px-4 py-3"><p className="font-medium text-slate-900 dark:text-slate-100">{label(run.operation)}</p><p className="text-xs text-slate-500 dark:text-slate-400">{run.promptVersion || "—"} · {run.schemaVersion || "—"}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(run.status)}`}>{label(run.status)}</span></td><td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{run.provider || "—"} / {run.model || "—"}</td><td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{run.latencyMs === null ? "—" : `${number.format(safeNumber(run.latencyMs))} ms`}</td><td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatDate(run.createdAt)}</td></tr>) : <tr><td colSpan={5} className="border-t border-slate-100 px-4 py-10 text-center text-sm text-slate-500 dark:border-[#1b2d3a] dark:text-slate-400">No gateway contract runs recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        {usage?.note && <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{usage.note}</p>}
      </section>
    </div>
  );
}

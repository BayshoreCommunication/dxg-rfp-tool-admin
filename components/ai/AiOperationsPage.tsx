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

const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const stateClass = (state: string) => {
  if (state === "succeeded") return "bg-emerald-100 text-emerald-800";
  if (state === "failed" || state === "orphaned" || state === "rejected") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
};

const label = (value: string) =>
  value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());

const Metric = ({ icon, title, value, note }: { icon: React.ReactNode; title: string; value: string; note: string }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      </div>
      <span className="rounded-xl bg-cyan-50 p-3 text-primary">{icon}</span>
    </div>
    <p className="mt-3 text-xs text-slate-500">{note}</p>
  </article>
);

const AttemptRow = ({ attempt }: { attempt: AiProviderAttempt }) => (
  <tr className="border-t border-slate-100">
    <td className="px-4 py-3">
      <p className="font-medium text-slate-900">{label(attempt.runType)}</p>
      <p className="text-xs text-slate-500">{label(attempt.operation)} · attempt {attempt.attemptNumber}</p>
    </td>
    <td className="px-4 py-3">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(attempt.state)}`}>{label(attempt.state)}</span>
      {attempt.errorCode && <p className="mt-1 text-xs text-rose-700">{label(attempt.errorCode)}</p>}
    </td>
    <td className="px-4 py-3 text-sm text-slate-600">
      {number.format(attempt.inputTokens ?? 0)} / {number.format(attempt.outputTokens ?? 0)}
    </td>
    <td className="px-4 py-3 text-sm text-slate-600">{date.format(new Date(attempt.createdAt))}</td>
  </tr>
);

export default async function AiOperationsPage() {
  const { status, usage, runs, errors } = await getAiOperationsData();
  const totals = usage?.totals.reduce(
    (current, row) => ({
      attempts: current.attempts + row.attempts,
      succeeded: current.succeeded + row.succeeded,
      failed: current.failed + row.failedOrOrphaned,
      inputTokens: current.inputTokens + row.inputTokens,
      outputTokens: current.outputTokens + row.outputTokens,
    }),
    { attempts: 0, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0 },
  ) ?? { attempts: 0, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
  const successRate = totals.attempts ? Math.round((totals.succeeded / totals.attempts) * 100) : 0;
  const active = Boolean(status?.enabled && !status.killSwitch);

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">AI administration</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">AI Operations</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Runtime readiness, provider usage, processing outcomes, and governed AI activity without proposal content.</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          {active ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          {status?.killSwitch ? "Emergency stop active" : active ? "Live AI operational" : "Live AI unavailable"}
        </div>
      </header>

      {errors.length > 0 && (
        <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Some operational data could not be loaded.</p>
          <p className="mt-1">{errors.join(" ")}</p>
        </div>
      )}

      <section aria-label="AI summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Activity size={22} />} title="Provider attempts" value={number.format(totals.attempts)} note="Lifetime provider-attempt ledger" />
        <Metric icon={<CheckCircle2 size={22} />} title="Success rate" value={`${successRate}%`} note={`${number.format(totals.failed)} failed or orphaned`} />
        <Metric icon={<Gauge size={22} />} title="Input tokens" value={number.format(totals.inputTokens)} note="Provider-reported where available" />
        <Metric icon={<Sparkles size={22} />} title="Output tokens" value={number.format(totals.outputTokens)} note="Provider-reported where available" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <BrainCircuit className="text-primary" size={22} />
            <div><h2 className="text-lg font-semibold text-slate-950">Runtime configuration</h2><p className="text-sm text-slate-500">Current governed provider controls</p></div>
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
              ].map(([term, description]) => <div key={term} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{term}</dt><dd className="mt-1 break-words font-medium text-slate-900">{description}</dd></div>)}
            </dl>
          ) : <p className="mt-6 text-sm text-slate-500">Runtime status is unavailable.</p>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-primary" size={22} />
            <div><h2 className="text-lg font-semibold text-slate-950">Governance boundaries</h2><p className="text-sm text-slate-500">Controls that remain enforced</p></div>
          </div>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {[
              ["Evidence validation", "Structured output and citations are checked before use.", FileCheck2],
              ["Proposal authority", "MongoDB remains authoritative; AI cannot publish.", Database],
              ["Pricing safety", "Investment values come from approved deterministic pricing.", CircleDollarSign],
              ["Failure isolation", "Failed and orphaned attempts remain visible in the ledger.", XCircle],
            ].map(([title, text, Icon]) => (
              <li key={String(title)} className="flex gap-3 rounded-xl border border-slate-100 p-4">
                <Icon className="mt-0.5 shrink-0 text-primary" size={18} />
                <span><strong className="block text-slate-900">{String(title)}</strong>{String(text)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-lg font-semibold text-slate-950">Usage by capability</h2><p className="text-sm text-slate-500">Last {usage?.windowDays ?? 30} days, grouped by durable run type and operation</p></div>
          <p className="text-xs text-slate-500">Tokens: input / output</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Capability</th><th className="px-4 py-3">Operation</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Tokens</th></tr></thead>
            <tbody>
              {usage?.operations.length ? usage.operations.map((row) => (
                <tr key={`${row.runType}-${row.operation}-${row.state}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{label(row.runType)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{label(row.operation)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(row.state)}`}>{label(row.state)}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{number.format(row.attempts)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{number.format(row.inputTokens)} / {number.format(row.outputTokens)}</td>
                </tr>
              )) : <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No provider usage has been recorded in this window.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div><h2 className="text-lg font-semibold text-slate-950">Recent provider attempts</h2><p className="text-sm text-slate-500">Latest 50 content-free ledger entries</p></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Capability</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Tokens in / out</th><th className="px-4 py-3">Started</th></tr></thead>
            <tbody>
              {usage?.recentAttempts.length ? usage.recentAttempts.map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} />) : <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">No provider attempts recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div><h2 className="text-lg font-semibold text-slate-950">Gateway contract runs</h2><p className="text-sm text-slate-500">Synthetic policy and schema test history; proposal operations appear in the provider ledger above.</p></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Operation</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Latency</th><th className="px-4 py-3">Created</th></tr></thead>
            <tbody>
              {runs.length ? runs.map((run) => <tr key={run.id} className="border-t border-slate-100"><td className="px-4 py-3"><p className="font-medium text-slate-900">{label(run.operation)}</p><p className="text-xs text-slate-500">{run.promptVersion} · {run.schemaVersion}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(run.status)}`}>{label(run.status)}</span></td><td className="px-4 py-3 text-sm text-slate-600">{run.provider} / {run.model}</td><td className="px-4 py-3 text-sm text-slate-600">{run.latencyMs === null ? "—" : `${number.format(run.latencyMs)} ms`}</td><td className="px-4 py-3 text-sm text-slate-600">{date.format(new Date(run.createdAt))}</td></tr>) : <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No gateway contract runs recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        {usage?.note && <p className="mt-4 text-xs text-slate-500">{usage.note}</p>}
      </section>
    </main>
  );
}

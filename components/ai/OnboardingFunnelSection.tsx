import { Rocket, ShieldCheck } from "lucide-react";
import type {
  OnboardingFunnelReport,
  OnboardingMilestone,
} from "@/app/actions/aiOperations";

// Two milestones for new accounts, first message and first draft, each as a
// share of accounts that reached it inside the activation window and as
// time from account start. Aggregate-only and sample protected, like the
// Assistant Quality section above it.

const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const percent = (value: number | null) =>
  value === null ? "Protected" : `${Math.round(value * 100)}%`;
const count = (value: number | null) =>
  value === null ? "Protected" : number.format(value);
const hours = (value: number | null) => {
  if (value === null) return "Protected";
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 48) return `${value.toFixed(1)} h`;
  return `${(value / 24).toFixed(1)} d`;
};
const safeDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : date.format(parsed);
};

const Tile = ({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-[#283c4a] dark:bg-[#0b1721]">
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {title}
    </p>
    <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
      {value}
    </p>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
  </div>
);

const Milestone = ({
  title,
  definition,
  milestone,
  windowDays,
}: {
  title: string;
  definition: string;
  milestone: OnboardingMilestone;
  windowDays: number;
}) => (
  <div>
    <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
      {title}
    </h3>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
      {definition}
    </p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        title={`Within ${windowDays} days`}
        value={percent(milestone.withinWindowRate)}
        note={`${count(milestone.withinWindow)} of matured accounts`}
      />
      <Tile
        title="Reached at any time"
        value={count(milestone.reachedEver)}
        note="Accounts in the window"
      />
      <Tile
        title="Median time"
        value={hours(milestone.p50Hours)}
        note="From account start"
      />
      <Tile
        title="90th percentile"
        value={hours(milestone.p90Hours)}
        note="From account start"
      />
    </div>
  </div>
);

export default function OnboardingFunnelSection({
  report,
}: {
  report: OnboardingFunnelReport | null;
}) {
  return (
    <section
      aria-labelledby="onboarding-funnel-title"
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-[#283c4a] dark:bg-[#0d1d28]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-[#009ca4] dark:bg-cyan-500/10 dark:text-cyan-300">
            <Rocket size={20} />
          </span>
          <div>
            <h2
              id="onboarding-funnel-title"
              className="text-lg font-semibold text-slate-950 dark:text-slate-50"
            >
              Onboarding funnel
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {report
                ? `Accounts started ${safeDate(report.window.from)} to ${safeDate(report.window.to)} · ${report.window.days} days`
                : "New accounts, first message, first draft"}
            </p>
          </div>
        </div>
        {report && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-[#132633] dark:text-slate-300">
            <ShieldCheck size={13} aria-hidden />
            Aggregate only · minimum sample {report.privacy.minimumSampleSize}
          </p>
        )}
      </div>

      {!report ? (
        <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
          Onboarding funnel data is unavailable for this window.
        </p>
      ) : (
        <>
          {report.privacy.sampleProtected && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100"
            >
              <p className="font-semibold">Sample protected</p>
              <p className="mt-1">
                Fewer than {report.privacy.minimumSampleSize} accounts started in
                this window. Counts and rates stay hidden until the threshold
                is met.
              </p>
            </div>
          )}

          <div
            className="mt-5 grid gap-3 sm:grid-cols-3"
            aria-label="Accounts in window"
          >
            <Tile
              title="Accounts started"
              value={count(report.accounts.started)}
              note="Tenant records created in the window"
            />
            <Tile
              title="Matured"
              value={count(report.accounts.matured)}
              note={`Old enough for the full ${report.activationWindowDays}-day window`}
            />
            <Tile
              title="Not yet matured"
              value={count(report.accounts.notYetMatured)}
              note={
                report.accounts.legacyExcluded > 0
                  ? `${number.format(report.accounts.legacyExcluded)} backfilled legacy account(s) excluded`
                  : "Too recent to judge against the window"
              }
            />
          </div>

          <div className="mt-6 grid gap-6">
            <Milestone
              title="First message sent"
              definition={report.definitions.firstMessage}
              milestone={report.firstMessage}
              windowDays={report.activationWindowDays}
            />
            <Milestone
              title="First draft generated"
              definition={report.definitions.firstDraft}
              milestone={report.firstDraft}
              windowDays={report.activationWindowDays}
            />
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {report.definitions.accountStart} {report.definitions.withinWindow}
          </p>
        </>
      )}
    </section>
  );
}

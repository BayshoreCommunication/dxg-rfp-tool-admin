import { AlarmClock, Clock, Inbox, UserRoundX, Hourglass, CheckCircle2 } from "lucide-react";
import { getSupportMetricsAction } from "@/app/actions/supportDesk";
import { formatDuration } from "./supportLabels";

const Card = ({
  title,
  value,
  note,
  icon,
  tone,
}: {
  title: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
  tone: string;
}) => (
  <article className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-[#dce5ee] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.05em] text-slate-500">{title}</h3>
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
    </div>
    <div>
      <p className="text-[28px] font-extrabold leading-none tracking-[-0.03em] text-[#10203a] dark:text-slate-50">
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </p>
      <p className="mt-1.5 text-xs font-medium text-slate-400">{note}</p>
    </div>
  </article>
);

export default async function SupportMetricsCards({ compact = false }: { compact?: boolean }) {
  const result = await getSupportMetricsAction();
  if (!result.ok) {
    return (
      <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
        Support metrics are unavailable: {result.error}
      </p>
    );
  }
  const metrics = result.data;
  const busiest = [...metrics.perAgent].sort((a, b) => b.openTickets - a.openTickets).slice(0, 4);
  return (
    <section aria-label="Support metrics" className="space-y-3">
      <div className={`grid grid-cols-2 gap-4 ${compact ? "xl:grid-cols-5" : "xl:grid-cols-6"}`}>
        <Card
          title="Overdue"
          value={metrics.overdue ?? 0}
          note="Past their reply target"
          icon={<AlarmClock className="h-4 w-4" aria-hidden="true" />}
          tone={(metrics.overdue ?? 0) > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"}
        />
        <Card
          title="Open"
          value={metrics.open}
          note={`${metrics.unreadForAgents} unread customer message${metrics.unreadForAgents === 1 ? "" : "s"}`}
          icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
          tone="bg-amber-50 text-amber-600"
        />
        <Card
          title="Waiting on customer"
          value={metrics.waitingOnCustomer}
          note="Answered, awaiting their reply"
          icon={<Hourglass className="h-4 w-4" aria-hidden="true" />}
          tone="bg-sky-50 text-sky-600"
        />
        <Card
          title="Unassigned"
          value={metrics.unassigned}
          note="Active tickets without an owner"
          icon={<UserRoundX className="h-4 w-4" aria-hidden="true" />}
          tone="bg-rose-50 text-rose-600"
        />
        <Card
          title="First response"
          value={formatDuration(metrics.averageFirstResponseMs)}
          note="Average, all time"
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          tone="bg-[#eaf9f8] text-[#0b7f85]"
        />
        {!compact && (
          <Card
            title="Resolution"
            value={formatDuration(metrics.averageResolutionMs)}
            note={`${metrics.resolved + metrics.closed} resolved or closed`}
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            tone="bg-emerald-50 text-emerald-600"
          />
        )}
      </div>
      {!compact && busiest.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-bold uppercase tracking-[0.05em]">Open per agent</span>
          {busiest.map((row) => (
            <span
              key={row.agentUserId}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 dark:border-[#253746] dark:text-slate-300"
            >
              {row.agent?.name ?? "Unknown agent"} · {row.openTickets}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

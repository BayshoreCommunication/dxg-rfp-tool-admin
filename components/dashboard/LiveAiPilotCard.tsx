import { getLiveAiPilotStatus } from "@/app/actions/liveAiPilot";
import {
  Activity,
  Box,
  Coins,
  FileText,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

type StatusTone = "positive" | "warning" | "muted";

const valueClass: Record<StatusTone, string> = {
  positive: "text-emerald-600",
  warning: "text-amber-600",
  muted: "text-slate-500",
};

export default async function LiveAiPilotCard() {
  const status = await getLiveAiPilotStatus();
  const enabled = Boolean(status?.enabled && !status.killSwitch);
  const stateLabel = !status
    ? "Unavailable"
    : status.killSwitch
      ? "Stopped"
      : status.enabled
        ? "Enabled"
        : "Disabled";

  const rows = [
    {
      label: "Status",
      value: stateLabel,
      icon: Activity,
      tone: enabled ? "positive" : "warning",
    },
    {
      label: "Provider / Model",
      value: status ? `${status.provider} / ${status.model}` : "Unavailable",
      icon: Box,
      tone: status ? "muted" : "warning",
    },
    {
      label: "Credentials",
      value: status?.credentialConfigured ? "Configured" : "Not configured",
      icon: KeyRound,
      tone: status?.credentialConfigured ? "positive" : "warning",
    },
    {
      label: "Token ceiling",
      value: status
        ? `${status.inputTokenLimit.toLocaleString()} in / ${status.outputTokenLimit.toLocaleString()} out`
        : "Unavailable",
      icon: Coins,
      tone: "muted",
    },
    {
      label: "Synthetic access",
      value: status?.syntheticEnabled ? "Allowed" : "Disabled",
      icon: ShieldCheck,
      tone: status?.syntheticEnabled ? "positive" : "warning",
    },
    {
      label: "Non-confidential access",
      value: status?.nonConfidentialEnabled ? "Allowed" : "Disabled",
      icon: LockKeyhole,
      tone: status?.nonConfidentialEnabled ? "positive" : "warning",
    },
    {
      label: "Proposal-source access",
      value: status?.proposalSourceEnabled ? "Allowed" : "Disabled",
      icon: FileText,
      tone: status?.proposalSourceEnabled ? "positive" : "warning",
    },
  ] as const;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">Live AI pilot</h2>
          <p className="mt-1 text-sm text-slate-500">Content-free operational readiness</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
            enabled
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {stateLabel}
        </span>
      </div>

      <dl className="grid flex-1 grid-rows-7 divide-y divide-slate-100 px-5 sm:px-6">
        {rows.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="grid h-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
            <dt className="flex min-w-0 items-center gap-3 text-sm font-medium text-[#34445f]">
              <Icon className="h-5 w-5 shrink-0 text-[#00aeb5]" strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
            </dt>
            <dd className={`max-w-[170px] text-right text-sm font-semibold leading-snug ${valueClass[tone as StatusTone]}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

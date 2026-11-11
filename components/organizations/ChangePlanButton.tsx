"use client";

import {
  changeOrganizationPlanAction,
  getOrganizationPlanAction,
} from "@/app/actions/organizationPlans";
import { toast } from "@/components/ui/Toast";
import {
  PLAN_NOTE_MAX_LENGTH,
  planChangeEffects,
  planChangeLine,
  planFeaturesLabel,
  planLabel,
  planLimitLabel,
  usageLabel,
  type OrganizationPlanItem,
  type PlanChange,
  type PlanOption,
} from "@/lib/organizationPlans";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  organization: OrganizationPlanItem;
  plans: PlanOption[];
};

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function ChangePlanButton({ organization: listed, plans }: Props) {
  const router = useRouter();
  const titleId = useId();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  // The list row can be stale; once the dialog has loaded the organization, that copy is used.
  const [fresh, setFresh] = useState<OrganizationPlanItem | null>(null);
  const organization = fresh ?? listed;
  const [selected, setSelected] = useState(listed.plan);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<PlanChange[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  // The dialog opens on the organization's current plan, with its change history loaded fresh.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    getOrganizationPlanAction(listed.id)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setHistoryError(result.error);
          return;
        }
        setHistory(result.data.history);
        setFresh(result.data.organization);
        // Follow the current plan unless staff already picked another one.
        setSelected((current) => (current === listed.plan ? result.data.organization.plan : current));
      })
      .catch(() => {
        if (!cancelled) setHistoryError("The plan history couldn't be loaded.");
      });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingRef.current) {
        setOpen(false);
        return;
      }
      // Keep Tab inside the dialog so the page behind it can't be operated.
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled])"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open, listed.id, listed.plan]);

  const openDialog = () => {
    setFresh(null);
    setSelected(listed.plan);
    setNote("");
    setError("");
    setHistory(null);
    setHistoryError("");
    setOpen(true);
  };

  const target = plans.find((plan) => plan.id === selected) ?? null;
  const isChange = target !== null && target.id !== organization.plan;

  const save = async () => {
    if (!target || !isChange || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await changeOrganizationPlanAction(organization.id, target.id, note);
      if (!result.ok) {
        setError(result.error);
        // Someone else changed it: show the list as it now is behind the dialog.
        if (result.code === "PLAN_CHANGE_CONFLICT") router.refresh();
        return;
      }
      const label = planLabel(result.data.organization.plan);
      if (result.data.changed === false) {
        toast.alert(`${organization.name} was already on ${label}. Nothing was changed.`);
      } else {
        toast.success(`${organization.name} is now on ${label}.`);
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("The plan change couldn't be confirmed. Reload the page to see the current plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#34445f] transition-colors hover:border-[#00aeb5] hover:text-[#008f96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5]"
        aria-label={`Change plan for ${organization.name}`}
      >
        <SlidersHorizontal size={12} aria-hidden="true" />
        Change plan
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={saving ? undefined : () => setOpen(false)}
          />
          <div ref={panelRef} className="relative z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0">
                <h2 id={titleId} className="break-words text-lg font-bold text-[#12213a]">
                  Change plan for {organization.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Now on {planLabel(organization.plan)} · {usageLabel(organization.proposals)}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <fieldset disabled={saving}>
                <legend className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                  Plan
                </legend>
                <div className="mt-2 space-y-2">
                  {plans.map((plan) => {
                    const checked = selected === plan.id;
                    return (
                      <label
                        key={plan.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                          checked
                            ? "border-[#00aeb5] bg-[#eaf9f8]"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`plan-${organization.id}`}
                          value={plan.id}
                          checked={checked}
                          onChange={() => {
                            setSelected(plan.id);
                            setError("");
                          }}
                          className="mt-1 h-4 w-4 accent-[#00aeb5]"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#20304b]">
                            {planLabel(plan.id)}
                            {plan.id === organization.plan ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.045em] text-slate-500">
                                Current
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {planLimitLabel(plan)} · {planFeaturesLabel(plan.features)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {isChange && target ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" aria-live="polite">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                    What changes for {organization.name}
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-200">
                    {planChangeEffects(organization, target).map((effect) => (
                      <li key={effect}>{effect}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <label htmlFor={noteId} className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                  Note (optional)
                </label>
                <textarea
                  id={noteId}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={PLAN_NOTE_MAX_LENGTH}
                  rows={2}
                  disabled={saving}
                  placeholder="Why the plan is changing. Saved with the audit record."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#20304b] outline-none transition placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60"
                />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                  Plan history
                </p>
                {historyError ? (
                  <p className="mt-2 text-xs text-rose-600">{historyError}</p>
                ) : history === null ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                    Loading history
                  </p>
                ) : history.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No plan changes yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {history.map((change, index) => (
                      <li key={`${change.at}-${index}`} className="px-3.5 py-2.5">
                        <p className="text-xs font-bold text-[#34445f]">{planChangeLine(change)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDateTime(change.at)} · {change.changedBy?.name || "RFPilot staff"}
                        </p>
                        {change.note ? (
                          <p className="mt-1 break-words text-xs text-slate-500">“{change.note}”</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              {error ? (
                <p role="alert" className="mb-3 text-sm font-medium text-rose-600">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!isChange || saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#00aeb5] px-5 text-sm font-bold text-white transition hover:bg-[#009ca4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                  {saving ? "Saving" : isChange && target ? `Change to ${planLabel(target.id)}` : "Change plan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";
import {
  createExpertRuleAction,
  createPricingRecordAction,
  deletePricingRecordAction,
  listExpertRulesAction,
  listPricingRecordsAction,
  setExpertRuleStatusAction,
  setPricingRecordStatusAction,
  updateExpertRuleAction,
  updatePricingRecordAction,
  type ExpertRule,
  type PricingRecord,
  type RuleCondition,
  type RuleEffect,
} from "@/app/actions/pricing";
import { useEffect, useState } from "react";

const CATEGORIES = [
  "audio", "video", "lighting", "staging", "led_wall", "projection", "breakout_room", "general_session",
  "labor", "rigging", "power", "trucking_freight", "travel_per_diem", "venue_fee", "insurance", "service_charge_tax", "other",
] as const;
const UNITS = ["per_day", "per_event", "per_hour", "per_person", "per_room", "flat"] as const;
const DAY_TYPES = ["any", "standard", "overtime", "holiday"] as const;
const OPS = ["eq", "neq", "gte", "lte", "contains", "filled", "empty"] as const;
const OP_LABELS: Record<string, string> = {
  eq: "equals", neq: "does not equal", gte: "is at least", lte: "is at most",
  contains: "contains", filled: "is filled in", empty: "is empty",
};

const labelize = (value: string) =>
  value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
const toMajor = (minor: number) => (minor / 100).toFixed(2);
const toMinor = (major: FormDataEntryValue | null) => Math.round(Number(major || 0) * 100);

const statusTones: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-emerald-100 text-emerald-800",
  active: "bg-emerald-100 text-emerald-800",
  retired: "bg-slate-200 text-slate-500",
};
const StatusChip = ({ status }: { status: string }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusTones[status] ?? "bg-slate-100 text-slate-700"}`}>
    {status}
  </span>
);
const RevisionChip = ({ revision }: { revision: number }) => (
  <span className="inline-block rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
    rev {revision}
  </span>
);

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm";
const primaryButton = "rounded-lg bg-[#103B4C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const subtleButton = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

/* ------------------------------- Pricing records ------------------------------- */

function RecordForm({
  initial, busy, onSubmit, onCancel,
}: {
  initial?: PricingRecord;
  busy: boolean;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const submit = (form: FormData) => {
    onSubmit({
      category: form.get("category"),
      itemLabel: form.get("itemLabel"),
      unit: form.get("unit"),
      amountLowMinor: toMinor(form.get("amountLow")),
      amountMidMinor: toMinor(form.get("amountMid")),
      amountHighMinor: toMinor(form.get("amountHigh")),
      currency: String(form.get("currency") || "").toUpperCase(),
      market: form.get("market") || null,
      dayType: form.get("dayType"),
      laborRole: form.get("laborRole") || null,
      sourceNote: form.get("sourceNote") || "",
    });
  };
  return (
    <form action={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Item label
          <input name="itemLabel" required maxLength={200} defaultValue={initial?.itemLabel} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">Category
          <select name="category" defaultValue={initial?.category ?? "audio"} className={inputClass}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Unit
          <select name="unit" defaultValue={initial?.unit ?? "per_day"} className={inputClass}>
            {UNITS.map((unit) => <option key={unit} value={unit}>{labelize(unit)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Currency
          <input name="currency" required pattern="[A-Za-z]{3}" defaultValue={initial?.currency ?? "USD"} className={`${inputClass} uppercase`} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">Low
          <input name="amountLow" type="number" min="0" step="0.01" required defaultValue={initial ? toMajor(initial.amountLowMinor) : ""} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">Typical
          <input name="amountMid" type="number" min="0" step="0.01" required defaultValue={initial ? toMajor(initial.amountMidMinor) : ""} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">High
          <input name="amountHigh" type="number" min="0" step="0.01" required defaultValue={initial ? toMajor(initial.amountHighMinor) : ""} className={inputClass} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">Market
          <input name="market" maxLength={100} defaultValue={initial?.market ?? ""} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">Day type
          <select name="dayType" defaultValue={initial?.dayType ?? "any"} className={inputClass}>
            {DAY_TYPES.map((dayType) => <option key={dayType} value={dayType}>{labelize(dayType)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Labor role
          <input name="laborRole" maxLength={100} defaultValue={initial?.laborRole ?? ""} className={inputClass} />
        </label>
      </div>
      <label className="block text-sm font-medium">Source note
        <textarea name="sourceNote" maxLength={500} defaultValue={initial?.sourceNote ?? ""} rows={2} className={inputClass}
          placeholder="Where this price came from (price sheet, contract, past event)…" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>{initial ? "Save changes" : "Create draft record"}</button>
        {onCancel && <button type="button" onClick={onCancel} className={subtleButton}>Cancel</button>}
      </div>
    </form>
  );
}

function PricingRecordsTab() {
  const [records, setRecords] = useState<PricingRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    void listPricingRecordsAction({ status: statusFilter || undefined, category: categoryFilter || undefined }).then((result) => {
      if (!active) return;
      if (result.success) setRecords(result.data);
      else setError(result.message);
    });
    return () => { active = false; };
  }, [statusFilter, categoryFilter, refreshTick]);

  const run = async (work: () => Promise<{ success: boolean; message?: string }>, done: string) => {
    setBusy(true); setError(""); setNotice("");
    const result = await work();
    setBusy(false);
    if (!result.success) { setError(result.message ?? "The operation failed."); return false; }
    setNotice(done);
    setRefreshTick((tick) => tick + 1);
    return true;
  };

  const create = (input: Record<string, unknown>) =>
    void run(() => createPricingRecordAction(input), "Draft pricing record created.");
  const update = (record: PricingRecord) => (input: Record<string, unknown>) =>
    void run(() => updatePricingRecordAction(record.id, input, record.revision), "Pricing record updated.").then((ok) => { if (ok) setEditingId(null); });
  const approve = (record: PricingRecord) => {
    if (!window.confirm(`Approve "${record.itemLabel}"? Approved records become locked and are used to build investment guidance.`)) return;
    void run(() => setPricingRecordStatusAction(record.id, "approved"), "Pricing record approved.");
  };
  const retire = (record: PricingRecord) =>
    void run(() => setPricingRecordStatusAction(record.id, "retired"), "Pricing record retired.");
  const restore = (record: PricingRecord) => {
    if (!window.confirm(`Restore "${record.itemLabel}" to draft? It will become editable and will not be used in investment guidance until approved again.`)) return;
    void run(() => setPricingRecordStatusAction(record.id, "draft"), "Pricing record restored to draft.");
  };
  const remove = (record: PricingRecord) => {
    if (!window.confirm(`Permanently delete "${record.itemLabel}"? This cannot be undone.`)) return;
    void run(() => deletePricingRecordAction(record.id), "Retired pricing record permanently deleted.");
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="self-start rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">New pricing record</h2>
        <p className="mt-1 text-sm text-slate-500">Amounts are entered in major units (e.g. dollars) as Low / Typical / High.</p>
        <div className="mt-4">
          <RecordForm busy={busy} onSubmit={create} />
        </div>
      </section>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Pricing records</h2>
          <div className="flex gap-2">
            <label className="block text-xs font-medium text-slate-600">Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="retired">Retired</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">Category
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}>
                <option value="">All</option>
                {CATEGORIES.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
              </select>
            </label>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Unit</th>
                <th className="py-2 pr-3 text-right">Low</th>
                <th className="py-2 pr-3 text-right">Typical</th>
                <th className="py-2 pr-3 text-right">High</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-slate-500">No pricing records match these filters.</td></tr>
              )}
              {records.map((record) => (
                <RecordRows
                  key={record.id}
                  record={record}
                  busy={busy}
                  editing={editingId === record.id}
                  onEdit={() => { setEditingId(record.id); setNotice(""); setError(""); }}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={update(record)}
                  onApprove={() => approve(record)}
                  onRetire={() => retire(record)}
                  onRestore={() => restore(record)}
                  onDelete={() => remove(record)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RecordRows({
  record, busy, editing, onEdit, onCancelEdit, onSave, onApprove, onRetire, onRestore, onDelete,
}: {
  record: PricingRecord;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: Record<string, unknown>) => void;
  onApprove: () => void;
  onRetire: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr className="border-b align-top">
        <td className="py-2 pr-3">
          <span className="font-medium text-slate-900">{record.itemLabel}</span>
          {record.sourceNote && <span className="mt-0.5 block text-xs text-slate-500">{record.sourceNote}</span>}
        </td>
        <td className="py-2 pr-3">{labelize(record.category)}</td>
        <td className="py-2 pr-3">{labelize(record.unit)}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{toMajor(record.amountLowMinor)}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{toMajor(record.amountMidMinor)}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{toMajor(record.amountHighMinor)} {record.currency}</td>
        <td className="py-2 pr-3"><span className="flex flex-wrap gap-1"><StatusChip status={record.status} /><RevisionChip revision={record.revision} /></span></td>
        <td className="py-2">
          <span className="flex flex-wrap gap-1.5">
            {record.status === "draft" && (
              <>
                <button type="button" disabled={busy} onClick={editing ? onCancelEdit : onEdit} className={subtleButton}>{editing ? "Close" : "Edit"}</button>
                <button type="button" disabled={busy} onClick={onApprove} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve</button>
              </>
            )}
            {record.status !== "retired" && (
              <button type="button" disabled={busy} onClick={onRetire} className={subtleButton}>Retire</button>
            )}
            {record.status === "retired" && (
              <>
                <button type="button" disabled={busy} onClick={onRestore} className={subtleButton}>Restore to draft</button>
                <button type="button" disabled={busy} onClick={onDelete} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Delete</button>
              </>
            )}
          </span>
        </td>
      </tr>
      {editing && (
        <tr className="border-b bg-slate-50">
          <td colSpan={8} className="p-4">
            <RecordForm initial={record} busy={busy} onSubmit={onSave} onCancel={onCancelEdit} />
          </td>
        </tr>
      )}
    </>
  );
}

/* -------------------------------- Expert rules --------------------------------- */

type ConditionDraft = { path: string; op: string; value: string };

const conditionSentence = (condition: RuleCondition) => {
  const op = OP_LABELS[condition.op] ?? condition.op;
  return condition.op === "filled" || condition.op === "empty"
    ? `${condition.path} ${op}`
    : `${condition.path} ${op} ${String(condition.value ?? "")}`;
};
const rulePreview = (conditions: RuleCondition[], effect: RuleEffect) => {
  const when = conditions.length ? `When ${conditions.map(conditionSentence).join(" and ")}` : "Always";
  const suffix = effect.kind === "cost_factor" && typeof effect.factorPercent === "number"
    ? ` (adjust ${effect.category ? labelize(effect.category) : "all categories"} by ${effect.factorPercent > 0 ? "+" : ""}${effect.factorPercent}%)`
    : "";
  return `${when} → ${effect.guidanceText}${suffix}`;
};

function RuleForm({
  initial, busy, onSubmit, onCancel,
}: {
  initial?: ExpertRule;
  busy: boolean;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const [ruleKey, setRuleKey] = useState(initial?.ruleKey ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [conditions, setConditions] = useState<ConditionDraft[]>(
    (initial?.conditions ?? []).map((condition) => ({
      path: condition.path.replace(/^\/content\//, ""),
      op: condition.op,
      value: condition.value == null ? "" : String(condition.value),
    })),
  );
  const [kind, setKind] = useState<RuleEffect["kind"]>(initial?.effect.kind ?? "recommendation");
  const [category, setCategory] = useState(initial?.effect.category ?? "");
  const [guidanceText, setGuidanceText] = useState(initial?.effect.guidanceText ?? "");
  const [factorPercent, setFactorPercent] = useState(
    typeof initial?.effect.factorPercent === "number" ? String(initial.effect.factorPercent) : "",
  );

  const setCondition = (index: number, patch: Partial<ConditionDraft>) =>
    setConditions((current) => current.map((condition, at) => (at === index ? { ...condition, ...patch } : condition)));

  const builtConditions = (): RuleCondition[] =>
    conditions.map((condition) => {
      const valueless = condition.op === "filled" || condition.op === "empty";
      const trimmed = condition.value.trim();
      const value = valueless ? null : trimmed !== "" && !Number.isNaN(Number(trimmed)) ? Number(trimmed) : trimmed;
      return { path: `/content/${condition.path.replace(/^\/?(content\/)?/, "")}`, op: condition.op, value };
    });

  const preview = rulePreview(builtConditions(), {
    kind, category: category || null, guidanceText: guidanceText || "…",
    factorPercent: factorPercent === "" ? null : Number(factorPercent),
  });

  const submit = () => {
    onSubmit({
      ruleKey,
      title,
      explanation,
      conditions: builtConditions(),
      effect: {
        kind,
        category: category || null,
        guidanceText,
        ...(kind === "cost_factor" ? { factorPercent: Number(factorPercent) } : {}),
      },
    });
  };

  return (
    <form action={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Rule key
          <input value={ruleKey} onChange={(event) => setRuleKey(event.target.value)} required disabled={Boolean(initial)}
            pattern="[a-z0-9_-]{3,80}" title="3-80 lowercase letters, digits, underscores or hyphens"
            className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`} placeholder="union_venue_labor_uplift" />
          {initial && <span className="mt-1 block text-xs text-slate-500">The rule key cannot change after creation.</span>}
        </label>
        <label className="block text-sm font-medium">Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className={inputClass} />
        </label>
      </div>
      <label className="block text-sm font-medium">Explanation
        <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={1000} rows={2} className={inputClass}
          placeholder="Why this rule exists — shown to proposal owners alongside the guidance." />
      </label>
      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold">Conditions</legend>
        {conditions.length === 0 && <p className="text-xs text-slate-500">No conditions — the rule always applies.</p>}
        <div className="space-y-2">
          {conditions.map((condition, index) => {
            const valueless = condition.op === "filled" || condition.op === "empty";
            return (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <span className="flex items-center rounded-lg border border-slate-300 bg-slate-50 text-sm">
                  <span className="px-2 py-2 text-slate-500">/content/</span>
                  <input value={condition.path} onChange={(event) => setCondition(index, { path: event.target.value })}
                    required aria-label={`Condition ${index + 1} path`} placeholder="venueSchedule/isUnionVenue"
                    className="w-56 rounded-r-lg border-l border-slate-300 bg-white p-2 text-sm" />
                </span>
                <select value={condition.op} aria-label={`Condition ${index + 1} operator`}
                  onChange={(event) => setCondition(index, { op: event.target.value })}
                  className="rounded-lg border border-slate-300 p-2 text-sm">
                  {OPS.map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
                </select>
                {!valueless && (
                  <input value={condition.value} onChange={(event) => setCondition(index, { value: event.target.value })}
                    required aria-label={`Condition ${index + 1} value`} placeholder="value"
                    className="w-36 rounded-lg border border-slate-300 p-2 text-sm" />
                )}
                <button type="button" onClick={() => setConditions((current) => current.filter((_, at) => at !== index))}
                  className={subtleButton}>Remove</button>
              </div>
            );
          })}
        </div>
        <button type="button" disabled={conditions.length >= 20}
          onClick={() => setConditions((current) => [...current, { path: "", op: "filled", value: "" }])}
          className={`mt-2 ${subtleButton}`}>Add condition</button>
      </fieldset>
      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold">Effect</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">Kind
            <select value={kind} onChange={(event) => setKind(event.target.value as RuleEffect["kind"])} className={inputClass}>
              <option value="recommendation">Recommendation</option>
              <option value="cost_factor">Cost factor</option>
              <option value="ancillary_flag">Ancillary flag</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Category (optional)
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
              <option value="">Any</option>
              {CATEGORIES.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
            </select>
          </label>
          {kind === "cost_factor" && (
            <label className="block text-sm font-medium">Factor percent
              <input type="number" min="-50" max="100" step="0.1" required value={factorPercent}
                onChange={(event) => setFactorPercent(event.target.value)} className={inputClass} placeholder="e.g. 20 for +20%" />
            </label>
          )}
        </div>
        <label className="mt-3 block text-sm font-medium">Guidance text
          <textarea value={guidanceText} onChange={(event) => setGuidanceText(event.target.value)} required maxLength={500} rows={2}
            className={inputClass} placeholder="Plain-language guidance shown to proposal owners." />
        </label>
      </fieldset>
      <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
        <span className="font-semibold">Preview:</span> {preview}
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>{initial ? "Save changes" : "Create draft rule"}</button>
        {onCancel && <button type="button" onClick={onCancel} className={subtleButton}>Cancel</button>}
      </div>
    </form>
  );
}

function ExpertRulesTab() {
  const [rules, setRules] = useState<ExpertRule[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    void listExpertRulesAction({ status: statusFilter || undefined }).then((result) => {
      if (!active) return;
      if (result.success) setRules(result.data);
      else setError(result.message);
    });
    return () => { active = false; };
  }, [statusFilter, refreshTick]);

  const run = async (work: () => Promise<{ success: boolean; message?: string }>, done: string) => {
    setBusy(true); setError(""); setNotice("");
    const result = await work();
    setBusy(false);
    if (!result.success) { setError(result.message ?? "The operation failed."); return false; }
    setNotice(done);
    setRefreshTick((tick) => tick + 1);
    return true;
  };

  const create = (input: Record<string, unknown>) =>
    void run(() => createExpertRuleAction(input), "Draft expert rule created.");
  const update = (rule: ExpertRule) => (input: Record<string, unknown>) =>
    void run(() => updateExpertRuleAction(rule.id, input, rule.revision), "Expert rule updated.").then((ok) => { if (ok) setEditingId(null); });
  const activate = (rule: ExpertRule) => {
    if (!window.confirm(`Activate "${rule.title}"? Active rules immediately shape investment guidance for proposal owners.`)) return;
    void run(() => setExpertRuleStatusAction(rule.id, "active"), "Expert rule activated.");
  };
  const retire = (rule: ExpertRule) => {
    if (!window.confirm(`Retire "${rule.title}"? It will stop applying to new guidance runs.`)) return;
    void run(() => setExpertRuleStatusAction(rule.id, "retired"), "Expert rule retired.");
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="self-start rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">New expert rule</h2>
        <p className="mt-1 text-sm text-slate-500">Rules turn DXG expertise into explainable guidance. Every rule shows a plain-language preview.</p>
        <div className="mt-4">
          <RuleForm busy={busy} onSubmit={create} />
        </div>
      </section>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Expert rules</h2>
          <label className="block text-xs font-medium text-slate-600">Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </label>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        <ul className="mt-4 space-y-3">
          {rules.length === 0 && <li className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">No expert rules match this filter.</li>}
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{rule.title}</p>
                  <p className="text-xs text-slate-500">{rule.ruleKey}</p>
                </div>
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusChip status={rule.status} />
                  <RevisionChip revision={rule.revision} />
                  {rule.status === "draft" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => setEditingId(editingId === rule.id ? null : rule.id)} className={subtleButton}>
                        {editingId === rule.id ? "Close" : "Edit"}
                      </button>
                      <button type="button" disabled={busy} onClick={() => activate(rule)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Activate</button>
                    </>
                  )}
                  {rule.status !== "retired" && (
                    <button type="button" disabled={busy} onClick={() => retire(rule)} className={subtleButton}>Retire</button>
                  )}
                </span>
              </div>
              <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{rulePreview(rule.conditions, rule.effect)}</p>
              {rule.explanation && <p className="mt-2 text-xs text-slate-500">{rule.explanation}</p>}
              {editingId === rule.id && (
                <div className="mt-3 border-t pt-3">
                  <RuleForm initial={rule} busy={busy} onSubmit={update(rule)} onCancel={() => setEditingId(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* --------------------------------- Workspace ----------------------------------- */

export default function PricingWorkspace() {
  const [tab, setTab] = useState<"records" | "rules">("records");
  return (
    <main className="p-6 lg:p-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Knowledge administration</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Pricing Knowledge</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Curate the approved pricing records and expert rules that power investment guidance.
          Only approved records and active rules are ever used — guidance never invents a number.
        </p>
      </header>
      <div role="tablist" aria-label="Pricing knowledge sections" className="mt-6 flex gap-2 border-b border-slate-200">
        {([["records", "Pricing records"], ["rules", "Expert rules"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px rounded-t-lg border-x border-t px-4 py-2 text-sm font-semibold ${
              tab === id ? "border-slate-200 bg-white text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "records" ? <PricingRecordsTab /> : <ExpertRulesTab />}
    </main>
  );
}

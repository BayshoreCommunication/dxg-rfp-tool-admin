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
import AdminPageHeader from "@/components/layout/AdminPageHeader";
import SelectBox from "@/components/ui/SelectBox";
import { ChevronLeft, ChevronRight, CircleDollarSign } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
  type UIEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

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
const categoryOptions = CATEGORIES.map((category) => ({
  value: category,
  label: labelize(category),
}));
const unitOptions = UNITS.map((unit) => ({
  value: unit,
  label: labelize(unit),
}));
const dayTypeOptions = DAY_TYPES.map((dayType) => ({
  value: dayType,
  label: labelize(dayType),
}));
const operatorOptions = OPS.map((operator) => ({
  value: operator,
  label: OP_LABELS[operator],
}));
const pricingStatusOptions = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "retired", label: "Retired" },
];
const ruleStatusOptions = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "retired", label: "Retired" },
];
const effectKindOptions = [
  { value: "recommendation", label: "Recommendation" },
  { value: "cost_factor", label: "Cost factor" },
  { value: "ancillary_flag", label: "Ancillary flag" },
];
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

const PricingRecordsSkeleton = () => (
  <>
    {Array.from({ length: 6 }, (_, index) => (
      <tr
        key={index}
        className="border-b border-slate-100 motion-safe:animate-pulse"
        aria-hidden="true"
      >
        <td className="px-3 py-4">
          <span className="block h-3 w-36 rounded-full bg-slate-200" />
          <span className="mt-2 block h-2.5 w-56 rounded-full bg-slate-100" />
        </td>
        <td className="px-3 py-4">
          <span className="block h-3 w-16 rounded-full bg-slate-100" />
        </td>
        <td className="px-3 py-4">
          <span className="block h-3 w-14 rounded-full bg-slate-100" />
        </td>
        {Array.from({ length: 3 }, (_, amountIndex) => (
          <td key={amountIndex} className="px-3 py-4">
            <span className="ml-auto block h-3 w-12 rounded-full bg-slate-100" />
          </td>
        ))}
        <td className="px-3 py-4">
          <span className="block h-5 w-16 rounded-full bg-slate-100" />
        </td>
        <td className="px-3 py-4">
          <span className="block h-8 w-14 rounded-lg bg-slate-100" />
        </td>
      </tr>
    ))}
  </>
);

const PricingRecordsMobileSkeleton = () => (
  <div
    className="divide-y divide-slate-100 min-[1420px]:hidden"
    aria-hidden="true"
  >
    {Array.from({ length: 4 }, (_, index) => (
      <div
        key={index}
        className="space-y-4 p-4 motion-safe:animate-pulse"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span className="block h-3.5 w-36 rounded-full bg-slate-200" />
            <span className="block h-2.5 w-52 max-w-full rounded-full bg-slate-100" />
          </div>
          <span className="block h-5 w-16 shrink-0 rounded-full bg-slate-100" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, amountIndex) => (
            <span
              key={amountIndex}
              className="block h-12 rounded-xl bg-slate-100"
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const ExpertRulesSkeleton = () => (
  <>
    {Array.from({ length: 3 }, (_, index) => (
      <li
        key={index}
        className="rounded-xl border border-slate-100 p-4 motion-safe:animate-pulse"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="block h-3.5 w-48 rounded-full bg-slate-200" />
            <span className="block h-2.5 w-28 rounded-full bg-slate-100" />
          </div>
          <span className="block h-6 w-20 rounded-full bg-slate-100" />
        </div>
        <span className="mt-4 block h-12 w-full rounded-lg bg-slate-100" />
        <span className="mt-3 block h-2.5 w-2/3 rounded-full bg-slate-100" />
      </li>
    ))}
  </>
);

const inputClass =
  "mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#20304b] outline-none transition focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10";
const primaryButton =
  "inline-flex h-10 items-center justify-center rounded-xl bg-[#00aeb5] px-4 text-sm font-bold text-white transition hover:bg-[#009ca4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] disabled:cursor-not-allowed disabled:opacity-50";
const subtleButton =
  "inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const PRICING_RECORDS_PAGE_SIZE = 8;
const EXPERT_RULES_PAGE_SIZE = 5;
type PageScrollPosition = "top" | "bottom";

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
    <form action={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Item label
          <input name="itemLabel" required maxLength={200} defaultValue={initial?.itemLabel} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">Category
          <SelectBox
            name="category"
            defaultValue={initial?.category ?? "audio"}
            options={categoryOptions}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">Unit
          <SelectBox
            name="unit"
            defaultValue={initial?.unit ?? "per_day"}
            options={unitOptions}
            className={inputClass}
          />
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
          <SelectBox
            name="dayType"
            defaultValue={initial?.dayType ?? "any"}
            options={dayTypeOptions}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">Labor role
          <input name="laborRole" maxLength={100} defaultValue={initial?.laborRole ?? ""} className={inputClass} />
        </label>
      </div>
      <label className="block text-sm font-medium">Source note
        <textarea name="sourceNote" maxLength={500} defaultValue={initial?.sourceNote ?? ""} rows={3} className={`${inputClass} h-auto py-2.5`}
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsViewportRef = useRef<HTMLDivElement>(null);
  const autoAdvanceLockRef = useRef(false);
  const unlockTimerRef = useRef<number | null>(null);
  const pendingScrollPositionRef = useRef<PageScrollPosition>("top");
  const previousScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void listPricingRecordsAction({ status: statusFilter || undefined, category: categoryFilter || undefined }).then((result) => {
      if (!active) return;
      if (result.success) setRecords(result.data);
      else setError(result.message);
      setIsInitialLoading(false);
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

  const totalPages = Math.max(
    1,
    Math.ceil(records.length / PRICING_RECORDS_PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PRICING_RECORDS_PAGE_SIZE;
  const pageRecords = records.slice(
    pageStart,
    pageStart + PRICING_RECORDS_PAGE_SIZE,
  );
  const firstVisibleRecord = records.length === 0 ? 0 : pageStart + 1;
  const lastVisibleRecord = Math.min(
    pageStart + PRICING_RECORDS_PAGE_SIZE,
    records.length,
  );

  const scheduleUnlock = (delay = 180) => {
    if (unlockTimerRef.current !== null) {
      window.clearTimeout(unlockTimerRef.current);
    }
    unlockTimerRef.current = window.setTimeout(() => {
      autoAdvanceLockRef.current = false;
      unlockTimerRef.current = null;
    }, delay);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const viewport = recordsViewportRef.current;
      if (!viewport) return;

      const top =
        pendingScrollPositionRef.current === "bottom"
          ? Math.max(0, viewport.scrollHeight - viewport.clientHeight)
          : 0;
      viewport.scrollTo({ top, behavior: "auto" });
      previousScrollTopRef.current = top;
    });
    scheduleUnlock(350);

    return () => {
      window.cancelAnimationFrame(frame);
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
    };
  }, [safePage]);

  const changePage = (
    page: number,
    scrollPosition: PageScrollPosition = "top",
  ) => {
    autoAdvanceLockRef.current = true;
    pendingScrollPositionRef.current = scrollPosition;
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    setEditingId(null);
    if (page === safePage) {
      recordsViewportRef.current?.scrollTo({
        top: scrollPosition === "bottom"
          ? recordsViewportRef.current.scrollHeight -
            recordsViewportRef.current.clientHeight
          : 0,
        behavior: "auto",
      });
      scheduleUnlock(180);
    }
  };

  const atViewportStart = (viewport: HTMLDivElement) =>
    viewport.scrollTop <= 1;
  const atViewportEnd = (viewport: HTMLDivElement) =>
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 24;
  const moveByScrollDirection = (
    direction: "up" | "down",
    viewport: HTMLDivElement,
  ) => {
    if (
      autoAdvanceLockRef.current ||
      editingId ||
      (direction === "up" && (safePage <= 1 || !atViewportStart(viewport))) ||
      (direction === "down" &&
        (safePage >= totalPages || !atViewportEnd(viewport)))
    ) {
      return false;
    }

    changePage(
      direction === "up" ? safePage - 1 : safePage + 1,
      direction === "up" ? "bottom" : "top",
    );
    return true;
  };

  const handleRecordsScroll = (event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const currentScrollTop = viewport.scrollTop;
    const direction =
      currentScrollTop > previousScrollTopRef.current
        ? "down"
        : currentScrollTop < previousScrollTopRef.current
          ? "up"
          : null;

    previousScrollTopRef.current = currentScrollTop;
    if (direction) moveByScrollDirection(direction, viewport);
  };
  const handleRecordsWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (autoAdvanceLockRef.current) {
      scheduleUnlock();
      return;
    }

    const direction = event.deltaY < 0 ? "up" : event.deltaY > 0 ? "down" : null;
    if (direction) moveByScrollDirection(direction, event.currentTarget);
  };
  const handleRecordsTouchStart = (
    event: ReactTouchEvent<HTMLDivElement>,
  ) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };
  const handleRecordsTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY;
    touchStartYRef.current = null;
    if (startY == null || endY == null || Math.abs(startY - endY) < 24) return;

    moveByScrollDirection(
      startY > endY ? "down" : "up",
      event.currentTarget,
    );
  };
  const handleRecordsKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const direction =
      event.key === "ArrowUp" || event.key === "PageUp"
        ? "up"
        : event.key === "ArrowDown" || event.key === "PageDown"
          ? "down"
          : null;

    if (direction && moveByScrollDirection(direction, event.currentTarget)) {
      event.preventDefault();
    }
  };

  return (
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:sticky xl:top-6">
        <h2 className="text-lg font-bold text-[#12213a]">New pricing record</h2>
        <p className="mt-1 text-sm text-slate-500">Amounts are entered in major units (e.g. dollars) as Low / Typical / High.</p>
        <div className="mt-4">
          <RecordForm busy={busy} onSubmit={create} />
        </div>
      </section>
      <section className="flex min-w-0 flex-col rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:h-[calc(100dvh-232px)]">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#12213a]">Pricing records</h2>
            <p className="mt-1 text-sm text-slate-500">Review price bands before approving them for guidance.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <label className="block text-xs font-medium text-slate-600">Status
              <SelectBox
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  changePage(1);
                }}
                options={pricingStatusOptions}
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">Category
              <SelectBox
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value);
                  changePage(1);
                }}
                options={[{ value: "", label: "All" }, ...categoryOptions]}
                className={inputClass}
              />
            </label>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        <div
          ref={recordsViewportRef}
          onScroll={handleRecordsScroll}
          onWheel={handleRecordsWheel}
          onTouchStart={handleRecordsTouchStart}
          onTouchEnd={handleRecordsTouchEnd}
          onKeyDown={handleRecordsKeyDown}
          tabIndex={0}
          aria-label="Scrollable pricing records"
          aria-busy={isInitialLoading}
          className="mt-4 max-h-[60dvh] min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#00aeb5] focus-visible:ring-offset-2 [scrollbar-gutter:stable] xl:max-h-none xl:flex-1 min-[1420px]:overflow-auto"
        >
          <table className="hidden w-full min-w-[820px] text-left text-sm min-[1420px]:table">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 bg-[#f8fafc] text-[11px] uppercase tracking-[0.045em] text-slate-500">
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Unit</th>
                <th className="px-3 py-3 text-right">Low</th>
                <th className="px-3 py-3 text-right">Typical</th>
                <th className="px-3 py-3 text-right">High</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isInitialLoading ? <PricingRecordsSkeleton /> : null}
              {!isInitialLoading && records.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No pricing records match these filters.</td></tr>
              )}
              {!isInitialLoading && pageRecords.map((record) => (
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
          {isInitialLoading ? <PricingRecordsMobileSkeleton /> : null}
          {!isInitialLoading && records.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500 min-[1420px]:hidden">
              No pricing records match these filters.
            </div>
          ) : null}
          {!isInitialLoading ? (
            <div className="divide-y divide-slate-100 min-[1420px]:hidden">
              {pageRecords.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  busy={busy}
                  editing={editingId === record.id}
                  onEdit={() => {
                    setEditingId(record.id);
                    setNotice("");
                    setError("");
                  }}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={update(record)}
                  onApprove={() => approve(record)}
                  onRetire={() => retire(record)}
                />
              ))}
            </div>
          ) : null}
        </div>
        <nav
          aria-label="Pricing records pagination"
          className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"
        >
          <div aria-live="polite">
            <p className="text-xs font-medium text-slate-500">
              {isInitialLoading
                ? "Loading pricing records…"
                : `Showing ${firstVisibleRecord}–${lastVisibleRecord} of ${records.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changePage(safePage - 1)}
              disabled={isInitialLoading || safePage === 1}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 transition hover:border-[#b8dfe0] hover:bg-[#f3fbfb] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
              aria-label="Previous pricing records page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <span className="min-w-20 text-center text-xs font-bold text-slate-600">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => changePage(safePage + 1)}
              disabled={isInitialLoading || safePage === totalPages}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 transition hover:border-[#b8dfe0] hover:bg-[#f3fbfb] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
              aria-label="Next pricing records page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
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
      <tr className="border-b border-slate-100 align-top transition hover:bg-[#f8fcfc]">
        <td className="px-3 py-3">
          <span className="font-medium text-slate-900">{record.itemLabel}</span>
          {record.sourceNote && <span className="mt-0.5 block text-xs text-slate-500">{record.sourceNote}</span>}
        </td>
        <td className="px-3 py-3">{labelize(record.category)}</td>
        <td className="px-3 py-3">{labelize(record.unit)}</td>
        <td className="px-3 py-3 text-right tabular-nums">{toMajor(record.amountLowMinor)}</td>
        <td className="px-3 py-3 text-right tabular-nums">{toMajor(record.amountMidMinor)}</td>
        <td className="px-3 py-3 text-right tabular-nums">{toMajor(record.amountHighMinor)} {record.currency}</td>
        <td className="px-3 py-3"><span className="flex flex-wrap gap-1"><StatusChip status={record.status} /><RevisionChip revision={record.revision} /></span></td>
        <td className="px-3 py-3">
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
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={8} className="p-4">
            <RecordForm initial={record} busy={busy} onSubmit={onSave} onCancel={onCancelEdit} />
          </td>
        </tr>
      )}
    </>
  );
}

function RecordCard({
  record,
  busy,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onApprove,
  onRetire,
}: {
  record: PricingRecord;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: Record<string, unknown>) => void;
  onApprove: () => void;
  onRetire: () => void;
}) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">{record.itemLabel}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {labelize(record.category)} · {labelize(record.unit)}
          </p>
        </div>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          <StatusChip status={record.status} />
          <RevisionChip revision={record.revision} />
        </span>
      </div>

      {record.sourceNote ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {record.sourceNote}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Low", record.amountLowMinor],
          ["Typical", record.amountMidMinor],
          ["High", record.amountHighMinor],
        ].map(([label, amount]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {label}
            </dt>
            <dd className="mt-1 text-xs font-bold tabular-nums text-[#20304b]">
              {toMajor(amount as number)}
              {label === "High" ? ` ${record.currency}` : ""}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {record.status === "draft" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={editing ? onCancelEdit : onEdit}
              className={subtleButton}
            >
              {editing ? "Close" : "Edit"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Approve
            </button>
          </>
        ) : null}
        {record.status !== "retired" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRetire}
            className={subtleButton}
          >
            Retire
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <RecordForm
            initial={record}
            busy={busy}
            onSubmit={onSave}
            onCancel={onCancelEdit}
          />
        </div>
      ) : null}
    </article>
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
        <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={1000} rows={2} className={`${inputClass} h-auto py-2.5`}
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
                <SelectBox
                  value={condition.op}
                  ariaLabel={`Condition ${index + 1} operator`}
                  onValueChange={(operator) =>
                    setCondition(index, { op: operator })
                  }
                  options={operatorOptions}
                  className="h-10 w-[160px] rounded-lg border-slate-300 px-2 text-sm"
                />
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
            <SelectBox
              value={kind}
              onValueChange={(nextKind) =>
                setKind(nextKind as RuleEffect["kind"])
              }
              options={effectKindOptions}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">Category (optional)
            <SelectBox
              value={category}
              onValueChange={setCategory}
              options={[{ value: "", label: "Any" }, ...categoryOptions]}
              className={inputClass}
            />
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
            className={`${inputClass} h-auto py-2.5`} placeholder="Plain-language guidance shown to proposal owners." />
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const rulesViewportRef = useRef<HTMLDivElement>(null);
  const autoAdvanceLockRef = useRef(false);
  const unlockTimerRef = useRef<number | null>(null);
  const pendingScrollPositionRef = useRef<PageScrollPosition>("top");
  const previousScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void listExpertRulesAction({ status: statusFilter || undefined }).then((result) => {
      if (!active) return;
      if (result.success) setRules(result.data);
      else setError(result.message);
      setIsInitialLoading(false);
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

  const totalPages = Math.max(
    1,
    Math.ceil(rules.length / EXPERT_RULES_PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * EXPERT_RULES_PAGE_SIZE;
  const pageRules = rules.slice(
    pageStart,
    pageStart + EXPERT_RULES_PAGE_SIZE,
  );
  const firstVisibleRule = rules.length === 0 ? 0 : pageStart + 1;
  const lastVisibleRule = Math.min(
    pageStart + EXPERT_RULES_PAGE_SIZE,
    rules.length,
  );

  const scheduleUnlock = (delay = 180) => {
    if (unlockTimerRef.current !== null) {
      window.clearTimeout(unlockTimerRef.current);
    }
    unlockTimerRef.current = window.setTimeout(() => {
      autoAdvanceLockRef.current = false;
      unlockTimerRef.current = null;
    }, delay);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const viewport = rulesViewportRef.current;
      if (!viewport) return;

      const top =
        pendingScrollPositionRef.current === "bottom"
          ? Math.max(0, viewport.scrollHeight - viewport.clientHeight)
          : 0;
      viewport.scrollTo({ top, behavior: "auto" });
      previousScrollTopRef.current = top;
    });
    scheduleUnlock(350);

    return () => {
      window.cancelAnimationFrame(frame);
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
    };
  }, [safePage]);

  const changePage = (
    page: number,
    scrollPosition: PageScrollPosition = "top",
  ) => {
    autoAdvanceLockRef.current = true;
    pendingScrollPositionRef.current = scrollPosition;
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    setEditingId(null);
    if (page === safePage) {
      rulesViewportRef.current?.scrollTo({
        top: scrollPosition === "bottom"
          ? rulesViewportRef.current.scrollHeight -
            rulesViewportRef.current.clientHeight
          : 0,
        behavior: "auto",
      });
      scheduleUnlock(180);
    }
  };

  const atViewportStart = (viewport: HTMLDivElement) =>
    viewport.scrollTop <= 1;
  const atViewportEnd = (viewport: HTMLDivElement) =>
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 24;
  const moveByScrollDirection = (
    direction: "up" | "down",
    viewport: HTMLDivElement,
  ) => {
    if (
      autoAdvanceLockRef.current ||
      editingId ||
      (direction === "up" && (safePage <= 1 || !atViewportStart(viewport))) ||
      (direction === "down" &&
        (safePage >= totalPages || !atViewportEnd(viewport)))
    ) {
      return false;
    }

    changePage(
      direction === "up" ? safePage - 1 : safePage + 1,
      direction === "up" ? "bottom" : "top",
    );
    return true;
  };

  const handleRulesScroll = (event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const currentScrollTop = viewport.scrollTop;
    const direction =
      currentScrollTop > previousScrollTopRef.current
        ? "down"
        : currentScrollTop < previousScrollTopRef.current
          ? "up"
          : null;

    previousScrollTopRef.current = currentScrollTop;
    if (direction) moveByScrollDirection(direction, viewport);
  };
  const handleRulesWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (autoAdvanceLockRef.current) {
      scheduleUnlock();
      return;
    }

    const direction = event.deltaY < 0 ? "up" : event.deltaY > 0 ? "down" : null;
    if (direction) moveByScrollDirection(direction, event.currentTarget);
  };
  const handleRulesTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };
  const handleRulesTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY;
    touchStartYRef.current = null;
    if (startY == null || endY == null || Math.abs(startY - endY) < 24) return;

    moveByScrollDirection(
      startY > endY ? "down" : "up",
      event.currentTarget,
    );
  };
  const handleRulesKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const direction =
      event.key === "ArrowUp" || event.key === "PageUp"
        ? "up"
        : event.key === "ArrowDown" || event.key === "PageDown"
          ? "down"
          : null;

    if (direction && moveByScrollDirection(direction, event.currentTarget)) {
      event.preventDefault();
    }
  };

  return (
    <div className="mt-6 grid items-start gap-6 xl:h-[calc(100dvh-232px)] xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
        <div className="xl:shrink-0">
          <h2 className="text-lg font-bold text-[#12213a]">New expert rule</h2>
          <p className="mt-1 text-sm text-slate-500">Rules turn approved expertise into explainable guidance. Every rule shows a plain-language preview.</p>
        </div>
        <div className="mt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
          <RuleForm busy={busy} onSubmit={create} />
        </div>
      </section>
      <section className="min-w-0 rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:flex xl:h-full xl:min-h-0 xl:flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3 xl:shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#12213a]">Expert rules</h2>
            <p className="mt-1 text-sm text-slate-500">Turn operational knowledge into explainable proposal guidance.</p>
          </div>
          <label className="block text-xs font-medium text-slate-600">Status
            <SelectBox
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                changePage(1);
              }}
              options={ruleStatusOptions}
              className={inputClass}
            />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        <div
          ref={rulesViewportRef}
          onScroll={handleRulesScroll}
          onWheel={handleRulesWheel}
          onTouchStart={handleRulesTouchStart}
          onTouchEnd={handleRulesTouchEnd}
          onKeyDown={handleRulesKeyDown}
          tabIndex={0}
          aria-label="Scrollable expert rules"
          aria-busy={isInitialLoading}
          className="mt-4 flex max-h-[60dvh] min-h-0 flex-col overflow-y-auto overscroll-contain pr-1 outline-none focus-visible:ring-2 focus-visible:ring-[#00aeb5] focus-visible:ring-offset-2 [scrollbar-gutter:stable] xl:max-h-none xl:flex-1"
        >
          <ul className="flex-1 space-y-3">
            {isInitialLoading ? <ExpertRulesSkeleton /> : null}
            {!isInitialLoading && rules.length === 0 && (
              <li className="flex h-full min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No expert rules match this filter.
              </li>
            )}
            {!isInitialLoading && pageRules.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-slate-100 p-4 transition hover:border-slate-200">
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
        </div>
        <nav
          aria-label="Expert rules pagination"
          className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"
        >
          <div aria-live="polite">
            <p className="text-xs font-medium text-slate-500">
              {isInitialLoading
                ? "Loading expert rules…"
                : `Showing ${firstVisibleRule}–${lastVisibleRule} of ${rules.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changePage(safePage - 1)}
              disabled={isInitialLoading || safePage === 1}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 transition hover:border-[#b8dfe0] hover:bg-[#f3fbfb] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
              aria-label="Previous expert rules page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <span className="min-w-20 text-center text-xs font-bold text-slate-600">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => changePage(safePage + 1)}
              disabled={isInitialLoading || safePage === totalPages}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 transition hover:border-[#b8dfe0] hover:bg-[#f3fbfb] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
              aria-label="Next expert rules page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </section>
    </div>
  );
}

/* --------------------------------- Workspace ----------------------------------- */

export default function PricingWorkspace() {
  const [tab, setTab] = useState<"records" | "rules">("records");
  const [visitedTabs, setVisitedTabs] = useState({
    records: true,
    rules: false,
  });
  const selectTab = (nextTab: "records" | "rules") => {
    setVisitedTabs((current) => ({ ...current, [nextTab]: true }));
    setTab(nextTab);
  };

  return (
    <div className="mx-auto w-full max-w-[1540px]">
      <AdminPageHeader
        eyebrow="Knowledge administration"
        title="Pricing knowledge"
        description="Curate approved pricing records and expert rules that power reliable investment guidance."
        icon={CircleDollarSign}
      />
      <div role="tablist" aria-label="Pricing knowledge sections" className="mt-6 inline-flex rounded-xl border border-[#dce5ee] bg-white p-1">
        {([["records", "Pricing records"], ["rules", "Expert rules"]] as const).map(([id, label]) => (
          <button
            key={id}
            id={`pricing-${id}-tab`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`pricing-${id}-panel`}
            onClick={() => selectTab(id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === id ? "bg-[#eaf9f8] text-[#008f96]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>
      {visitedTabs.records ? (
        <div
          id="pricing-records-panel"
          role="tabpanel"
          aria-labelledby="pricing-records-tab"
          hidden={tab !== "records"}
        >
          <PricingRecordsTab />
        </div>
      ) : null}
      {visitedTabs.rules ? (
        <div
          id="pricing-rules-panel"
          role="tabpanel"
          aria-labelledby="pricing-rules-tab"
          hidden={tab !== "rules"}
        >
          <ExpertRulesTab />
        </div>
      ) : null}
    </div>
  );
}

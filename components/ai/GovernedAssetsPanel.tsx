"use client";

import {
  activateGovernedAssetReplacementAction,
  listGovernedAssetsAction,
  updateGovernedAssetAction,
  type GovernedAsset,
} from "@/app/actions/governance";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 10;
const assetTypes = [
  "knowledge_release",
  "expert_rule",
  "pricing_record",
  "pricing_regional_factor",
  "pricing_modifier",
  "pricing_confidence_rule",
];
const label = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const day = (value: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
const instant = (value: FormDataEntryValue | null) =>
  value ? `${String(value)}T00:00:00.000Z` : null;
const inputClass =
  "mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-[#304653] dark:bg-[#0a1923] dark:text-slate-100";

const State = ({ value }: { value: string }) => (
  <span
    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
      value === "approved" || value === "active"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
        : value === "revoked"
          ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"
    }`}
  >
    {label(value)}
  </span>
);

export default function GovernedAssetsPanel() {
  const [items, setItems] = useState<GovernedAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [assetType, setAssetType] = useState("");
  const [approvalState, setApprovalState] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [selected, setSelected] = useState<GovernedAsset | null>(null);
  const [replacementOptions, setReplacementOptions] = useState<
    GovernedAsset[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listGovernedAssetsAction({
      assetType: assetType || undefined,
      approvalState: approvalState || undefined,
      dueWithinDays: dueOnly ? 30 : undefined,
      limit: PAGE_SIZE,
      offset,
    });
    if (result.success) {
      setItems(result.data.items);
      setTotal(result.data.total);
      setSelected((current) =>
        current
          ? result.data.items.find((item) => item.id === current.id) ??
            null
          : null,
      );
    } else {
      setError(`${result.message} Reference: ${result.correlationId}`);
    }
    setLoading(false);
  }, [approvalState, assetType, dueOnly, offset]);

  useEffect(() => {
    let active = true;
    void listGovernedAssetsAction({
      assetType: assetType || undefined,
      approvalState: approvalState || undefined,
      dueWithinDays: dueOnly ? 30 : undefined,
      limit: PAGE_SIZE,
      offset,
    }).then((result) => {
      if (!active) return;
      if (result.success) {
        setItems(result.data.items);
        setTotal(result.data.total);
      } else {
        setError(`${result.message} Reference: ${result.correlationId}`);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [approvalState, assetType, dueOnly, offset]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    void listGovernedAssetsAction({
      assetType: selected.assetType,
      approvalState: "approved",
      lifecycleState: "active",
      limit: 50,
      offset: 0,
    }).then((result) => {
      if (!active) return;
      setReplacementOptions(
        result.success
          ? result.data.items.filter((item) => item.id !== selected.id)
          : [],
      );
    });
    return () => {
      active = false;
    };
  }, [selected]);

  const save = async (form: FormData) => {
    if (!selected) return;
    setSaving(true);
    setNotice("");
    setError("");
    const result = await updateGovernedAssetAction(selected.id, {
      expectedRevision: selected.revision,
      ownerExternalUserId: form.get("ownerExternalUserId"),
      productArea: form.get("productArea"),
      locale: form.get("locale"),
      sourceReference: form.get("sourceReference"),
      effectiveAt: instant(form.get("effectiveAt")),
      reviewDueAt: instant(form.get("reviewDueAt")),
      expiresAt: instant(form.get("expiresAt")),
      approvalState: form.get("approvalState"),
      lifecycleState: form.get("lifecycleState"),
      lastVerifiedApplicationRelease: form.get(
        "lastVerifiedApplicationRelease",
      ),
    });
    if (result.success) {
      setSelected(result.data);
      setNotice("Governance metadata saved and audited.");
      await load();
    } else {
      setError(`${result.message} Reference: ${result.correlationId}`);
    }
    setSaving(false);
  };

  const activateReplacement = async (form: FormData) => {
    if (!selected) return;
    const replacementId = String(
      form.get("replacementGovernedAssetId") || "",
    );
    const replacement = replacementOptions.find(
      (item) => item.id === replacementId,
    );
    if (!replacement) {
      setError("Choose an eligible replacement from the current result set.");
      return;
    }
    setSaving(true);
    setNotice("");
    setError("");
    const result = await activateGovernedAssetReplacementAction(
      selected.id,
      {
        replacementGovernedAssetId: replacement.id,
        expectedRevision: selected.revision,
        replacementExpectedRevision: replacement.revision,
      },
    );
    if (result.success) {
      setSelected(result.data.retired);
      setNotice("Replacement activated and the previous asset retired.");
      await load();
    } else {
      setError(`${result.message} Reference: ${result.correlationId}`);
    }
    setSaving(false);
  };

  return (
    <section
      aria-labelledby="governed-assets-heading"
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 dark:border-[#283c4a] dark:bg-[#0d1d28]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-[#009ca4] dark:bg-cyan-500/10 dark:text-cyan-300">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2
              id="governed-assets-heading"
              className="text-lg font-semibold text-slate-950 dark:text-slate-50"
            >
              Knowledge, rule, and price governance
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review ownership, eligibility, release verification, expiry, and
              explicit replacements.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 dark:border-[#304653] dark:text-slate-200 dark:hover:bg-[#102532]"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 dark:border-[#203541] dark:bg-[#0a1923]">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Asset type
          <select
            value={assetType}
            onChange={(event) => {
              setAssetType(event.target.value);
              setOffset(0);
            }}
            className={inputClass}
          >
            <option value="">All asset types</option>
            {assetTypes.map((type) => (
              <option key={type} value={type}>
                {label(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Approval
          <select
            value={approvalState}
            onChange={(event) => {
              setApprovalState(event.target.value);
              setOffset(0);
            }}
            className={inputClass}
          >
            <option value="">All approval states</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 dark:border-[#304653] dark:bg-[#0a1923] dark:text-slate-200">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(event) => {
              setDueOnly(event.target.checked);
              setOffset(0);
            }}
          />
          Review due within 30 days
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100"
        >
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-[#203541]">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-[#0a1923] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Owner / locale</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3">Review due</th>
              <th className="px-4 py-3">Verified release</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Loading governed assets…
                </td>
              </tr>
            ) : items.length ? (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-100 dark:border-[#1b2d3a]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {label(item.assetType)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {label(item.productArea)} · rev {item.revision}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <p>{item.ownerExternalUserId.slice(0, 6)}…</p>
                    <p className="text-xs text-slate-500">{item.locale}</p>
                  </td>
                  <td className="px-4 py-3">
                    <State value={item.approvalState} />
                  </td>
                  <td className="px-4 py-3">
                    <State value={item.lifecycleState} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {day(item.reviewDueAt) || "—"}
                  </td>
                  <td className="max-w-48 truncate px-4 py-3 text-slate-600 dark:text-slate-300">
                    {item.lastVerifiedApplicationRelease}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReplacementOptions([]);
                        setSelected(item);
                        setNotice("");
                        setError("");
                      }}
                      className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-[#304653] dark:text-slate-200"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                >
                  No governed assets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Showing {total ? offset + 1 : 0}–
          {Math.min(offset + items.length, total)} of {total}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous governed assets page"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40 dark:border-[#304653]"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            aria-label="Next governed assets page"
            disabled={offset + items.length >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40 dark:border-[#304653]"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {selected && (
        <div className="mt-6 grid gap-5 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 xl:grid-cols-[1.4fr_0.8fr] dark:border-cyan-500/25 dark:bg-cyan-500/5">
          <form action={save}>
            <h3 className="font-semibold text-slate-950 dark:text-slate-50">
              Review {label(selected.assetType)}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Updates use revision {selected.revision} and create an immutable
              audit event.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Owner ID
                <input
                  name="ownerExternalUserId"
                  defaultValue={selected.ownerExternalUserId}
                  pattern="[0-9a-fA-F]{24}"
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Product area
                <input
                  name="productArea"
                  defaultValue={selected.productArea}
                  pattern="[a-z0-9_-]{2,60}"
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Locale
                <input
                  name="locale"
                  defaultValue={selected.locale}
                  pattern="[a-z]{2,3}(-[A-Z]{2})?"
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Source reference
                <input
                  name="sourceReference"
                  defaultValue={selected.sourceReference}
                  maxLength={300}
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Effective date
                <input
                  name="effectiveAt"
                  type="date"
                  defaultValue={day(selected.effectiveAt)}
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Review due
                <input
                  name="reviewDueAt"
                  type="date"
                  defaultValue={day(selected.reviewDueAt)}
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Expiry (optional)
                <input
                  name="expiresAt"
                  type="date"
                  defaultValue={day(selected.expiresAt)}
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Last verified application release
                <input
                  name="lastVerifiedApplicationRelease"
                  defaultValue={
                    selected.lastVerifiedApplicationRelease
                  }
                  pattern="[a-zA-Z0-9._:-]{1,100}"
                  required
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Approval state
                <select
                  name="approvalState"
                  defaultValue={selected.approvalState}
                  className={inputClass}
                >
                  <option value={selected.approvalState}>
                    {label(selected.approvalState)}
                  </option>
                  {selected.approvalState === "draft" && (
                    <option value="approved">Approved</option>
                  )}
                  {selected.approvalState !== "revoked" && (
                    <option value="revoked">Revoked</option>
                  )}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Lifecycle
                <select
                  name="lifecycleState"
                  defaultValue={selected.lifecycleState}
                  className={inputClass}
                >
                  <option value={selected.lifecycleState}>
                    {label(selected.lifecycleState)}
                  </option>
                  {selected.lifecycleState === "active" && (
                    <option value="retired">Retired</option>
                  )}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="min-h-10 rounded-lg bg-[#102033] px-4 text-sm font-semibold text-white transition hover:bg-[#19314c] focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 dark:bg-cyan-500 dark:text-[#06212a]"
              >
                {saving ? "Saving…" : "Save governance"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setReplacementOptions([]);
                }}
                className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-[#304653] dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </form>

          <form
            action={activateReplacement}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#203541] dark:bg-[#0a1923]"
          >
            <h3 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-slate-50">
              <Archive size={17} /> Activate replacement
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              The replacement must be the same type, approved, active,
              effective, and unexpired. Activation retires this asset; it never
              happens automatically.
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Eligible replacement
              <select
                name="replacementGovernedAssetId"
                required
                className={inputClass}
              >
                <option value="">Choose an asset</option>
                {replacementOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {label(item.productArea)} · rev {item.revision} ·{" "}
                    {item.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={
                saving ||
                selected.lifecycleState !== "active" ||
                replacementOptions.length === 0
              }
              className="mt-4 min-h-10 w-full rounded-lg border border-amber-400 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
            >
              Activate and retire current
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

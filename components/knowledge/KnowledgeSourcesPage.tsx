"use client";

import {
  attachKnowledgeSource,
  completeKnowledgeUpload,
  createImportBatch,
  createKnowledgeUploadSession,
  getKnowledgeJob,
  listImportBatches,
  listKnowledgeFragments,
  queueKnowledgeParse,
  queueKnowledgeScan,
  type ImportBatch,
} from "@/app/actions/knowledgeImports";
import AdminPageHeader from "@/components/layout/AdminPageHeader";
import SelectBox from "@/components/ui/SelectBox";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileText,
  FolderPlus,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type FragmentRow = {
  id: string;
  ordinal: number;
  content: string;
  coordinates: Record<string, unknown>;
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#20304b] outline-none transition focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10";
const sourceTypeOptions = [
  { value: "price_sheet", label: "Price sheet" },
  { value: "contract", label: "Contract" },
  { value: "prior_proposal", label: "Prior proposal" },
  { value: "equipment_list", label: "Equipment list" },
  { value: "labor_schedule", label: "Labor schedule" },
  { value: "operating_guidance", label: "Operating guidance" },
  { value: "other", label: "Other" },
];
const classificationOptions = [
  { value: "synthetic", label: "Synthetic test data" },
  { value: "internal", label: "DXG internal" },
  { value: "customer_confidential", label: "Customer confidential" },
  { value: "vendor_confidential", label: "Vendor confidential" },
];

const waitForJob = async (id: string) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await getKnowledgeJob(id);
    if (!result.success) throw new Error(result.message);
    if (
      ["succeeded", "failed", "cancelled", "dead_letter"].includes(
        result.data.status,
      )
    ) {
      return result.data;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(2000 + attempt * 250, 5000)),
    );
  }
  throw new Error(
    "Processing is taking longer than expected. You can refresh and return later.",
  );
};

const statusTone = (status: string) => {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (["needs_review", "in_review", "submitted"].includes(status)) {
    return "bg-amber-50 text-amber-700";
  }
  if (["failed", "rejected"].includes(status)) {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
};

export default function KnowledgeSourcesPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selected, setSelected] = useState<ImportBatch | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fragments, setFragments] = useState<FragmentRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await listImportBatches();
    if (result.success) setBatches(result.data);
    else setError(result.message);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (form: FormData) => {
    setError("");
    const result = await createImportBatch({
      name: form.get("name"),
      sourceType: form.get("sourceType"),
      classification: form.get("classification"),
      intendedUse: form.get("intendedUse"),
      market: form.get("market"),
      currency: form.get("currency"),
    });
    if (result.success) {
      setSelected(result.data);
      await load();
    } else {
      setError(result.message);
    }
  };

  const process = async () => {
    if (!selected || !files.length) return;
    setBusy(true);
    setError("");
    setFragments([]);

    try {
      for (const file of files) {
        const idempotencyKey = crypto.randomUUID();
        setStatus(`Uploading ${file.name}`);
        const session = await createKnowledgeUploadSession(
          selected.id,
          { name: file.name, type: file.type, size: file.size },
          idempotencyKey,
        );
        if (!session.success) throw new Error(session.message);

        const upload = await fetch(session.data.uploadUrl, {
          method: "PUT",
          headers: session.data.requiredHeaders,
          body: file,
        });
        if (!upload.ok) throw new Error("Private upload failed.");

        const complete = await completeKnowledgeUpload(session.data.sourceId);
        if (!complete.success) throw new Error(complete.message);

        setStatus(`Security scanning ${file.name}`);
        const scan = await queueKnowledgeScan(
          session.data.sourceId,
          idempotencyKey,
        );
        if (!scan.success) throw new Error(scan.message);
        if ((await waitForJob(scan.data.id)).status !== "succeeded") {
          throw new Error("The security scan did not complete safely.");
        }

        const attached = await attachKnowledgeSource(
          selected.id,
          session.data.sourceId,
        );
        if (!attached.success) throw new Error(attached.message);

        setStatus(`Parsing ${file.name}`);
        const parse = await queueKnowledgeParse(
          attached.data.id,
          idempotencyKey,
        );
        if (!parse.success) throw new Error(parse.message);
        if ((await waitForJob(parse.data.id)).status !== "succeeded") {
          throw new Error("Deterministic parsing failed.");
        }

        const rows = await listKnowledgeFragments(attached.data.id);
        if (rows.success) {
          setFragments((current) => [...current, ...rows.data]);
        }
      }

      setStatus("Files are ready for human review.");
      setFiles([]);
      await load();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The import could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1540px]">
      <AdminPageHeader
        eyebrow="Knowledge administration"
        title="Knowledge sources"
        description="Import private DXG reference material, inspect deterministic extracts, and route approved content into governed review."
        icon={Database}
      />

      {error ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{error}</span>
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white xl:sticky xl:top-6">
          <div className="border-b border-slate-100 px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
                <FolderPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#12213a]">
                  Create import batch
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Group related source files for review.
                </p>
              </div>
            </div>
          </div>

          <form action={create} className="space-y-4 p-5">
            <label className="block text-xs font-bold text-slate-600">
              Batch name
              <input
                name="name"
                required
                maxLength={200}
                placeholder="Q3 vendor pricing"
                className={fieldClass}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block text-xs font-bold text-slate-600">
                Source type
                <SelectBox
                  name="sourceType"
                  defaultValue="price_sheet"
                  options={sourceTypeOptions}
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Classification
                <SelectBox
                  name="classification"
                  defaultValue="synthetic"
                  options={classificationOptions}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-600">
              Intended use
              <textarea
                name="intendedUse"
                required
                minLength={3}
                maxLength={500}
                rows={3}
                placeholder="Describe how this source should support proposals."
                className={`${fieldClass} h-auto py-2.5`}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs font-bold text-slate-600">
                Market
                <input name="market" maxLength={100} className={fieldClass} />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Currency
                <input
                  name="currency"
                  defaultValue="USD"
                  maxLength={3}
                  className={`${fieldClass} uppercase`}
                />
              </label>
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#00aeb5] px-4 text-sm font-bold text-white transition hover:bg-[#009ca4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5]"
            >
              Create batch
            </button>
          </form>

          <div className="border-t border-slate-100 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#12213a]">
                Recent batches
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                {batches.length}
              </span>
            </div>
            {batches.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                No import batches yet.
              </p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {batches.map((batch) => (
                  <li key={batch.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(batch);
                        setFragments([]);
                        setStatus("");
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected?.id === batch.id
                          ? "border-[#aee9e8] bg-[#eaf9f8]"
                          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block truncate text-sm font-bold text-[#20304b]">
                        {batch.name}
                      </span>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusTone(batch.status)}`}
                      >
                        {batch.status.replace(/_/g, " ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="min-h-[560px] overflow-hidden rounded-2xl border border-[#dce5ee] bg-white">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#12213a]">
                  {selected ? selected.name : "Select or create a batch"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {selected
                    ? "Upload private files and inspect their extracted fragments."
                    : "Choose a batch from the left to continue importing."}
                </p>
              </div>
            </div>
          </div>

          {!selected ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <Database className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-bold text-slate-600">
                No batch selected
              </p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">
                Create a new batch or choose a recent one to upload knowledge
                source files.
              </p>
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <label className="block">
                <span className="text-xs font-bold text-slate-600">
                  Private source files
                </span>
                <span className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-[#00aeb5] hover:bg-cyan-50/40">
                  <UploadCloud
                    className="h-7 w-7 text-[#00a3aa]"
                    aria-hidden="true"
                  />
                  <span className="mt-2 text-sm font-bold text-[#20304b]">
                    Choose up to 20 source files
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    PDF, DOCX, XLSX, CSV, or TXT
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.xlsx,.csv,.txt"
                    disabled={busy}
                    onChange={(event) =>
                      setFiles(
                        Array.from(event.target.files || []).slice(0, 20),
                      )
                    }
                    className="sr-only"
                  />
                </span>
              </label>

              {files.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {files.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!files.length || busy}
                onClick={() => void process()}
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00aeb5] px-5 text-sm font-bold text-white transition hover:bg-[#009ca4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                )}
                {busy ? "Processing…" : "Upload and process"}
              </button>

              {status ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 px-3.5 py-3 text-sm font-medium text-cyan-900"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {status}
                </p>
              ) : null}

              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-[#12213a]">
                    Extracted fragments
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                    {fragments.length}
                  </span>
                </div>
                {fragments.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                    No parsed fragments loaded.
                  </p>
                ) : (
                  <ol className="mt-3 max-h-[460px] space-y-3 overflow-y-auto pr-1">
                    {fragments.map((fragment) => (
                      <li
                        key={fragment.id}
                        className="rounded-xl border border-slate-100 p-4"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-6 text-[#34445f]">
                          {fragment.content}
                        </p>
                        <p className="mt-2 break-all text-xs text-slate-400">
                          Source coordinates:{" "}
                          {JSON.stringify(fragment.coordinates)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import {
  listImportBatches,
  type ImportBatch,
} from "@/app/actions/knowledgeImports";
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import KnowledgeReviewPanel from "./KnowledgeReviewPanel";

export default function KnowledgeReviewWorkspace() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selected, setSelected] = useState<ImportBatch | null>(null);

  const apply = useCallback((items: ImportBatch[]) => {
    setBatches(items);
    setSelected((current) =>
      current
        ? items.find((item) => item.id === current.id) || current
        : null,
    );
  }, []);

  const load = useCallback(async () => {
    const result = await listImportBatches();
    if (result.success) apply(result.data);
  }, [apply]);

  useEffect(() => {
    let active = true;
    void listImportBatches().then((result) => {
      if (active && result.success) apply(result.data);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const candidates = batches.filter((item) =>
    [
      "needs_review",
      "in_review",
      "submitted",
      "changes_required",
      "approved",
    ].includes(item.status),
  );

  return (
    <section className="mx-auto mt-6 w-full max-w-[1540px] overflow-hidden rounded-2xl border border-[#dce5ee] bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[#12213a]">
              Review and approval queue
            </h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
              Inspect extracted fragments before an immutable release is
              approved for governed retrieval.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {candidates.length ? (
          <div className="flex flex-wrap gap-2">
            {candidates.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  selected?.id === item.id
                    ? "border-[#aee9e8] bg-[#eaf9f8] text-[#008f96]"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.name}
                <span className="ml-2 text-xs capitalize text-slate-400">
                  {item.status.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
            No batches are awaiting review.
          </p>
        )}
        {selected ? (
          <KnowledgeReviewPanel batch={selected} onChanged={load} />
        ) : null}
      </div>
    </section>
  );
}

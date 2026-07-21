"use client";

import { listImportBatches, type ImportBatch } from "@/app/actions/knowledgeImports";
import { useCallback, useEffect, useState } from "react";
import KnowledgeReviewPanel from "./KnowledgeReviewPanel";

export default function KnowledgeReviewWorkspace() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selected, setSelected] = useState<ImportBatch | null>(null);
  const apply = useCallback((items: ImportBatch[]) => {
    setBatches(items);
    setSelected(current => current ? items.find(item => item.id === current.id) || current : null);
  }, []);
  const load = useCallback(async () => {
    const result = await listImportBatches();
    if (result.success) apply(result.data);
  }, [apply]);
  useEffect(() => {
    let active = true;
    void listImportBatches().then(result => { if (active && result.success) apply(result.data); });
    return () => { active = false; };
  }, [apply]);
  const candidates = batches.filter(item => ["needs_review", "in_review", "submitted", "changes_required", "approved"].includes(item.status));
  return <section className="mx-6 mb-10 rounded-xl border bg-white p-5 lg:mx-10">
    <h2 className="text-xl font-semibold">Review and approval queue</h2>
    <p className="mt-1 text-sm text-slate-500">Only explicitly approved versions create a release. An authorized admin may currently submit and approve the same version. Approved releases feed governed AI retrieval once indexed. Indexing and retrieval respect the embedding release&apos;s approved classifications.</p>
    <div className="mt-4 flex flex-wrap gap-2">{candidates.map(item => <button key={item.id} onClick={() => setSelected(item)} className={`rounded-lg border px-3 py-2 text-sm ${selected?.id === item.id ? "border-primary bg-cyan-50" : ""}`}>{item.name} · {item.status}</button>)}</div>
    {candidates.length === 0 && <p className="mt-4 text-sm text-slate-500">No batches are awaiting review.</p>}
    {selected && <KnowledgeReviewPanel batch={selected} onChanged={load} />}
  </section>;
}

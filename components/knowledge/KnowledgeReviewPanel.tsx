"use client";

import {
  approveKnowledgeReview,
  getKnowledgeReview,
  rejectKnowledgeReview,
  reviewKnowledgeFragment,
  startKnowledgeReview,
  submitKnowledgeReview,
  type ImportBatch,
  type ReviewDetail,
} from "@/app/actions/knowledgeImports";
import { useCallback, useEffect, useState } from "react";

type Decision = "accepted" | "rejected" | "flagged";

export default function KnowledgeReviewPanel({
  batch,
  onChanged,
}: {
  batch: ImportBatch;
  onChanged: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyFragmentId, setBusyFragmentId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    const result = await getKnowledgeReview(batch.id, offset);
    if (result.success) setDetail(result.data);
    else setError(result.message);
  }, [batch.id, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    action: () => Promise<{ success: boolean; message?: string }>,
    successMessage?: string,
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (!result.success) {
        setError(result.message || "The review operation failed.");
        return false;
      }
      if (successMessage) setNotice(successMessage);
      await load();
      await onChanged();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const decide = async (
    versionId: string,
    fragmentId: string,
    decision: Decision,
    reason?: string,
  ) => {
    setBusyFragmentId(fragmentId);
    const saved = await run(
      () => reviewKnowledgeFragment(versionId, fragmentId, decision, reason),
      `Fragment ${decision}. The decision has been saved.`,
    );
    if (saved) {
      setDetail((current) =>
        current
          ? {
              ...current,
              fragments: current.fragments.map((fragment) =>
                fragment.id === fragmentId
                  ? { ...fragment, decision, reason: reason || null }
                  : fragment,
              ),
            }
          : current,
      );
    }
    setBusyFragmentId(null);
  };

  const version = detail?.reviewVersion;

  return (
    <div className="mt-6 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Human review</h3>
          <p className="text-sm text-slate-500">
            Status: {version?.status || "Not started"} · {detail?.total || 0} fragments
          </p>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">
            A fragment is one reviewable piece of the uploaded source. For this spreadsheet,
            fragments normally represent worksheet rows, including the header row. Up to 100
            fragments are shown per page. You may submit at any time: unreviewed fragments are
            accepted by default, while rejected or flagged fragments are excluded from the release.
          </p>
        </div>
        {!version && batch.status === "needs_review" && (
          <button
            disabled={busy}
            onClick={() => void run(() => startKnowledgeReview(batch.id), "Review started.")}
            className="rounded-lg bg-[#103B4C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Start review
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}

      {version?.status === "in_review" && (
        <>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto">
            {detail?.fragments.map((fragment) => {
              const saving = busyFragmentId === fragment.id;
              return (
                <article key={fragment.id} className="rounded-lg border p-4">
                  <p className="whitespace-pre-wrap text-sm">{fragment.content}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {JSON.stringify(fragment.coordinates)} · Decision: {fragment.decision}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={busy || fragment.decision === "accepted"}
                      onClick={() => void decide(version.id, fragment.id, "accepted")}
                      className={`rounded border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed ${
                        fragment.decision === "accepted"
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-emerald-600 text-emerald-700 disabled:opacity-50"
                      }`}
                    >
                      {saving ? "Saving…" : fragment.decision === "accepted" ? "Accepted ✓" : "Accept"}
                    </button>
                    <button
                      disabled={busy || fragment.decision === "rejected"}
                      onClick={() =>
                        void decide(
                          version.id,
                          fragment.id,
                          "rejected",
                          "Rejected by reviewer.",
                        )
                      }
                      className={`rounded border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed ${
                        fragment.decision === "rejected"
                          ? "border-red-700 bg-red-700 text-white"
                          : "border-red-600 text-red-700 disabled:opacity-50"
                      }`}
                    >
                      {saving ? "Saving…" : fragment.decision === "rejected" ? "Rejected ✓" : "Reject"}
                    </button>
                    <button
                      disabled={busy || fragment.decision === "flagged"}
                      onClick={() => {
                        const reason = window.prompt("Reason for flagging (required)");
                        if (reason) void decide(version.id, fragment.id, "flagged", reason);
                      }}
                      className={`rounded border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed ${
                        fragment.decision === "flagged"
                          ? "border-amber-700 bg-amber-700 text-white"
                          : "disabled:opacity-50"
                      }`}
                    >
                      {saving ? "Saving…" : fragment.decision === "flagged" ? "Flagged ✓" : "Flag"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              disabled={offset === 0 || busy}
              onClick={() => setOffset(Math.max(0, offset - 100))}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              {offset + 1}–{Math.min(offset + 100, detail?.total || 0)} of {detail?.total || 0}
            </span>
            <button
              disabled={offset + 100 >= (detail?.total || 0) || busy}
              onClick={() => setOffset(offset + 100)}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <button
            disabled={busy}
            onClick={() =>
              void run(
                () => submitKnowledgeReview(version.id, {}),
                "Review submitted for approval.",
              )
            }
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Submit for approval"}
          </button>
        </>
      )}

      {version?.status === "submitted" && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm">
            An authorized admin may approve and publish this immutable version. The approval is
            recorded separately in the audit history.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() =>
                void run(
                  () => approveKnowledgeReview(version.id),
                  "Knowledge release approved and published.",
                )
              }
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Approve and publish release
            </button>
            <button
              disabled={busy}
              onClick={() => {
                const reason = window.prompt("Rejection reason (required)");
                if (reason)
                  void run(
                    () => rejectKnowledgeReview(version.id, reason),
                    "Review rejected.",
                  );
              }}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {version?.status === "approved" && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
          Approved release created. It is not automatically applied to a proposal.
        </p>
      )}

      {version?.status === "rejected" && (
        <button
          disabled={busy}
          onClick={() =>
            void run(() => startKnowledgeReview(batch.id), "Corrected review version created.")
          }
          className="mt-4 rounded-lg bg-[#103B4C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create corrected review version
        </button>
      )}
    </div>
  );
}

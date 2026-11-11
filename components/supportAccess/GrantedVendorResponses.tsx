import type { GrantedVendorResponse } from "@/lib/supportAccess/grants";
import { formatDate } from "@/lib/supportAccess/rfpFields";
import { Inbox } from "lucide-react";

/** Summary fields only: the backend sends no document links, and none are built here. */
export default function GrantedVendorResponses({ responses }: { responses: GrantedVendorResponse[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-5 sm:px-6">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">Vendor responses</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
          {responses.length.toLocaleString()} total
        </span>
      </div>
      {responses.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Inbox className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600">No vendor responses yet</p>
          <p className="mt-1 text-sm text-slate-400">No vendor has responded to this RFP.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {responses.map((response) => (
            <li key={response.id} className="space-y-2 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="break-words text-sm font-bold text-[#20304b]">{response.vendorName ?? "Unnamed vendor"}</h3>
                <p className="text-xs text-slate-500">
                  Submitted {formatDate(response.createdAt) ?? "—"}
                  {response.updatedAt && formatDate(response.updatedAt) !== formatDate(response.createdAt)
                    ? ` · updated ${formatDate(response.updatedAt)}`
                    : ""}
                </p>
              </div>
              <p className="break-words text-[13px] text-slate-500">
                {[response.submittedBy, response.email].filter(Boolean).join(" · ") || "No contact given"}
              </p>
              {response.message ? (
                <p className="whitespace-pre-line break-words rounded-xl border border-slate-100 bg-[#f8fafc] p-3 text-[13px] text-[#20304b]">
                  {response.message}
                </p>
              ) : null}
              <p className="text-xs font-semibold text-slate-500">
                {response.documentCount} {response.documentCount === 1 ? "document" : "documents"} · version{" "}
                {Math.max(1, response.currentVersionNumber)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

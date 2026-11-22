"use client";

import { listReassignCandidatesAction } from "@/app/actions/organizationManagement";
import { RefusalNote, secondaryButton } from "@/components/organizations/manage/ManageChrome";
import { rolesLabel } from "@/lib/organizationContent/content";
import {
  canReceiveProposals,
  memberLabel,
  refused,
  type ManagementRefusal,
  type ManagementResult,
  type ReassignCandidate,
  type ReassignCandidatesPage,
} from "@/lib/organizationManagement/management";
import { countLabel } from "@/lib/plural";
import { Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";

/* Who receives the member's proposals. The choices come from the organization's Members list,
   which is a recorded read: nothing is loaded until staff press the control, one page of 50 at a
   time, and each further page is its own press. The member chosen is kept while paging. */

type ListState = { phase: "idle" } | { phase: "loading"; page: number } | { phase: "ready"; page: ReassignCandidatesPage } | { phase: "failed"; refusal: ManagementRefusal; page: number };

export default function ReassignTargetPicker({
  organizationId,
  fromUserId,
  chosen,
  error,
  onChoose,
}: {
  organizationId: string;
  /** The member whose proposals move: never offered as the receiver. */
  fromUserId: string;
  chosen: ReassignCandidate | null;
  error?: string;
  onChoose: (candidate: ReassignCandidate | null) => void;
}) {
  const groupId = useId();
  const [list, setList] = useState<ListState>({ phase: "idle" });
  const asked = useRef(0);

  const load = async (page: number) => {
    if (list.phase === "loading") return;
    const mine = ++asked.current;
    setList({ phase: "loading", page });
    let result: ManagementResult<ReassignCandidatesPage>;
    try {
      result = await listReassignCandidatesAction(organizationId, fromUserId, page);
    } catch {
      result = refused("unavailable");
    }
    if (mine !== asked.current) return;
    setList(result.ok ? { phase: "ready", page: result.data } : { phase: "failed", refusal: result, page });
  };

  const loading = list.phase === "loading";
  // The page a first load, or another try, asks for.
  const firstOrSame = list.phase === "loading" || list.phase === "failed" ? list.page : 1;
  const ready = list.phase === "ready" ? list.page : null;
  // The server hands on only the members who can receive the proposals; this check is a second one.
  const eligible = ready ? ready.candidates.filter((candidate) => canReceiveProposals(candidate, fromUserId)) : [];
  const others = ready ? ready.notEligibleCount : 0;

  return (
    <fieldset className="space-y-3" aria-describedby={error ? `${groupId}-error` : undefined}>
      <legend className="text-sm font-bold text-[#20304b]">Member who receives the proposals</legend>
      <p className="break-words text-sm text-slate-600" role="status">
        {chosen ? (
          <>
            Chosen: <span className="font-bold text-[#20304b]">{memberLabel(chosen)}</span> ({rolesLabel(chosen.roles)}).
          </>
        ) : (
          "No member chosen yet."
        )}
      </p>
      {error ? (
        <p id={`${groupId}-error`} className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      {ready ? (
        <div className="space-y-3">
          {eligible.length === 0 ? (
            <p className="text-sm text-slate-600" role="status">
              No member on this page can receive proposals.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {eligible.map((candidate) => (
                <li key={candidate.userId}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-[#00aeb5]">
                    <input
                      type="radio"
                      name={`${groupId}-target`}
                      value={candidate.userId}
                      checked={chosen?.userId === candidate.userId}
                      onChange={() => onChoose(candidate)}
                      className="mt-1 h-4 w-4 accent-[#007f86]"
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-bold text-[#20304b]">{candidate.name ?? candidate.email ?? "Member with no name on file"}</span>
                      {candidate.name && candidate.email ? <span className="block break-all text-slate-600">{candidate.email}</span> : null}
                      <span className="block text-slate-600">{rolesLabel(candidate.roles)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-600">
            Page {ready.pagination.page.toLocaleString("en-US")} of {ready.pagination.totalPages.toLocaleString("en-US")} of the Members list ({countLabel(ready.pagination.total, "member")}).
            {others > 0 ? ` ${countLabel(others, "member")} on this page can't receive proposals: only an active member who isn't a Viewer can, and never the member they come from.` : ""}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {list.phase === "idle" || list.phase === "failed" || loading ? (
          <button type="button" onClick={() => load(firstOrSame)} disabled={loading} className={secondaryButton}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loading ? "Loading members" : list.phase === "failed" ? "Try loading again" : chosen ? "Choose a different member" : "Load members to choose from"}
          </button>
        ) : null}
        {ready && ready.pagination.page > 1 ? (
          <button type="button" onClick={() => load(ready.pagination.page - 1)} className={secondaryButton}>
            Previous page of members
          </button>
        ) : null}
        {ready && ready.pagination.page < ready.pagination.totalPages ? (
          <button type="button" onClick={() => load(ready.pagination.page + 1)} className={secondaryButton}>
            Next page of members
          </button>
        ) : null}
        {chosen ? (
          <button type="button" onClick={() => onChoose(null)} className={secondaryButton}>
            Clear the choice
          </button>
        ) : null}
      </div>
      <p className="text-xs text-slate-600">Each page of members you load here opens this organization&apos;s Members list, which is recorded on the RFPilot side like any other view of it.</p>
      {list.phase === "failed" ? <RefusalNote refusal={list.refusal} /> : null}
    </fieldset>
  );
}

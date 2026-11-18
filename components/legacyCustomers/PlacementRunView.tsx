"use client";

import { getPlacementRunAction, rollbackPlacementRunAction } from "@/app/actions/legacyCustomers";
import { cardClass, dangerButton, FailureNote, linkClass, secondaryButton } from "@/components/legacyCustomers/PlacementChrome";
import { createConfirmedSubmit, type SubmitState } from "@/lib/legacyCustomers/confirmedSubmit";
import {
  LEGACY_CUSTOMERS_PATH,
  placementFailureCopy,
  placementRunPath,
  roleLabel,
  type PlacementResult,
  type PlacementRun,
  type StartedRun,
} from "@/lib/legacyCustomers/placement";
import { createPollController, type PollController, type PollState } from "@/lib/legacyCustomers/pollController";
import {
  canRollBack,
  formatInstant,
  rollbackEffects,
  rollbackFollowUp,
  runHeadline,
  runInstructions,
  showsOrganizationLink,
  taskFailureText,
  verificationLines,
  type RunTone,
} from "@/lib/legacyCustomers/runView";
import { organizationAccountPath } from "@/lib/organizationAccount";
import { sessionRenewPath } from "@/lib/organizationContent/content";
import { countLabel } from "@/lib/plural";
import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/* One placement run, at its own address, followed until it finishes. The loop that reads it is
   lib/legacyCustomers/pollController.ts: every 3 seconds or slower, one read at a time, stopped
   when the run finishes, on a 404 and after repeated errors, and waiting while the tab is hidden.
   A second staff member who opens the same address follows the same run. */

const TONES: Record<RunTone, { box: string; icon: ReactNode }> = {
  working: { box: "border-cyan-200 bg-cyan-50 text-[#0b4f55]", icon: <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> },
  good: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: <AlertTriangle className="h-6 w-6" aria-hidden="true" /> },
  danger: { box: "border-rose-300 bg-rose-50 text-rose-900", icon: <XCircle className="h-6 w-6" aria-hidden="true" /> },
  neutral: { box: "border-slate-200 bg-slate-50 text-slate-800", icon: <CircleSlash className="h-6 w-6" aria-hidden="true" /> },
};

const STATUS_WORDS: Record<PlacementRun["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  rolled_back: "Rolled back",
};

const pollLine = (poll: PollState): { text: string; stopped: boolean } => {
  if (poll.phase === "finished") return { text: "This run has finished. The page has stopped checking it.", stopped: false };
  if (poll.phase === "paused") return { text: "Paused while this tab is in the background. Checking carries on when you come back to it.", stopped: false };
  if (poll.phase === "checking") {
    if (poll.lastFailure === "rate_limited") return { text: "This account is reading too often right now, so the page is checking less often.", stopped: false };
    if (poll.lastFailure) return { text: "The last check didn't get an answer. Trying again, less often.", stopped: false };
    return { text: "Checking this run every few seconds.", stopped: false };
  }
  switch (poll.stopReason) {
    case "not_found":
      return { text: "Stopped checking: the server no longer has a run with this id.", stopped: true };
    case "errors":
      return { text: "Stopped checking: the last three checks got no answer. What is shown may be out of date.", stopped: true };
    case "rate_limited":
      return { text: "Stopped checking: this account has read too often. Wait a few minutes, then refresh. What is shown may be out of date.", stopped: true };
    case "time_limit":
      return { text: "Stopped checking: this run has been queued or running for 30 minutes. What is shown may be out of date. Refresh to check again; if it has not moved, tell the engineering team.", stopped: true };
    case null:
      return { text: "Not checking.", stopped: true };
    default:
      return { text: `Stopped checking: ${placementFailureCopy(poll.stopReason).title.toLowerCase()}. What is shown may be out of date.`, stopped: true };
  }
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-0.5 px-5 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4 sm:px-6">
    <dt className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 sm:pt-0.5">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-[#20304b]">{children}</dd>
  </div>
);

export default function PlacementRunView({ initial }: { initial: PlacementRun }) {
  const router = useRouter();
  const runId = initial.runId;
  const [poll, setPoll] = useState<PollState>({ run: initial, phase: "checking", reading: false, stopReason: null, lastFailure: null });
  const controller = useRef<PollController | null>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  // The last rollback request's refusal. It is kept here, not in the panel, so it is still on
  // the page when the run read after it shows there is nothing left to roll back.
  const [rollbackRefusal, setRollbackRefusal] = useState<Extract<RollbackResult, { ok: false }> | null>(null);

  // Exactly one loop for the page: made when it opens, ended when it closes.
  useEffect(() => {
    const created = createPollController(initial, {
      read: () => getPlacementRunAction(runId),
      onChange: setPoll,
      isVisible: () => document.visibilityState !== "hidden",
    });
    controller.current = created;
    const onVisibility = () => created.setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    created.start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      created.dispose();
      controller.current = null;
    };
    // The run this page opened with is only where the loop begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const run = poll.run ?? initial;
  const headline = runHeadline(run);
  const tone = TONES[headline.tone];
  const instructions = runInstructions(run);
  const checks = verificationLines(run);
  const failureText = run.task?.status === "failed" ? taskFailureText(run.task.code, run.rollbackRequired) : null;
  const line = pollLine(poll);

  return (
    <div className="space-y-5">
      <section className={`rounded-2xl border px-5 py-5 sm:px-6 ${tone.box}`} aria-labelledby="run-headline">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">{tone.icon}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{run.operation === "rollback" ? "Rollback of a placement" : "Placement"}</p>
            <h1 id="run-headline" ref={headlineRef} tabIndex={-1} className="mt-0.5 break-words text-2xl font-extrabold tracking-[-0.03em] outline-none">
              {headline.title}
            </h1>
            <p className="mt-1 text-sm leading-6">{headline.detail}</p>
            {showsOrganizationLink(run) && run.targetOrganizationId ? (
              <p className="mt-3">
                <Link href={organizationAccountPath(run.targetOrganizationId)} prefetch={false} className={linkClass}>
                  Open the organization
                </Link>
              </p>
            ) : null}
            {run.status === "rolled_back" || (run.status === "failed" && !run.rollbackRequired) ? (
              <p className="mt-3">
                <Link href={LEGACY_CUSTOMERS_PATH} prefetch={false} className={linkClass}>
                  Back to Legacy customers
                </Link>
              </p>
            ) : null}
          </div>
        </div>
        {/* Said once when the status changes, not on every check. */}
        <p className="sr-only" role="status" aria-live="polite">
          {headline.title}
        </p>
      </section>

      {instructions.length ? (
        <section role="alert" className="rounded-2xl border-2 border-rose-400 bg-white px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-rose-800">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            {run.rollbackRequired ? "Rollback required" : "Action needed"}
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#20304b]">
            {instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 ${cardClass}`} aria-label="Checking this run">
        <p className={`min-w-0 text-sm ${line.stopped ? "font-bold text-rose-800" : "text-slate-600"}`} role={line.stopped ? "alert" : undefined}>
          {line.text}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {poll.stopReason === "session_ended" ? (
            <Link href={sessionRenewPath(placementRunPath(runId))} prefetch={false} className={linkClass}>
              Sign in
            </Link>
          ) : null}
          <button type="button" onClick={() => controller.current?.refresh()} disabled={poll.reading} className={secondaryButton}>
            <RefreshCw className={`h-4 w-4 ${poll.reading ? "animate-spin" : ""}`} aria-hidden="true" />
            {poll.reading ? "Checking" : "Refresh now"}
          </button>
        </div>
      </section>

      <section className={`overflow-hidden ${cardClass}`} aria-labelledby="run-details">
        <h2 id="run-details" className="border-b border-slate-100 px-5 py-4 text-base font-bold text-[#12213a] sm:px-6">
          Run details
        </h2>
        <dl className="divide-y divide-slate-100">
          <Row label="Run id">
            <span className="break-all font-mono text-[13px]">{run.runId}</span>
          </Row>
          <Row label="Status">
            {STATUS_WORDS[run.status]} ({run.operation === "rollback" ? "rollback" : "placement"})
          </Row>
          <Row label="Customer account">{run.userId ? <span className="break-all font-mono text-[13px]">{run.userId}</span> : "Not recorded"}</Row>
          <Row label="Organization">
            {run.createdOrganization ? "A new organization made by this placement" : "An existing organization"}
            {run.targetOrganizationId ? <span className="block break-all font-mono text-[13px] text-slate-600">{run.targetOrganizationId}</span> : null}
          </Row>
          <Row label="Role">
            {roleLabel(run.role)}
            {run.teamId ? ", in a team" : ", in no team"}
          </Row>
          <Row label="Checks">
            <span className="font-bold">{checks.passed === true ? "Passed" : checks.passed === false ? "Did not pass" : "No result"}</span>
            <ul className="mt-1 space-y-0.5">
              {checks.lines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Row>
          {run.proposalsLeftInTarget ? (
            <Row label="Left in the organization">
              {countLabel(run.proposalsLeftInTarget, "proposal")} given to the customer after the placement stayed in the organization and {run.proposalsLeftInTarget === 1 ? "needs" : "need"} a new owner.
            </Row>
          ) : null}
          {failureText ? (
            <Row label={run.task?.operation === "rollback" ? "Why the rollback failed" : "Why it failed"}>
              {failureText}
              {run.task?.code ? <span className="mt-0.5 block break-all font-mono text-[13px] text-slate-600">Code: {run.task.code}</span> : null}
            </Row>
          ) : null}
          <Row label="Requested">{formatInstant(run.createdAt)}</Row>
          {run.task ? (
            <>
              <Row label={run.task.operation === "rollback" ? "Rollback requested" : "Task requested"}>{formatInstant(run.task.requestedAt)}</Row>
              <Row label="Task started">{formatInstant(run.task.startedAt)}</Row>
              <Row label="Last sign of life">{formatInstant(run.task.heartbeatAt)}</Row>
              <Row label="Task finished">{formatInstant(run.task.finishedAt)}</Row>
            </>
          ) : null}
          <Row label="Last updated">{formatInstant(run.updatedAt)}</Row>
        </dl>
      </section>

      {rollbackRefusal ? (
        <section aria-label="The rollback request">
          <FailureNote failure={rollbackRefusal.failure} retryAfterSeconds={rollbackRefusal.retryAfterSeconds}>
            {rollbackRefusal.failure === "session_ended" ? (
              <Link href={sessionRenewPath(placementRunPath(runId))} prefetch={false} className={linkClass}>
                Sign in
              </Link>
            ) : null}
          </FailureNote>
        </section>
      ) : null}

      {canRollBack(run) ? (
        <RollbackPanel
          key={`${run.status}:${run.task?.requestedAt ?? ""}`}
          run={run}
          onOpen={() => setRollbackRefusal(null)}
          onAnswer={(result) => {
            setRollbackRefusal(result.ok ? null : result);
            const next = rollbackFollowUp(runId, result);
            // The confirmation that had the focus is gone, and the panel may go too once the run
            // is read again: the headline is always here, and says what the run is now.
            headlineRef.current?.focus();
            if (next.action === "open") router.push(placementRunPath(next.runId));
            // The same run, now with a rollback task: carry on following it here.
            else if (next.action === "follow") controller.current?.adopt(next.run);
            // A refusal, or no usable answer: the run may not be what is shown. Read it again.
            else controller.current?.recheck();
          }}
        />
      ) : null}
    </div>
  );
}

type RollbackResult = PlacementResult<StartedRun>;

/** The key a rollback request carries: one per time the confirmation is opened. */
const newKey = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/* Rollback, offered only for a run the API will roll back (canRollBack). It has its own
   confirmation, which says what rollback does before anything is sent. */
function RollbackPanel({ run, onOpen, onAnswer }: { run: PlacementRun; onOpen: () => void; onAnswer: (result: RollbackResult) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <section className={`px-5 py-5 sm:px-6 ${cardClass} ${run.rollbackRequired ? "border-rose-300" : ""}`} aria-labelledby="rollback-title">
      <h2 id="rollback-title" className="text-base font-bold text-[#12213a]">
        Roll back this placement
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {run.rollbackRequired
          ? "This run did not finish cleanly. Rolling it back returns the customer's records to where they were."
          : "Undoes this placement: the customer's records go back to where they were before it."}
      </p>
      {open ? (
        <RollbackConfirmation
          run={run}
          onCancel={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
          onAnswer={(result) => {
            if (!result.ok) setOpen(false);
            onAnswer(result);
          }}
        />
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={() => {
            onOpen();
            setOpen(true);
          }}
          className={`mt-4 ${run.rollbackRequired ? dangerButton : secondaryButton}`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Roll back…
        </button>
      )}
    </section>
  );
}

function RollbackConfirmation({
  run,
  onCancel,
  onAnswer,
}: {
  run: PlacementRun;
  onCancel: () => void;
  onAnswer: (result: RollbackResult) => void;
}) {
  const confirmId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [gateState, setGateState] = useState<SubmitState>({ confirmed: false, inFlight: false, done: false });
  const [gate] = useState(() => {
    const key = newKey();
    return createConfirmedSubmit<RollbackResult>({
      send: async () => {
        try {
          return await rollbackPlacementRunAction(run.runId, key);
        } catch {
          return { ok: false, failure: "unavailable" };
        }
      },
      succeeded: (result) => result.ok,
      onChange: setGateState,
    });
  });

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const rollBack = async () => {
    const outcome = await gate.submit();
    if (outcome.sent) onAnswer(outcome.result);
  };
  const busy = gateState.inFlight || gateState.done;

  return (
    <form
      className="mt-4 space-y-4 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-4"
      aria-labelledby={`${confirmId}-title`}
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void rollBack();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onCancel();
      }}
    >
      <h3 id={`${confirmId}-title`} ref={heading} tabIndex={-1} className="text-sm font-extrabold text-rose-900 outline-none">
        Confirm the rollback
      </h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#20304b]">
        {rollbackEffects(run).map((effect) => (
          <li key={effect}>{effect}</li>
        ))}
      </ul>
      <label
        htmlFor={confirmId}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-[#20304b] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#00aeb5]"
      >
        <input
          id={confirmId}
          type="checkbox"
          checked={gateState.confirmed}
          disabled={busy}
          onChange={(event) => gate.setConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4 accent-rose-700"
        />
        <span>I understand what rolling back does, and I want to roll this placement back now.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!gateState.confirmed || busy} className={dangerButton}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Starting the rollback" : "Roll back placement"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={secondaryButton}>
          Cancel
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {busy ? "Starting the rollback." : ""}
      </p>
    </form>
  );
}

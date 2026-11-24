"use client";

import { blockOrganizationAction, reactivateOrganizationAction } from "@/app/actions/organizationManagement";
import { focusRing } from "@/components/organizations/content/ContentChrome";
import { cardClass, dangerButton, inputClass, linkClass, primaryButton, RefusalNote, secondaryButton } from "@/components/organizations/manage/ManageChrome";
import { organizationAccountPath } from "@/lib/organizationAccount";
import { sessionRenewPath } from "@/lib/organizationContent/content";
import { createWriteGate, type WriteGateState } from "@/lib/organizationManagement/confirmGate";
import {
  BLOCK_EFFECTS,
  blockedSinceLabel,
  checkDraft,
  confirmationPhrase,
  emptyDraft,
  organizationLabel,
  organizationWritePath,
  reasonLength,
  REASON_MAX,
  REASON_MIN,
  REASON_RULE,
  refused,
  resultSummary,
  reviewLines,
  WRITE_COPY,
  type DraftErrors,
  type ManagedOrganization,
  type ManagementRefusal,
  type ManagementResult,
  type OrganizationBlockAnswer,
  type OrganizationWrite,
  type WriteDraft,
  type WriteRequest,
} from "@/lib/organizationManagement/management";
import { countLabel } from "@/lib/plural";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

/* A block or a reactivation of a customer organization, the one change staff make from these
   pages: the form, then a review that says in plain words what changes, then an explicit
   confirmation. Nothing is sent before the confirmation, and what is sent is the reviewed
   request, once (lib/organizationManagement/confirmGate.ts). The result shown afterwards is the
   API's own answer: no second read is made to show it. */

type Props = { kind: OrganizationWrite; organization: ManagedOrganization };

type Answered = ManagementResult<OrganizationBlockAnswer>;

/** The one request a confirmed review makes. Only the checked reason of the review is sent. */
const sendWrite = async (kind: OrganizationWrite, organizationId: string, request: WriteRequest): Promise<Answered> => {
  try {
    if (kind === "block") return await blockOrganizationAction(organizationId, { reason: request.reason });
    return await reactivateOrganizationAction(organizationId, { reason: request.reason });
  } catch {
    // The request left the browser and no answer came back: it may have been saved.
    return refused("outcome_unknown");
  }
};

export default function WriteFlow({ kind, organization }: Props) {
  const [draft, setDraft] = useState<WriteDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [review, setReview] = useState<{ id: number; request: WriteRequest } | null>(null);
  const [done, setDone] = useState<OrganizationBlockAnswer | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef<"errors" | "form" | null>(null);

  useEffect(() => {
    if (focusAfter.current === "errors") errorSummary.current?.focus();
    if (focusAfter.current === "form") formHeading.current?.focus();
    focusAfter.current = null;
  });

  const copy = WRITE_COPY[kind];

  if (done) return <ResultStep organization={organization} answer={done} />;

  if (review) {
    return (
      <ReviewStep
        key={review.id}
        kind={kind}
        organization={organization}
        request={review.request}
        onBack={() => {
          focusAfter.current = "form";
          setReview(null);
        }}
        onDone={(answer) => setDone(answer)}
      />
    );
  }

  const editReason = (reason: string) => {
    setDraft({ reason });
    if (errors.reason) setErrors({});
  };
  const toReview = () => {
    const checked = checkDraft(draft);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusAfter.current = "errors";
      return;
    }
    setErrors({});
    // A new review each time: its confirmation starts empty.
    setReview((current) => ({ id: (current?.id ?? 0) + 1, request: checked.request }));
  };
  const errorList = Object.values(errors);

  return (
    <form
      noValidate
      className={`space-y-6 px-5 py-6 sm:px-6 ${cardClass}`}
      onSubmit={(event) => {
        event.preventDefault();
        toReview();
      }}
    >
      <h2 ref={formHeading} tabIndex={-1} className="text-lg font-bold text-[#12213a] outline-none">
        {copy.title}
      </h2>

      {errorList.length ? (
        <div ref={errorSummary} tabIndex={-1} role="alert" className={`rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 ${focusRing}`}>
          <p className="font-bold">Check {countLabel(errorList.length, "field")} before reviewing</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <FormBody kind={kind} organization={organization} />

      <ReasonField value={draft.reason} error={errors.reason} onChange={editReason} />

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" className={primaryButton}>
          Review
        </button>
        <p className="text-xs text-slate-600">Nothing is changed until you confirm on the next step.</p>
      </div>
    </form>
  );
}

/** The written reason a block or a reactivation carries: required, 10 to 500 characters after trimming. */
const ReasonField = ({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) => {
  const id = useId();
  const length = reasonLength(value);
  const outside = length > REASON_MAX || (length > 0 && length < REASON_MIN);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-[#20304b]">
        Reason
      </label>
      <textarea
        id={id}
        required
        rows={4}
        value={value}
        aria-describedby={`${id}-hint ${id}-count${error ? ` ${id}-error` : ""}`}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-28 py-2.5 leading-6 ${inputClass}`}
      />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p id={`${id}-hint`} className="min-w-0 text-xs text-slate-600">
          Required. {REASON_RULE} It is recorded on the RFPilot side only: the organization never sees it.
        </p>
        <p id={`${id}-count`} className={`shrink-0 text-xs font-semibold tabular-nums ${outside ? "text-rose-700" : "text-slate-600"}`}>
          {length.toLocaleString("en-US")} of {REASON_MAX} characters
        </p>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const EffectLists = () => (
  <div className="grid gap-4 sm:grid-cols-2">
    <div>
      <h3 className="text-sm font-bold text-[#20304b]">What a block does</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
        {BLOCK_EFFECTS.does.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
    <div>
      <h3 className="text-sm font-bold text-[#20304b]">What it does not do</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
        {BLOCK_EFFECTS.doesNot.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  </div>
);

/** What the form says of the change, above the reason. */
const FormBody = ({ kind, organization }: { kind: OrganizationWrite; organization: ManagedOrganization }) => {
  switch (kind) {
    case "block":
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            Blocking <span className="break-words font-bold text-[#20304b]">{organizationLabel(organization)}</span> takes effect at once and lasts until the organization is reactivated.
          </p>
          <EffectLists />
        </div>
      );
    default:
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            <span className="break-words font-bold text-[#20304b]">{organizationLabel(organization)}</span>
            {organization.blocked ? ` is blocked (${blockedSinceLabel(organization.blocked)}).` : " is blocked."} Reactivating it lets its members sign in again and makes vendor links, shared
            proposal pages and invitation links work again. Sessions the block ended stay ended, and paused background work runs at its next turn.
          </p>
          <EffectLists />
        </div>
      );
  }
};

function ReviewStep({
  kind,
  organization,
  request,
  onBack,
  onDone,
}: {
  kind: OrganizationWrite;
  organization: ManagedOrganization;
  request: WriteRequest;
  onBack: () => void;
  onDone: (answer: OrganizationBlockAnswer) => void;
}) {
  const confirmId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const refusalNote = useRef<HTMLDivElement>(null);
  const copy = WRITE_COPY[kind];
  // A block is confirmed by typing the organization's name; a reactivation by a tick.
  const requiredName = kind === "block" ? confirmationPhrase(organization) : undefined;
  const [gateState, setGateState] = useState<WriteGateState>({ acknowledged: false, typedName: "", confirmed: false, inFlight: false, done: false });
  const [refusal, setRefusal] = useState<ManagementRefusal | null>(null);
  // One gate for this review: nothing is sent before the confirmation, and a second submit while
  // the first is in flight sends nothing.
  const [gate] = useState(() =>
    createWriteGate<Answered>({
      send: () => sendWrite(kind, organization.id, request),
      succeeded: (result) => result.ok,
      requiredName,
      onChange: setGateState,
    }),
  );

  useEffect(() => {
    heading.current?.focus();
  }, []);
  // A refusal turns the confirm control off (the confirmation is asked for again), which would
  // drop the focus on the page. It goes to the refusal, which sits above the confirmation.
  useEffect(() => {
    if (refusal) refusalNote.current?.focus();
  }, [refusal]);

  const confirm = async () => {
    setRefusal(null);
    const outcome = await gate.submit();
    if (!outcome.sent) return;
    if (!outcome.result.ok) {
      setRefusal(outcome.result);
      return;
    }
    onDone(outcome.result.data);
  };

  const busy = gateState.inFlight || gateState.done;
  const lines = reviewLines(kind, { organization });

  return (
    <form
      className={`space-y-5 px-5 py-6 sm:px-6 ${cardClass}`}
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <h2 ref={heading} tabIndex={-1} className="text-lg font-bold text-[#12213a] outline-none">
        {`Review: ${copy.title.toLowerCase()}`}
      </h2>
      <ul className="space-y-2 text-sm leading-6 text-[#20304b]">
        {lines.map((line) => (
          <li key={line} className="break-words rounded-xl bg-slate-50 px-4 py-2.5">
            {line}
          </li>
        ))}
      </ul>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Exactly what this change names">
        <ReviewFact label="Organization" value={organizationLabel(organization)} detail={`Id: ${organization.id}`} />
        <ReviewFact label="Reason, as typed" value={request.reason} preserve />
      </dl>
      <p className="text-sm text-slate-600">The reason is recorded with this change on the RFPilot side only. The organization sees the result, not the reason and not who made it.</p>

      {refusal ? (
        <div ref={refusalNote} tabIndex={-1} className={`rounded-xl ${focusRing}`}>
          <RefusalNote refusal={refusal}>
            {refusal.failure === "session_ended" ? (
              <Link href={sessionRenewPath(organizationWritePath(organization.id, kind))} prefetch={false} className={linkClass}>
                Sign in
              </Link>
            ) : null}
            {refusal.failure === "outcome_unknown" ? (
              <Link href={organizationAccountPath(organization.id)} prefetch={false} className={linkClass}>
                Open the organization to check
              </Link>
            ) : null}
          </RefusalNote>
        </div>
      ) : null}

      {requiredName !== undefined ? (
        <div className="space-y-1.5">
          <label htmlFor={confirmId} className="block text-sm font-bold text-[#20304b]">
            {organization.name.trim() ? "Type the organization's name to confirm" : "This organization has no name. Type its id to confirm"}
          </label>
          <p id={`${confirmId}-hint`} className="break-words text-sm text-slate-600">
            Type <span className="break-all font-mono font-bold text-[#20304b]">{requiredName}</span> exactly as shown. {copy.confirm} stays off until it matches.
          </p>
          <input
            id={confirmId}
            type="text"
            value={gateState.typedName}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={`${confirmId}-hint`}
            onChange={(event) => gate.setTypedName(event.target.value)}
            className={`h-11 ${inputClass}`}
          />
        </div>
      ) : (
        <label
          htmlFor={confirmId}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-[#20304b] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#00aeb5]"
        >
          <input
            id={confirmId}
            type="checkbox"
            checked={gateState.acknowledged}
            disabled={busy}
            onChange={(event) => gate.setAcknowledged(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#007f86]"
          />
          <span>I have checked the organization and the change above, and I want to make this change now.</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" disabled={!gateState.confirmed || busy} className={copy.danger ? dangerButton : primaryButton}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {gateState.inFlight ? copy.sending : copy.confirm}
        </button>
        <button type="button" onClick={onBack} disabled={busy} className={secondaryButton}>
          Back to edit
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {gateState.inFlight ? `${copy.sending}.` : ""}
      </p>
    </form>
  );
}

const ReviewFact = ({ label, value, detail, preserve = false }: { label: string; value: string; detail?: string; preserve?: boolean }) => (
  <div className="grid gap-0.5 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
    <dt className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 sm:pt-0.5">{label}</dt>
    <dd className="min-w-0 text-sm text-[#20304b]">
      <span className={`block break-words ${preserve ? "whitespace-pre-wrap" : "font-bold"}`}>{value}</span>
      {detail ? <span className="block break-all font-mono text-[13px] text-slate-600">{detail}</span> : null}
    </dd>
  </div>
);

/** What the API answered. The ways on are links: each opens a page that reads what it shows. */
function ResultStep({ organization, answer }: { organization: ManagedOrganization; answer: OrganizationBlockAnswer }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const summary = resultSummary({ organization }, answer);
  return (
    <section className={`space-y-4 px-5 py-6 sm:px-6 ${cardClass}`} role="status" aria-live="polite">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-bold text-[#12213a] outline-none">
        {summary.title}
      </h2>
      <ul className="space-y-2 text-sm leading-6 text-[#20304b]">
        {summary.lines.map((line) => (
          <li key={line} className="break-words rounded-xl bg-slate-50 px-4 py-2.5">
            {line}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-600">This is the server&apos;s own answer to the change. It was recorded on the RFPilot side with your reason.</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
        <Link href={organizationAccountPath(organization.id)} prefetch={false} className={linkClass}>
          Back to the organization
        </Link>
      </div>
    </section>
  );
}

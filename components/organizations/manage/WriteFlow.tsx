"use client";

import {
  blockOrganizationAction,
  changeMemberRoleAction,
  deactivateMemberAction,
  getManagedMemberAction,
  reactivateMemberAction,
  reactivateOrganizationAction,
  reassignMemberProposalsAction,
  transferOwnershipAction,
} from "@/app/actions/organizationManagement";
import { focusRing } from "@/components/organizations/content/ContentChrome";
import { cardClass, dangerButton, inputClass, linkClass, NotOfferedState, primaryButton, RefusalNote, secondaryButton } from "@/components/organizations/manage/ManageChrome";
import ReassignTargetPicker from "@/components/organizations/manage/ReassignTargetPicker";
import { organizationAccountPath } from "@/lib/organizationAccount";
import { organizationMembersPath, roleLabel, sessionRenewPath } from "@/lib/organizationContent/content";
import { createWriteGate, type WriteGateState } from "@/lib/organizationManagement/confirmGate";
import {
  BLOCK_EFFECTS,
  blockedSinceLabel,
  checkDraft,
  confirmationPhrase,
  currentOwnerLine,
  currentRoleLabel,
  emptyDraft,
  isMemberWrite,
  memberLabel,
  memberManagementPath,
  memberWritePath,
  memberWritesFor,
  organizationLabel,
  organizationWritePath,
  reasonLength,
  REASON_MAX,
  REASON_MIN,
  REASON_RULE,
  reassignBeforeDeactivatePath,
  refused,
  resultSummary,
  reviewLines,
  roleChoicesFor,
  unknownOutcomeFollowUp,
  WRITE_COPY,
  type DraftErrors,
  type DraftField,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementRefusal,
  type ManagementResult,
  type ResultHistory,
  type UnknownOutcomeFollowUp,
  type WriteAnswer,
  type WriteDraft,
  type WriteKind,
  type WriteRequest,
} from "@/lib/organizationManagement/management";
import { countLabel } from "@/lib/plural";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/* One staff write to a customer organization: the form, then a review that says in plain words
   who and what changes, then an explicit confirmation. Nothing is sent before the confirmation,
   and what is sent is the reviewed request, once (lib/organizationManagement/confirmGate.ts).
   The result shown afterwards is the API's own answer: no second read is made to show it. */

type Props = {
  kind: WriteKind;
  organization: ManagedOrganization;
  /** The member the write is about, with the version it was loaded at. Absent for a block or a reactivation of the organization. */
  member?: ManagedMember;
  /** A reassignment opened from a refused deactivation: the result leads back to it. */
  continueToDeactivate?: boolean;
};

type Answered = ManagementResult<WriteAnswer>;

/** The one request a confirmed review makes. Only the checked values of the review are sent. */
const sendWrite = async (kind: WriteKind, organizationId: string, member: ManagedMember | null, request: WriteRequest): Promise<Answered> => {
  try {
    if (kind === "block") return await blockOrganizationAction(organizationId, { reason: request.reason });
    if (kind === "unblock") return await reactivateOrganizationAction(organizationId, { reason: request.reason });
    if (!member) return refused("invalid_request");
    const { userId } = member.member;
    switch (kind) {
      case "role":
        return await changeMemberRoleAction(organizationId, userId, { role: request.role, version: member.version, reason: request.reason });
      case "deactivate":
        return await deactivateMemberAction(organizationId, userId, { version: member.version, reason: request.reason });
      case "reactivate":
        return await reactivateMemberAction(organizationId, userId, { version: member.version, reason: request.reason });
      case "reassign":
        return await reassignMemberProposalsAction(organizationId, userId, { toUserId: request.target?.userId, reason: request.reason });
      default:
        return await transferOwnershipAction(organizationId, { toUserId: userId, version: member.version, reason: request.reason });
    }
  } catch {
    // The request left the browser and no answer came back: it may have been saved.
    return refused("outcome_unknown");
  }
};

export default function WriteFlow({ kind, organization, member, continueToDeactivate = false }: Props) {
  const [managed, setManaged] = useState<ManagedMember | null>(member ?? null);
  const [draft, setDraft] = useState<WriteDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [review, setReview] = useState<{ id: number; request: WriteRequest } | null>(null);
  const [done, setDone] = useState<{ request: WriteRequest; answer: WriteAnswer; history?: ResultHistory } | null>(null);
  // The reviewed request whose answer never said whether it was saved. A new review forgets it.
  const [unknownRequest, setUnknownRequest] = useState<WriteRequest | null>(null);
  // Set when the member, loaded again after that, already shows what the request asked for.
  const [saved, setSaved] = useState<{ id: number; request: WriteRequest } | null>(null);
  // Whether any attempt from this page got no confirmed answer. Never forgotten: a later result
  // (a reassignment that finds nothing to move) must say the earlier attempt may have been saved.
  const [everUnknown, setEverUnknown] = useState(false);
  const outcomeUnknown = (request: WriteRequest) => {
    setUnknownRequest(request);
    setEverUnknown(true);
  };
  const [reload, setReload] = useState<{ phase: "idle" | "loading" | "loaded" } | { phase: "failed"; refusal: ManagementRefusal }>({ phase: "idle" });
  const errorSummary = useRef<HTMLDivElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef<"errors" | "form" | null>(null);

  useEffect(() => {
    if (focusAfter.current === "errors") errorSummary.current?.focus();
    if (focusAfter.current === "form") formHeading.current?.focus();
    focusAfter.current = null;
  });

  const copy = WRITE_COPY[kind];

  if (done) {
    return (
      <ResultStep kind={kind} organization={organization} member={managed} request={done.request} answer={done.answer} history={{ ...done.history, afterUnknownOutcome: everUnknown }} continueToDeactivate={continueToDeactivate} />
    );
  }

  /* The one read this flow makes after the page has loaded, and only when staff ask for it: the
     member as they are now, with the version the next try needs. */
  const loadCurrentMember = async () => {
    if (!managed || reload.phase === "loading") return;
    setReload({ phase: "loading" });
    let result: ManagementResult<ManagedMember>;
    try {
      result = await getManagedMemberAction(organization.id, managed.member.userId);
    } catch {
      result = refused("unavailable");
    }
    if (!result.ok) {
      setReload({ phase: "failed", refusal: result });
      return;
    }
    setManaged(result.data);
    setReview(null);
    // After an unknown outcome the member may already show what was asked for: that is said, and
    // the form (which no longer offers the change) is not shown in its place.
    const shown = unknownRequest ? unknownOutcomeFollowUp(kind, { organization, member: result.data.member }, unknownRequest) : null;
    setSaved((current) => (shown && unknownRequest ? { id: (current?.id ?? 0) + 1, request: unknownRequest } : null));
    setReload({ phase: "loaded" });
    focusAfter.current = "form";
  };

  const followUp = saved && managed ? unknownOutcomeFollowUp(kind, { organization, member: managed.member }, saved.request) : null;
  if (saved && managed && followUp) {
    // The one resend: the same reviewed request with the member's new version, through the same
    // confirmation gate as any write. Where the backend would refuse it, nothing is offered.
    return followUp.resend ? (
      <ReviewStep
        key={`finish-${saved.id}`}
        kind={kind}
        organization={organization}
        member={managed}
        request={saved.request}
        finish={followUp}
        reload={reload}
        onLoadCurrentMember={loadCurrentMember}
        onUnknownOutcome={() => outcomeUnknown(saved.request)}
        onBack={() => undefined}
        onDone={(answer) => setDone({ request: saved.request, answer, history: { finishingSignOut: true } })}
      />
    ) : (
      <SavedStep organizationId={organization.id} memberId={managed.member.userId} followUp={followUp} />
    );
  }

  // After the member was loaded again, the write may no longer be one their state offers.
  if (isMemberWrite(kind) && managed && !memberWritesFor(managed.member).includes(kind)) {
    return (
      <NotOfferedState title={`${copy.title} is not available for this member now`} message={`${memberLabel(managed.member)} changed since this page was opened. Open the member to see what can be changed now.`}>
        <Link href={memberManagementPath(organization.id, managed.member.userId)} prefetch={false} className={linkClass}>
          Back to this member
        </Link>
      </NotOfferedState>
    );
  }

  if (review) {
    return (
      <ReviewStep
        key={review.id}
        kind={kind}
        organization={organization}
        member={managed}
        request={review.request}
        reload={reload}
        onLoadCurrentMember={loadCurrentMember}
        onUnknownOutcome={() => outcomeUnknown(review.request)}
        onBack={() => {
          focusAfter.current = "form";
          setReview(null);
        }}
        onDone={(answer) => setDone({ request: review.request, answer })}
      />
    );
  }

  const edit = (change: Partial<WriteDraft>, field: DraftField) => {
    setDraft((current) => ({ ...current, ...change }));
    if (errors[field]) {
      setErrors((current) => {
        const rest = { ...current };
        delete rest[field];
        return rest;
      });
    }
  };
  const toReview = () => {
    const checked = checkDraft(kind, draft, managed?.member);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusAfter.current = "errors";
      return;
    }
    setErrors({});
    setReload({ phase: "idle" });
    setUnknownRequest(null);
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
        {isMemberWrite(kind) ? <span className="block break-words text-sm font-semibold text-slate-600">in {organizationLabel(organization)}</span> : null}
      </h2>

      {reload.phase === "loaded" ? (
        <p role="status" className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
          The member was loaded again and is shown as they are now. Check the details, then review the change again.
        </p>
      ) : null}

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

      {organization.blocked && isMemberWrite(kind) ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          This organization is blocked ({blockedSinceLabel(organization.blocked)}). Its members can still be managed; nobody in it can sign in until it is reactivated.
        </p>
      ) : null}

      <FormBody kind={kind} organization={organization} member={managed} draft={draft} errors={errors} edit={edit} />

      <ReasonField value={draft.reason} error={errors.reason} onChange={(reason) => edit({ reason }, "reason")} />

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" className={primaryButton}>
          Review
        </button>
        <p className="text-xs text-slate-600">Nothing is changed until you confirm on the next step.</p>
      </div>
    </form>
  );
}

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (ids: { id: string; describedBy?: string; invalid?: true }) => ReactNode;
}) => {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-[#20304b]">
        {label}
      </label>
      {children({ id, describedBy, invalid: error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
};

/** The written reason every staff write carries: required, 10 to 500 characters after trimming. */
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

/** What each write asks for besides the reason. */
const FormBody = ({
  kind,
  organization,
  member,
  draft,
  errors,
  edit,
}: {
  kind: WriteKind;
  organization: ManagedOrganization;
  member: ManagedMember | null;
  draft: WriteDraft;
  errors: DraftErrors;
  edit: (change: Partial<WriteDraft>, field: DraftField) => void;
}) => {
  const who = member ? memberLabel(member.member) : "This member";
  switch (kind) {
    case "role":
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            <span className="break-words font-bold text-[#20304b]">{who}</span> has the role {member ? currentRoleLabel(member.member) : "No role"} now.
          </p>
          <Field label="New role" hint="Owner is not in this list: the Owner role only moves by a transfer of ownership." error={errors.role}>
            {({ id, describedBy, invalid }) => (
              <select id={id} value={draft.role} aria-describedby={describedBy} aria-invalid={invalid} onChange={(event) => edit({ role: event.target.value }, "role")} className={`h-11 ${inputClass}`}>
                <option value="">Choose a role</option>
                {(member ? roleChoicesFor(member.member) : []).map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      );
    case "deactivate":
      return (
        <p className="text-sm leading-6 text-slate-600">
          <span className="break-words font-bold text-[#20304b]">{who}</span> is signed out everywhere at once and can&apos;t sign in until they are reactivated. Their role and their data are
          kept. If they still own proposals the API refuses, and this page then leads to reassigning them.
        </p>
      );
    case "reactivate":
      return (
        <p className="text-sm leading-6 text-slate-600">
          <span className="break-words font-bold text-[#20304b]">{who}</span> can sign in again, with the role {member ? currentRoleLabel(member.member) : "they had"}.
        </p>
      );
    case "reassign":
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            Every proposal <span className="break-words font-bold text-[#20304b]">{who}</span> owns moves to the member you choose. Only the owner of each proposal changes; nothing in the
            proposals is changed.
          </p>
          {member ? (
            <ReassignTargetPicker
              organizationId={organization.id}
              fromUserId={member.member.userId}
              chosen={draft.target}
              error={errors.target}
              onChoose={(target) => edit({ target }, "target")}
            />
          ) : null}
        </div>
      );
    case "transfer":
      return (
        <div className="space-y-2 text-sm leading-6 text-slate-600">
          <p>
            <span className="break-words font-bold text-[#20304b]">{who}</span> becomes the Owner of <span className="break-words font-bold text-[#20304b]">{organizationLabel(organization)}</span>.
          </p>
          <p className="break-words">{currentOwnerLine(organization)} An organization has exactly one Owner.</p>
        </div>
      );
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
  member,
  request,
  finish,
  reload,
  onLoadCurrentMember,
  onUnknownOutcome,
  onBack,
  onDone,
}: {
  kind: WriteKind;
  organization: ManagedOrganization;
  member: ManagedMember | null;
  request: WriteRequest;
  /** Set when this step is the resend after an unknown outcome that turned out saved. */
  finish?: UnknownOutcomeFollowUp;
  reload: { phase: "idle" | "loading" | "loaded" } | { phase: "failed"; refusal: ManagementRefusal };
  onLoadCurrentMember: () => void;
  onUnknownOutcome: () => void;
  onBack: () => void;
  onDone: (answer: WriteAnswer) => void;
}) {
  const confirmId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const refusalNote = useRef<HTMLDivElement>(null);
  const copy = finish?.resend ? { ...WRITE_COPY[kind], confirm: finish.resend.label, sending: finish.resend.sending, danger: false } : WRITE_COPY[kind];
  // A transfer and a block are confirmed by typing the organization's name; the rest by a tick.
  const requiredName = kind === "transfer" || kind === "block" ? confirmationPhrase(organization) : undefined;
  const [gateState, setGateState] = useState<WriteGateState>({ acknowledged: false, typedName: "", confirmed: false, inFlight: false, done: false });
  const [refusal, setRefusal] = useState<ManagementRefusal | null>(null);
  // One gate for this review: nothing is sent before the confirmation, and a second submit while
  // the first is in flight sends nothing.
  const [gate] = useState(() =>
    createWriteGate<Answered>({
      send: () => sendWrite(kind, organization.id, member, request),
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
      if (outcome.result.failure === "outcome_unknown") onUnknownOutcome();
      return;
    }
    onDone(outcome.result.data);
  };

  const busy = gateState.inFlight || gateState.done;
  const lines = finish ? finish.lines : reviewLines(kind, { organization, member: member?.member }, request);
  const memberId = member?.member.userId;
  // The member's state is what the next try depends on: these refusals offer to load it again.
  const offersReload = Boolean(member) && refusal !== null && ["stale_version", "version_required", "outcome_unknown"].includes(refusal.failure);

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
        {finish ? finish.title : `Review: ${copy.title.toLowerCase()}`}
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
        {member ? <ReviewFact label={kind === "transfer" ? "New Owner" : "Member"} value={memberLabel(member.member)} detail={`Id: ${member.member.userId}`} /> : null}
        {kind === "role" && member && request.role && !finish ? <ReviewFact label="Role" value={`${currentRoleLabel(member.member)} to ${roleLabel(request.role)}`} /> : null}
        {kind === "reassign" && request.target ? <ReviewFact label="Proposals go to" value={memberLabel(request.target)} detail={`Id: ${request.target.userId}`} /> : null}
        <ReviewFact label="Reason, as typed" value={request.reason} preserve />
      </dl>
      <p className="text-sm text-slate-600">The reason is recorded with this change on the RFPilot side only. The organization sees the result, not the reason and not who made it.</p>

      {refusal ? (
        <div ref={refusalNote} tabIndex={-1} className={`rounded-xl ${focusRing}`}>
          <RefusalNote refusal={refusal}>
            {refusal.failure === "session_ended" ? (
              <Link
                href={sessionRenewPath(memberId && isMemberWrite(kind) ? memberWritePath(organization.id, memberId, kind) : organizationWritePath(organization.id, kind === "block" ? "block" : "unblock"))}
                prefetch={false}
                className={linkClass}
              >
                Sign in
              </Link>
            ) : null}
            {refusal.failure === "owner_has_proposals" && memberId ? (
              <Link href={kind === "deactivate" ? reassignBeforeDeactivatePath(organization.id, memberId) : memberWritePath(organization.id, memberId, "reassign")} prefetch={false} className={linkClass}>
                Reassign this member&apos;s proposals
              </Link>
            ) : null}
            {refusal.failure === "ownership_transfer_required" && memberId ? (
              <Link href={memberManagementPath(organization.id, memberId)} prefetch={false} className={linkClass}>
                Back to this member
              </Link>
            ) : null}
            {refusal.failure === "owner_changed" && memberId ? (
              <Link href={memberWritePath(organization.id, memberId, "transfer")} prefetch={false} className={linkClass}>
                Open this page again
              </Link>
            ) : null}
            {!member && refusal.failure === "outcome_unknown" ? (
              <Link href={organizationAccountPath(organization.id)} prefetch={false} className={linkClass}>
                Open the organization to check
              </Link>
            ) : null}
            {offersReload ? (
              <button type="button" onClick={onLoadCurrentMember} disabled={reload.phase === "loading" || busy} className={secondaryButton}>
                {reload.phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {reload.phase === "loading" ? "Loading the current member" : "Load the current member"}
              </button>
            ) : null}
          </RefusalNote>
          {offersReload ? <p className="mt-2 text-xs text-slate-600">Loading the member is one more recorded view of them. Nothing is loaded until you press it.</p> : null}
          {reload.phase === "failed" ? (
            <div className="mt-2">
              <RefusalNote refusal={reload.refusal} />
            </div>
          ) : null}
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
          <span>
            {finish
              ? "I have checked the organization and the member above, and I want to send this request again now."
              : "I have checked the organization, the member and the change above, and I want to make this change now."}
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" disabled={!gateState.confirmed || busy} className={copy.danger ? dangerButton : primaryButton}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {gateState.inFlight ? copy.sending : copy.confirm}
        </button>
        {finish ? (
          memberId ? (
            <Link href={memberManagementPath(organization.id, memberId)} prefetch={false} className={linkClass}>
              Back to this member
            </Link>
          ) : null
        ) : (
          <button type="button" onClick={onBack} disabled={busy} className={secondaryButton}>
            Back to edit
          </button>
        )}
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

/** After an unknown outcome, the member loaded again shows the change and no resend applies. */
function SavedStep({ organizationId, memberId, followUp }: { organizationId: string; memberId: string; followUp: UnknownOutcomeFollowUp }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className={`space-y-4 px-5 py-6 sm:px-6 ${cardClass}`} role="status" aria-live="polite">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-bold text-[#12213a] outline-none">
        {followUp.title}
      </h2>
      <ul className="space-y-2 text-sm leading-6 text-[#20304b]">
        {followUp.lines.map((line) => (
          <li key={line} className="break-words rounded-xl bg-slate-50 px-4 py-2.5">
            {line}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-600">This is from the member as loaded again just now, not from an answer to the change.</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
        <Link href={memberManagementPath(organizationId, memberId)} prefetch={false} className={linkClass}>
          Back to this member
        </Link>
        <Link href={organizationMembersPath(organizationId)} prefetch={false} className={linkClass}>
          Members list
        </Link>
      </div>
    </section>
  );
}

/** What the API answered. The ways on are links: each opens a page that reads what it shows. */
function ResultStep({
  kind,
  organization,
  member,
  request,
  answer,
  history,
  continueToDeactivate,
}: {
  kind: WriteKind;
  organization: ManagedOrganization;
  member: ManagedMember | null;
  request: WriteRequest;
  answer: WriteAnswer;
  history?: ResultHistory;
  continueToDeactivate: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const summary = resultSummary(kind, { organization, member: member?.member }, request, answer, history);
  const memberId = member?.member.userId;
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
        {kind === "reassign" && continueToDeactivate && memberId ? (
          <Link href={memberWritePath(organization.id, memberId, "deactivate")} prefetch={false} className={linkClass}>
            Continue to deactivate this member
          </Link>
        ) : null}
        {memberId ? (
          <>
            <Link href={memberManagementPath(organization.id, memberId)} prefetch={false} className={linkClass}>
              Back to this member
            </Link>
            <Link href={organizationMembersPath(organization.id)} prefetch={false} className={linkClass}>
              Members list
            </Link>
          </>
        ) : (
          <Link href={organizationAccountPath(organization.id)} prefetch={false} className={linkClass}>
            Back to the organization
          </Link>
        )}
      </div>
    </section>
  );
}

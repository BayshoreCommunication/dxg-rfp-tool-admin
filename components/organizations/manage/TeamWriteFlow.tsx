"use client";

import {
  addTeamMemberAction,
  archiveTeamAction,
  createTeamAction,
  getManagedMemberAction,
  removeTeamMemberAction,
  renameTeamAction,
  setMemberTeamsAction,
  setTeamManagerAction,
} from "@/app/actions/organizationManagement";
import { focusRing } from "@/components/organizations/content/ContentChrome";
import { cardClass, dangerButton, inputClass, linkClass, NotOfferedState, primaryButton, RefusalNote, secondaryButton } from "@/components/organizations/manage/ManageChrome";
import TeamMemberPicker from "@/components/organizations/manage/TeamMemberPicker";
import { Field, ReasonField, ReviewFact } from "@/components/organizations/manage/WriteFlow";
import { organizationMembersPath, organizationTeamsPath, rolesLabel, sessionRenewPath } from "@/lib/organizationContent/content";
import { createWriteGate, type WriteGateState } from "@/lib/organizationManagement/confirmGate";
import {
  blockedSinceLabel,
  memberLabel,
  memberManagementPath,
  organizationLabel,
  refused,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementRefusal,
  type ManagementResult,
} from "@/lib/organizationManagement/management";
import {
  ARCHIVE_EFFECTS,
  checkTeamDraft,
  currentTeams,
  emptyTeamDraft,
  holdsTeamManagerRole,
  initialTeamIds,
  isTeamMemberWrite,
  isTeamOnlyWrite,
  MANAGER_REACH,
  MEMBER_TEAMS_EFFECTS,
  MEMBER_TEAMS_MAX,
  memberTeamsAtBound,
  memberTeamsBlock,
  memberTeamsOffered,
  memberTeamsPath,
  memberTeamsTooMany,
  NO_SESSION_ENDED,
  reloadedTeamDraft,
  reviewMemberTeams,
  TEAM_NAME_RULE,
  TEAM_WRITE_COPY,
  teamCreatePath,
  teamManagementPath,
  teamMemberWritePath,
  teamResultSummary,
  teamReviewLines,
  teamsChangedNotice,
  teamWritePath,
  type TeamChoice,
  type TeamDraft,
  type TeamDraftErrors,
  type TeamDraftField,
  type TeamRequest,
  type TeamReviewContext,
  type TeamWrite,
  type TeamWriteAnswer,
} from "@/lib/organizationManagement/teams";
import { countLabel } from "@/lib/plural";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

/* One staff write to a customer organization's teams: the form, then a review that says in plain
   words who and what changes, then an explicit confirmation. Nothing is sent before the
   confirmation, and what is sent is the reviewed request, once: the gate is the member flow's own
   (lib/organizationManagement/confirmGate.ts), and so are the reason field, the review facts, the
   refusal note and the frame. The result shown afterwards is the API's own answer: no second read
   is made to show it.

   Why this is a sibling of WriteFlow.tsx and not a branch inside it: the member flow carries the
   member-only steps (the resend after an unknown outcome, the chain from a refused deactivation)
   and its source is pinned line by line by its guard; a team write through it would have changed
   those lines. */

type TeamRef = { id: string; name: string };

type Props = {
  kind: TeamWrite;
  organization: ManagedOrganization;
  /** The team the write is about. Absent for a create and for a member's teams. */
  team?: TeamRef;
  /** The member the write is about, with the version it was loaded at. */
  member?: ManagedMember;
  /** Whether that member manages the team now. */
  isManager?: boolean;
  /** The organization's active teams: what a member's teams are chosen from. */
  choices?: TeamChoice[];
  /** Whether the Teams list those came from reached its bound. */
  choicesCut?: boolean;
};

type Answered = ManagementResult<TeamWriteAnswer>;
type Subject = { team: TeamRef | null; member: ManagedMember | null };
type Reload = { phase: "idle" | "loading" | "loaded" } | { phase: "failed"; refusal: ManagementRefusal };

/** The one request a confirmed review makes. Only the checked values of the review are sent. */
const sendTeamWrite = async (kind: TeamWrite, organizationId: string, subject: Subject, request: TeamRequest): Promise<Answered> => {
  const { team, member } = subject;
  try {
    if (kind === "create") return await createTeamAction(organizationId, { name: request.name, reason: request.reason });
    if (kind === "memberTeams") {
      if (!member) return refused("invalid_request");
      return await setMemberTeamsAction(organizationId, member.member.userId, { teamIds: request.teamIds, version: member.version, reason: request.reason });
    }
    if (!team) return refused("invalid_request");
    switch (kind) {
      case "rename":
        return await renameTeamAction(organizationId, team.id, { name: request.name, reason: request.reason });
      case "archive":
        return await archiveTeamAction(organizationId, team.id, { reason: request.reason });
      case "addMember":
        return await addTeamMemberAction(organizationId, team.id, { userId: request.target?.userId, isManager: request.isManager === true, reason: request.reason });
      default:
        if (!member) return refused("invalid_request");
        return kind === "removeMember"
          ? await removeTeamMemberAction(organizationId, team.id, member.member.userId, { reason: request.reason })
          : await setTeamManagerAction(organizationId, team.id, member.member.userId, { isManager: request.isManager, reason: request.reason });
    }
  } catch {
    // The request left the browser and no answer came back: it may have been saved.
    return refused("outcome_unknown");
  }
};

/** The address of the page a flow is on: where signing in again returns to. */
const flowPath = (kind: TeamWrite, organizationId: string, subject: Subject): string => {
  const { team, member } = subject;
  if (kind === "memberTeams" && member) return memberTeamsPath(organizationId, member.member.userId);
  if (team && member && isTeamMemberWrite(kind)) return teamMemberWritePath(organizationId, team.id, member.member.userId, kind);
  if (team && isTeamOnlyWrite(kind)) return teamWritePath(organizationId, team.id, kind);
  return teamCreatePath(organizationId);
};

export default function TeamWriteFlow({ kind, organization, team, member, isManager = false, choices = [], choicesCut = false }: Props) {
  const [managed, setManaged] = useState<ManagedMember | null>(member ?? null);
  const [draft, setDraft] = useState<TeamDraft>(() => emptyTeamDraft(kind === "memberTeams" && member ? initialTeamIds(member.member, choices) : []));
  const [errors, setErrors] = useState<TeamDraftErrors>({});
  // The member the ticks were filled in from: what changed since is named on the review.
  const [basis, setBasis] = useState<ManagedMember | null>(member ?? null);
  const [review, setReview] = useState<{ id: number; request: TeamRequest; notice: string | null } | null>(null);
  const [reviewRead, setReviewRead] = useState<Reload>({ phase: "idle" });
  const [done, setDone] = useState<{ request: TeamRequest; answer: TeamWriteAnswer } | null>(null);
  const [reload, setReload] = useState<Reload>({ phase: "idle" });
  const errorSummary = useRef<HTMLDivElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef<"errors" | "form" | null>(null);

  useEffect(() => {
    if (focusAfter.current === "errors") errorSummary.current?.focus();
    if (focusAfter.current === "form") formHeading.current?.focus();
    focusAfter.current = null;
  });

  const copy = TEAM_WRITE_COPY[kind];
  const subject: Subject = { team: team ?? null, member: managed };
  const context: TeamReviewContext = { organization, team, member: managed?.member, isManager, choices };

  if (done) return <TeamResultStep kind={kind} context={context} request={done.request} answer={done.answer} />;

  /* The one read this flow makes after the page has loaded, and only when staff ask for it: the
     member as they are now, with their teams and the version the next try needs. */
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
    // The ticks start again from the member as they are now, and so does what the review compares against.
    setBasis(result.data);
    setDraft((current) => reloadedTeamDraft(current, result.data.member, choices));
    setErrors({});
    setReview(null);
    setReload({ phase: "loaded" });
    focusAfter.current = "form";
  };

  // After the member was loaded again, their teams may no longer be something this screen sets.
  if (kind === "memberTeams" && managed && (!memberTeamsOffered(managed.member) || memberTeamsAtBound(managed.member))) {
    return (
      <NotOfferedState
        title="Changing teams is not available for this member now"
        message={
          memberTeamsOffered(managed.member)
            ? memberTeamsTooMany(memberLabel(managed.member))
            : `${memberLabel(managed.member)} changed since this page was opened. Open the member to see what can be changed now.`
        }
      >
        <Link href={memberManagementPath(organization.id, managed.member.userId)} prefetch={false} className={linkClass}>
          Back to this member
        </Link>
        <Link href={organizationTeamsPath(organization.id)} prefetch={false} className={linkClass}>
          Teams list
        </Link>
      </NotOfferedState>
    );
  }

  if (review) {
    return (
      <TeamReviewStep
        key={review.id}
        kind={kind}
        context={context}
        subject={subject}
        request={review.request}
        notice={review.notice}
        reload={reload}
        onLoadCurrentMember={loadCurrentMember}
        onBack={() => {
          focusAfter.current = "form";
          setReview(null);
        }}
        onDone={(answer) => setDone({ request: review.request, answer })}
      />
    );
  }

  const edit = (change: Partial<TeamDraft>, field: TeamDraftField) => {
    setDraft((current) => ({ ...current, ...change }));
    if (errors[field]) {
      setErrors((current) => {
        const rest = { ...current };
        delete rest[field];
        return rest;
      });
    }
  };
  // A member's teams can't be reviewed when the page can't offer every active team they are on.
  const block = kind === "memberTeams" ? memberTeamsBlock(managed?.member, choices, choicesCut) : null;
  /* A member's teams: the request replaces the whole set, so each press of Review reads the member
     again (one more recorded read, on the press only) and the review is built from that read. A
     read that fails shows no review. */
  const toMemberTeamsReview = async (loaded: ManagedMember) => {
    if (reviewRead.phase === "loading") return;
    setReviewRead({ phase: "loading" });
    const outcome = await reviewMemberTeams({ member: getManagedMemberAction }, organization.id, basis ?? loaded, draft, choices, choicesCut);
    if (outcome.state === "read_failed") {
      setReviewRead({ phase: "failed", refusal: outcome.refusal });
      return;
    }
    setReviewRead({ phase: "idle" });
    if (outcome.state === "invalid") {
      setErrors(outcome.errors);
      focusAfter.current = "errors";
      return;
    }
    // The member as read now: what the form, the review and the request's version are about.
    setManaged(outcome.member);
    if (outcome.state === "not_offered") return;
    if (outcome.state === "refused") {
      setErrors(outcome.errors);
      focusAfter.current = "errors";
      return;
    }
    setErrors({});
    setReload({ phase: "idle" });
    const notice = teamsChangedNotice(memberLabel(outcome.member.member), outcome.changed);
    setReview((current) => ({ id: (current?.id ?? 0) + 1, request: outcome.request, notice }));
  };
  const toReview = () => {
    if (block) return;
    if (kind === "memberTeams" && managed) {
      void toMemberTeamsReview(managed);
      return;
    }
    const checked = checkTeamDraft(kind, draft, { teamName: team?.name, member: managed?.member, choices, choicesCut });
    if (!checked.ok) {
      setErrors(checked.errors);
      focusAfter.current = "errors";
      return;
    }
    setErrors({});
    setReload({ phase: "idle" });
    // A new review each time: its confirmation starts empty.
    setReview((current) => ({ id: (current?.id ?? 0) + 1, request: checked.request, notice: null }));
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
        <span className="block break-words text-sm font-semibold text-slate-600">in {organizationLabel(organization)}</span>
      </h2>

      {reload.phase === "loaded" ? (
        <p role="status" className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
          The member was loaded again and is shown as they are now. The ticks were set back to the teams they are on now: tick the change again, then review it.
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

      {organization.blocked ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          This organization is blocked ({blockedSinceLabel(organization.blocked)}). Nobody in it can sign in until it is reactivated.
        </p>
      ) : null}

      <TeamFormBody kind={kind} organization={organization} team={team} member={managed} isManager={isManager} choices={choices} draft={draft} errors={errors} edit={edit} />

      <ReasonField value={draft.reason} error={errors.reason} onChange={(reason) => edit({ reason }, "reason")} />

      {block ? (
        <div role="alert" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <p className="break-words font-semibold">Review is off. {block}</p>
          <Link href={organizationTeamsPath(organization.id)} prefetch={false} className={linkClass}>
            Teams list
          </Link>
        </div>
      ) : null}

      {reviewRead.phase === "failed" ? (
        <div className="space-y-2">
          <RefusalNote refusal={reviewRead.refusal} />
          <p className="text-sm text-slate-600">The member could not be read again, so there is no review to show. Nothing was changed. Press Review to try again.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" disabled={reviewRead.phase === "loading" || block !== null} className={primaryButton}>
          {reviewRead.phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {reviewRead.phase === "loading" ? "Reading the member" : "Review"}
        </button>
        <p className="text-xs text-slate-600">
          {kind === "memberTeams" ? "Review reads this member again, one more recorded view of them, so the review shows their teams as they are now. " : ""}
          Nothing is changed until you confirm on the next step.
        </p>
      </div>
    </form>
  );
}

const Lines = ({ lines }: { lines: readonly string[] }) => (
  <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
    {lines.map((line) => (
      <li key={line}>{line}</li>
    ))}
  </ul>
);

const strong = "break-words font-bold text-[#20304b]";

/** What each write asks for besides the reason. */
const TeamFormBody = ({
  kind,
  organization,
  team,
  member,
  isManager,
  choices,
  draft,
  errors,
  edit,
}: {
  kind: TeamWrite;
  organization: ManagedOrganization;
  team?: TeamRef;
  member: ManagedMember | null;
  isManager: boolean;
  choices: TeamChoice[];
  draft: TeamDraft;
  errors: TeamDraftErrors;
  edit: (change: Partial<TeamDraft>, field: TeamDraftField) => void;
}) => {
  const groupId = useId();
  const who = member ? memberLabel(member.member) : "This member";
  const teamName = team?.name ?? "this team";
  switch (kind) {
    case "create":
    case "rename":
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            {kind === "create" ? (
              "The new team starts with no members. Members and managers are added from the team's page."
            ) : (
              <>
                The team is named <span className={strong}>{teamName}</span> now. Only its name changes.
              </>
            )}
          </p>
          <Field label={kind === "create" ? "Team name" : "New team name"} hint={`${TEAM_NAME_RULE} Active team names are unique in an organization, ignoring case.`} error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="text"
                value={draft.name}
                autoComplete="off"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                onChange={(event) => edit({ name: event.target.value }, "name")}
                className={`h-11 ${inputClass}`}
              />
            )}
          </Field>
        </div>
      );
    case "archive":
      return (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Archiving <span className={strong}>{teamName}</span> takes effect at once.
          </p>
          <Lines lines={ARCHIVE_EFFECTS} />
        </div>
      );
    case "addMember": {
      const canManage = draft.target ? holdsTeamManagerRole(draft.target.roles) : false;
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            The member you choose joins <span className={strong}>{teamName}</span>. Only an active member of the organization can be added. {NO_SESSION_ENDED}
          </p>
          {team ? (
            <TeamMemberPicker organizationId={organization.id} teamId={team.id} chosen={draft.target} error={errors.target} onChoose={(target) => edit({ target, makeManager: false }, "target")} />
          ) : null}
          {draft.target && canManage ? (
            <label
              htmlFor={`${groupId}-manager`}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-[#20304b] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#00aeb5]"
            >
              <input
                id={`${groupId}-manager`}
                type="checkbox"
                checked={draft.makeManager}
                onChange={(event) => edit({ makeManager: event.target.checked }, "target")}
                className="mt-1 h-4 w-4 accent-[#007f86]"
              />
              <span>
                Add them as a manager of this team. <span className="text-slate-600">{MANAGER_REACH}</span>
              </span>
            </label>
          ) : draft.target ? (
            <p className="text-sm text-slate-600">This member does not hold the Team Manager role, so they join as a plain member: only a member with that role can manage a team.</p>
          ) : null}
        </div>
      );
    }
    case "removeMember":
      return (
        <p className="text-sm leading-6 text-slate-600">
          <span className={strong}>{who}</span> is taken off <span className={strong}>{teamName}</span>
          {isManager ? ", which they manage now" : ""}. Only the membership of this team is removed: no proposal is changed. {isManager ? `${MANAGER_REACH} ` : ""}
          {NO_SESSION_ENDED}
        </p>
      );
    case "makeManager":
    case "removeManager":
      return (
        <p className="text-sm leading-6 text-slate-600">
          <span className={strong}>{who}</span> {kind === "makeManager" ? "becomes a manager of" : "stops being a manager of, and stays on,"} <span className={strong}>{teamName}</span>. {MANAGER_REACH}{" "}
          {NO_SESSION_ENDED}
        </p>
      );
    default: {
      const archived = member ? currentTeams(member.member).archived : [];
      const toggle = (id: string, on: boolean) => edit({ teamIds: on ? [...draft.teamIds.filter((other) => other !== id), id] : draft.teamIds.filter((other) => other !== id) }, "teams");
      return (
        <fieldset className="space-y-3" aria-describedby={errors.teams ? `${groupId}-error` : undefined}>
          <legend className="text-sm font-bold text-[#20304b]">Teams {who} is on</legend>
          <p className="text-sm leading-6 text-slate-600">
            The member&apos;s active teams become exactly the teams ticked here, at most {MEMBER_TEAMS_MAX}. The ticks start as the teams they were on when this page last loaded them; each team below says whether they are on it now. {MEMBER_TEAMS_EFFECTS[0]}
          </p>
          {errors.teams ? (
            <p id={`${groupId}-error`} className="text-xs font-semibold text-rose-700">
              {errors.teams}
            </p>
          ) : null}
          {choices.length === 0 ? (
            <p className="text-sm text-slate-600" role="status">
              This organization has no active team.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {choices.map((choice) => {
                const now = member?.member.teams.find((entry) => entry.id === choice.id && !entry.archived);
                return (
                  <li key={choice.id}>
                    <label
                      htmlFor={`${groupId}-${choice.id}`}
                      className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-[#00aeb5]"
                    >
                      <input
                        id={`${groupId}-${choice.id}`}
                        type="checkbox"
                        checked={draft.teamIds.includes(choice.id)}
                        onChange={(event) => toggle(choice.id, event.target.checked)}
                        className="mt-1 h-4 w-4 accent-[#007f86]"
                      />
                      <span className="min-w-0">
                        <span className="block break-words font-bold text-[#20304b]">{choice.name}</span>
                        <span className="block text-slate-600">{now ? (now.isManager ? "On this team now, as a manager" : "On this team now") : "Not on this team now"}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-slate-600" role="status">
            {countLabel(draft.teamIds.length, "team")} ticked of {countLabel(choices.length, "active team")}.
          </p>
          {archived.length ? (
            <p className="break-words text-sm text-slate-600">
              {MEMBER_TEAMS_EFFECTS[1]} This member is on: {archived.map((entry) => entry.name).join(", ")}.
            </p>
          ) : null}
        </fieldset>
      );
    }
  }
};

function TeamReviewStep({
  kind,
  context,
  subject,
  request,
  notice,
  reload,
  onLoadCurrentMember,
  onBack,
  onDone,
}: {
  kind: TeamWrite;
  context: TeamReviewContext;
  subject: Subject;
  request: TeamRequest;
  /** What changed about the member since the form was filled in from them. */
  notice: string | null;
  reload: Reload;
  onLoadCurrentMember: () => void;
  onBack: () => void;
  onDone: (answer: TeamWriteAnswer) => void;
}) {
  const confirmId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const refusalNote = useRef<HTMLDivElement>(null);
  const copy = TEAM_WRITE_COPY[kind];
  const { organization, choices = [] } = context;
  const { team, member } = subject;
  // An archive cannot be undone: it is confirmed by typing the team's name. The rest by a tick.
  const requiredName = kind === "archive" && team ? team.name : undefined;
  const [gateState, setGateState] = useState<WriteGateState>({ acknowledged: false, typedName: "", confirmed: false, inFlight: false, done: false });
  const [refusal, setRefusal] = useState<ManagementRefusal | null>(null);
  // One gate for this review: nothing is sent before the confirmation, and a second submit while
  // the first is in flight sends nothing.
  const [gate] = useState(() =>
    createWriteGate<Answered>({
      send: () => sendTeamWrite(kind, organization.id, subject, request),
      succeeded: (result) => result.ok,
      requiredName,
      onChange: setGateState,
    }),
  );

  useEffect(() => {
    heading.current?.focus();
  }, []);
  // A refusal turns the confirm control off, which would drop the focus on the page. It goes to
  // the refusal, which sits above the confirmation.
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
  const lines = teamReviewLines(kind, context, request);
  const failure = refusal?.failure;
  // A member's teams are set against the member's version: these refusals offer to load the member again.
  const offersReload = kind === "memberTeams" && Boolean(member) && failure !== undefined && ["stale_version", "version_required", "outcome_unknown"].includes(failure);
  // The team's state is what the next try depends on: these lead to the team's page, which reads it.
  const offersTeam = Boolean(team) && failure !== undefined && ["outcome_unknown", "team_archived", "team_not_found", "team_member_not_found", "team_member_exists", "member_not_active", "team_manager_role_required"].includes(failure);
  const unknownTeams = (refusal?.unknownTeamIds ?? []).map((id) => choices.find((choice) => choice.id === id)?.name).filter((name): name is string => Boolean(name));
  const chosen = (request.teamIds ?? []).map((id) => choices.find((choice) => choice.id === id)?.name ?? id);

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
        Review: {copy.title.toLowerCase()}
      </h2>
      {notice ? (
        <p role="alert" className="break-words rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
          {notice}
        </p>
      ) : null}
      <ul className="space-y-2 text-sm leading-6 text-[#20304b]">
        {lines.map((line) => (
          <li key={line} className="break-words rounded-xl bg-slate-50 px-4 py-2.5">
            {line}
          </li>
        ))}
      </ul>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Exactly what this change names">
        <ReviewFact label="Organization" value={organizationLabel(organization)} detail={`Id: ${organization.id}`} />
        {team ? <ReviewFact label="Team" value={team.name} detail={`Id: ${team.id}`} /> : null}
        {request.name !== undefined ? <ReviewFact label={kind === "create" ? "Team name" : "New team name"} value={request.name} /> : null}
        {member ? <ReviewFact label="Member" value={memberLabel(member.member)} detail={`Id: ${member.member.userId}`} /> : null}
        {kind === "addMember" && request.target ? (
          <ReviewFact label="Member who joins" value={`${memberLabel(request.target)} (${rolesLabel(request.target.roles)})`} detail={`Id: ${request.target.userId}`} />
        ) : null}
        {request.isManager !== undefined ? <ReviewFact label="Manager of the team" value={request.isManager ? "Yes" : "No"} /> : null}
        {kind === "memberTeams" ? <ReviewFact label="Active teams after this" value={chosen.length ? chosen.join(", ") : "None"} detail={countLabel(chosen.length, "team")} /> : null}
        <ReviewFact label="Reason, as typed" value={request.reason} preserve />
      </dl>
      <p className="text-sm text-slate-600">The reason is recorded with this change on the RFPilot side only. The organization sees the result, not the reason and not who made it.</p>

      {refusal ? (
        <div ref={refusalNote} tabIndex={-1} className={`rounded-xl ${focusRing}`}>
          <RefusalNote refusal={refusal}>
            {failure === "session_ended" ? (
              <Link href={sessionRenewPath(flowPath(kind, organization.id, subject))} prefetch={false} className={linkClass}>
                Sign in
              </Link>
            ) : null}
            {offersTeam && team ? (
              <Link href={teamManagementPath(organization.id, team.id)} prefetch={false} className={linkClass}>
                Open the team to see it as it is now
              </Link>
            ) : null}
            {!team && kind === "create" && (failure === "outcome_unknown" || failure === "team_name_taken") ? (
              <Link href={organizationTeamsPath(organization.id)} prefetch={false} className={linkClass}>
                Open the Teams list to check
              </Link>
            ) : null}
            {failure === "unknown_teams" && member ? (
              // A plain anchor, not a Link: a full load reads the member and the active teams again.
              <a href={memberTeamsPath(organization.id, member.member.userId)} className={linkClass}>
                Open this page again
              </a>
            ) : null}
            {offersReload ? (
              <button type="button" onClick={onLoadCurrentMember} disabled={reload.phase === "loading" || busy} className={secondaryButton}>
                {reload.phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {reload.phase === "loading" ? "Loading the current member" : "Load the current member"}
              </button>
            ) : null}
          </RefusalNote>
          {unknownTeams.length ? <p className="mt-2 break-words text-sm text-slate-600">Not active teams of this organization now: {unknownTeams.join(", ")}.</p> : null}
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
            Type the team&apos;s name to confirm
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
          <span>I have checked the organization, the team or member and the change above, and I want to make this change now.</span>
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

/** What the API answered. The ways on are links: each opens a page that reads what it shows. */
function TeamResultStep({ kind, context, request, answer }: { kind: TeamWrite; context: TeamReviewContext; request: TeamRequest; answer: TeamWriteAnswer }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const summary = teamResultSummary(kind, context, request, answer);
  const organizationId = context.organization.id;
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
        {answer.answer === "team" ? (
          <>
            <Link href={teamManagementPath(organizationId, answer.team.team.id)} prefetch={false} className={linkClass}>
              {kind === "create" ? "Open the new team" : "Back to this team"}
            </Link>
            <Link href={organizationTeamsPath(organizationId)} prefetch={false} className={linkClass}>
              Teams list
            </Link>
          </>
        ) : (
          <>
            <Link href={memberManagementPath(organizationId, answer.member.userId)} prefetch={false} className={linkClass}>
              Back to this member
            </Link>
            <Link href={organizationMembersPath(organizationId)} prefetch={false} className={linkClass}>
              Members list
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

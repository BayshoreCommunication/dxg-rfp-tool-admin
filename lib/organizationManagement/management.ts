// What RFPilot staff do with a customer organization outside the content browser (owner decision,
// 2026-11-24): view one member, view one team (lib/organizationManagement/teams.ts), and block or
// reactivate the whole organization. Staff change nothing about a member or a team: the member
// and team writes of 2026-11-18 were removed, and app/actions/staffViewOnly.test.ts keeps them out.
//
// The backend routes are under /api/v1/admin/organizations/:organizationId (docs/API.md, "Staff
// member management", "Staff team management" and "Staff organization block"). Every request,
// the single-member read and the team read included, is recorded in the staff organization's
// audit trail and never in the customer's. So nothing here is cached or fetched ahead of the
// screen that shows it.
//
// This file is pure: ids, paths, parsers, the refusal of every status and code, when a block or
// a reactivation is offered, and the words of its review and result. The admin app has no
// generated contracts, so every answer is parsed field by field, and the backend's own message
// text is never kept: a code maps to fixed wording and is shown beside it as an identifier.

import type { OrganizationStanding } from "@/lib/organizationAccount";
import { formatContentDate, parseMembersPage, type Member } from "@/lib/organizationContent/content";
import { countLabel } from "@/lib/plural";

/* ---------- ids and paths ---------- */

/** The backend refuses anything but a 24-character lower-case hex id; so do the actions and links here. */
export const isManagementId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{24}$/.test(value);

export type OrganizationWrite = "block" | "unblock";
/* The management pages live outside /organizations/[organizationId]/: everything under that
   address is the view-only content browser (components/organizations/content/readOnly.test.ts). */
export const MANAGEMENT_PATH = "/organization-management";

const managementBase = (organizationId: string) => `${MANAGEMENT_PATH}/${encodeURIComponent(organizationId)}`;

export const memberManagementPath = (organizationId: string, userId: string): string =>
  `${managementBase(organizationId)}/members/${encodeURIComponent(userId)}`;

export const organizationWritePath = (organizationId: string, write: OrganizationWrite): string =>
  `${managementBase(organizationId)}/${write === "block" ? "block" : "reactivate"}`;

/* ---------- what a block or a reactivation carries ---------- */

export const REASON_MIN = 10;
export const REASON_MAX = 500;
/** The API's own rule, in its own words. */
export const REASON_RULE = `Give a reason of ${REASON_MIN} to ${REASON_MAX} characters.`;

/** The reason as it is sent: trimmed, 10 to 500 characters. Null when it is not one. */
export const reasonOf = (value: unknown): string | null => {
  const reason = typeof value === "string" ? value.trim() : "";
  return reason.length >= REASON_MIN && reason.length <= REASON_MAX ? reason : null;
};

/** What the counter under the field shows: the length that is checked, after trimming. */
export const reasonLength = (value: string): number => value.trim().length;

/* ---------- reading the answers ---------- */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const instant = (value: unknown): string | null =>
  typeof value === "string" && value && !Number.isNaN(new Date(value).getTime()) ? value : null;

const wholeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/** One member as the staff members read returns it. The answer also carries a membership
    `version`, which only the removed member writes needed: it is not read, and not required. */
export type ManagedMember = { member: Member };

/** What the block and reactivate pages show of the organization: its name, standing and block. */
export type ManagedOrganization = {
  id: string;
  name: string;
  standing: OrganizationStanding;
  /** Null while not blocked. `at` is null when the answer says blocked without a usable date. */
  blocked: { at: string | null } | null;
};

/* The member is read through the members list's own parser (the same allowlist the view-only
   Members page uses), so a field added to the answer later does not reach the screen. */
const memberWithVersion = (holder: Record<string, unknown> | null, organizationId: string, userId?: string): ManagedMember | null => {
  if (!holder) return null;
  const member = parseMembersPage({ organizationId, members: [holder.member] }, organizationId)?.members[0];
  if (!member || !isManagementId(member.userId)) return null;
  if (userId !== undefined && member.userId !== userId) return null;
  return { member };
};

/** Every answer names the organization it acted on. One that names another is never shown. */
const forOrganization = (data: unknown, organizationId: string): Record<string, unknown> | null => {
  const raw = record(data);
  return raw && raw.organizationId === organizationId ? raw : null;
};

/** GET members/:userId. */
export const parseManagedMember = (data: unknown, organizationId: string, userId: string): ManagedMember | null =>
  memberWithVersion(forOrganization(data, organizationId), organizationId, userId);

export type OrganizationBlockAnswer = { answer: "organization"; changed: boolean; blocked: boolean; blockedAt: string | null; sessionsEnded: number | null };
/** block and reactivate: `{ organizationId, changed, blocked, blockedAt, sessionsEnded? }`. */
export const parseBlockAnswer = (data: unknown, organizationId: string, write: OrganizationWrite): OrganizationBlockAnswer | null => {
  const raw = forOrganization(data, organizationId);
  if (!raw || typeof raw.changed !== "boolean" || typeof raw.blocked !== "boolean") return null;
  // An answer that says the opposite of what was asked is not a result to show.
  if (raw.blocked !== (write === "block")) return null;
  return {
    answer: "organization",
    changed: raw.changed,
    blocked: raw.blocked,
    blockedAt: raw.blocked ? instant(raw.blockedAt) : null,
    sessionsEnded: write === "block" ? wholeNumber(raw.sessionsEnded) : null,
  };
};

/* ---------- refusals ---------- */

export type ManagementFailure =
  | "session_ended"
  | "forbidden"
  | "rate_limited"
  /** 404 with no known code: the API does not have the route yet. */
  | "not_available"
  /** A read that could not be made or understood. */
  | "unavailable"
  /** A write whose answer never arrived, was a server error, or could not be read: it may have been saved. */
  | "outcome_unknown"
  | "invalid_id"
  | "invalid_reason"
  | "organization_not_found"
  | "member_not_found"
  | "organization_not_manageable"
  // The team page (lib/organizationManagement/teams.ts).
  | "invalid_team_id"
  | "team_not_found";

const BY_CODE: Record<string, ManagementFailure> = {
  // 400
  INVALID_REASON: "invalid_reason",
  INVALID_ORGANIZATION_ID: "invalid_id",
  INVALID_MEMBER_ID: "invalid_id",
  INVALID_TEAM_ID: "invalid_team_id",
  // 403
  STAFF_ACCESS_FORBIDDEN: "forbidden",
  // 404
  ORGANIZATION_NOT_FOUND: "organization_not_found",
  MEMBER_NOT_FOUND: "member_not_found",
  TEAM_NOT_FOUND: "team_not_found",
  // 409
  ORGANIZATION_NOT_MANAGEABLE: "organization_not_manageable",
  // 500: a block or a reactivation may already be saved.
  STAFF_MEMBERS_INTERNAL_ERROR: "outcome_unknown",
  STAFF_TEAMS_INTERNAL_ERROR: "outcome_unknown",
  STAFF_ORGANIZATION_BLOCK_INTERNAL_ERROR: "outcome_unknown",
};

export type RequestMode = "read" | "write";

/** One refusal for each status and code the routes answer with. */
export const managementFailure = (status: number, code: string | null, mode: RequestMode): ManagementFailure => {
  const known = code ? BY_CODE[code] : undefined;
  // A read changes nothing, so its server error is only "could not be loaded".
  if (known) return known === "outcome_unknown" && mode === "read" ? "unavailable" : known;
  if (status === 401) return "session_ended";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  // A 404 without one of the codes above comes from the API not having the route yet.
  if (status === 404) return "not_available";
  return mode === "write" ? "outcome_unknown" : "unavailable";
};

/** A code is an identifier, shown as one; anything else (a sentence, an object) is dropped. */
export const codeOf = (value: unknown): string | null => (typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : null);

/** Retry-After in seconds, when the answer carries a usable one (at most the 15-minute window). */
export const retryAfterSecondsOf = (header: string | null | undefined): number | null => {
  if (!header || !/^\d{1,5}$/.test(header.trim())) return null;
  const seconds = Number(header.trim());
  return seconds >= 1 ? Math.min(seconds, 900) : null;
};

export type ManagementRefusal = {
  ok: false;
  failure: ManagementFailure;
  /** The backend's code, shown beside the wording. Null for a refusal made before the backend was asked. */
  code: string | null;
  /** ORGANIZATION_NOT_MANAGEABLE: `platform` or the organization's kind. */
  standing?: string;
  retryAfterSeconds?: number;
};

export type ManagementResult<T> = { ok: true; data: T } | ManagementRefusal;

export const refused = (failure: ManagementFailure): ManagementRefusal => ({ ok: false, failure, code: null });

/** The refusal of an answer that was not a success. Only the code and the counted details are kept. */
export const refusalOf = (status: number, body: unknown, retryAfter: string | null | undefined, mode: RequestMode): ManagementRefusal => {
  const raw = record(body);
  const code = codeOf(raw?.code);
  const failure = managementFailure(status, code, mode);
  const retryAfterSeconds = status === 429 ? retryAfterSecondsOf(retryAfter) : null;
  return {
    ok: false,
    failure,
    code,
    ...(failure === "organization_not_manageable" && typeof raw?.standing === "string" && /^[a-z_]{1,40}$/.test(raw.standing) ? { standing: raw.standing } : {}),
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
};

export type FailureCopy = { title: string; message: string; tone: "calm" | "problem" };

const waitText = (seconds: number | null | undefined) =>
  seconds ? ` Try again in about ${seconds < 90 ? countLabel(seconds, "second") : countLabel(Math.ceil(seconds / 60), "minute")}.` : " Wait a few minutes, up to 15, then try again.";

/** Which page shows the refusal: one that only views (the member page, the team page), or the
    block and reactivate pages, where something could have been changed. */
export type CopyMode = "view" | "change";

/* What a view page says where the wording of a change would mislead: nothing on it could have
   changed anything, so it never says "Nothing was changed", and it speaks of viewing. */
const viewCopy = (refusal: Pick<ManagementRefusal, "failure" | "standing" | "retryAfterSeconds">, copy: FailureCopy): FailureCopy => {
  switch (refusal.failure) {
    case "forbidden":
      return { title: "This account can't view customer organizations here", message: "Viewing a customer organization's members and teams needs an RFPilot staff account with an admin role.", tone: copy.tone };
    case "rate_limited":
      return { ...copy, message: `Pages opened here count toward the 300 views of customer content per 15 minutes for each staff account.${waitText(refusal.retryAfterSeconds)}` };
    case "organization_not_manageable":
      return refusal.standing === "platform"
        ? { ...copy, title: "RFPilot's own organization can't be viewed here", message: "Staff accounts live in it. Nothing in it is read from this screen." }
        : { ...copy, title: "This organization can't be viewed yet", message: "It is awaiting placement, so its members and teams can't be opened here." };
    default:
      return { ...copy, message: copy.message.replace(/ Nothing was changed\.$/, "") };
  }
};

/** The sentence for a refusal. Fixed wording: nothing the backend wrote is shown. `mode` is the
    page showing it: the block and reactivate wording unless a view page asks. */
export const managementFailureCopy = (refusal: Pick<ManagementRefusal, "failure" | "standing" | "retryAfterSeconds">, mode: CopyMode = "change"): FailureCopy =>
  mode === "view" ? viewCopy(refusal, changeCopy(refusal)) : changeCopy(refusal);

const changeCopy = (refusal: Pick<ManagementRefusal, "failure" | "standing" | "retryAfterSeconds">): FailureCopy => {
  switch (refusal.failure) {
    case "session_ended":
      return { title: "Your session has ended", message: "Sign in again to continue. Nothing was changed.", tone: "problem" };
    case "forbidden":
      return {
        title: "This account can't manage organizations",
        message: "Managing a customer organization needs an RFPilot staff account with an admin role. Nothing was changed.",
        tone: "problem",
      };
    case "rate_limited":
      return {
        title: "Too many requests from this account",
        message: `Blocking and reactivating an organization share one allowance of 60 per 15 minutes for each staff account; pages opened here count toward the 300 views of customer content.${waitText(refusal.retryAfterSeconds)} Nothing was changed.`,
        tone: "calm",
      };
    case "not_available":
      return { title: "Not available yet", message: "This will be available here after the next RFPilot update. Nothing was changed.", tone: "calm" };
    case "outcome_unknown":
      return {
        title: "The change may or may not have been saved",
        message: "The server did not confirm the change: it reported an error, could not be reached, or answered in a way that could not be read. Check the current state before trying again.",
        tone: "problem",
      };
    case "invalid_id":
      return { title: "This link doesn't point to a member or an organization", message: "The address is incomplete or mistyped. Open it from the organization's Members page.", tone: "calm" };
    case "invalid_reason":
      return { title: "The reason was not accepted", message: `${REASON_RULE} Nothing was changed.`, tone: "problem" };
    case "organization_not_found":
      return { title: "Organization not found", message: "This organization doesn't exist, or it has been removed. Nothing was changed.", tone: "calm" };
    case "member_not_found":
      return { title: "Member not found", message: "This person is not a member of this organization. Nothing was changed.", tone: "calm" };
    case "organization_not_manageable":
      return refusal.standing === "platform"
        ? { title: "RFPilot's own organization can't be managed here", message: "Staff accounts live in it. Nothing in it is read or changed from this screen.", tone: "calm" }
        : { title: "This organization can't be managed yet", message: "It is awaiting placement, so its members and teams can't be opened here and it can't be blocked. Nothing was changed.", tone: "calm" };
    case "invalid_team_id":
      return { title: "This link doesn't point to a team", message: "The address is incomplete or mistyped. Open it from the organization's Teams page.", tone: "calm" };
    case "team_not_found":
      return { title: "Team not found", message: "This team doesn't exist in this organization. Nothing was changed.", tone: "calm" };
    default:
      return { title: "Unable to load this page", message: "The server couldn't be reached or didn't answer as expected. Try again in a moment.", tone: "problem" };
  }
};

/* ---------- a member's standing, and when a block is offered ---------- */

export type MemberStanding = "active" | "deactivated" | "invited" | "removed" | "other";

/* The staff routes return the membership's stored status, where a deactivated member is
   `suspended`; the customer-facing API calls the same state `deactivated`. Both read as deactivated. */
export const memberStanding = (status: string): MemberStanding => {
  if (status === "active") return "active";
  if (status === "suspended" || status === "deactivated") return "deactivated";
  if (status === "invited" || status === "removed") return status;
  return "other";
};

/** Blocking is for a customer organization that is not blocked; reactivating for any that is. */
export const organizationWritesFor = (organization: Pick<ManagedOrganization, "standing" | "blocked">): OrganizationWrite[] => {
  if (organization.blocked) return ["unblock"];
  return organization.standing === "active" || organization.standing === "inactive" ? ["block"] : [];
};

/* ---------- which backend reads each page makes ---------- */

/** The two audited reads these pages make. A page is handed only what it shows. */
export type ManagementReads = {
  member(organizationId: string, userId: string): Promise<ManagementResult<ManagedMember>>;
  organization(organizationId: string): Promise<ManagementResult<ManagedOrganization>>;
};

/** The member page: the one member, read once. Nothing is asked for an address that is not made of ids. */
export const loadMemberPage = async (reads: Pick<ManagementReads, "member">, organizationId: string, userId: string): Promise<ManagementResult<ManagedMember>> => {
  if (!isManagementId(organizationId) || !isManagementId(userId)) return refused("invalid_id");
  return reads.member(organizationId, userId);
};

export type OrganizationWriteLoad =
  | { state: "ready"; organization: ManagedOrganization }
  | { state: "not_offered"; organization: ManagedOrganization }
  | { state: "failed"; refusal: ManagementRefusal };

/** The block and reactivate pages: the organization, read once. */
export const loadOrganizationWritePage = async (reads: Pick<ManagementReads, "organization">, organizationId: string, write: OrganizationWrite): Promise<OrganizationWriteLoad> => {
  if (!isManagementId(organizationId)) return { state: "failed", refusal: refused("invalid_id") };
  const organization = await reads.organization(organizationId);
  if (!organization.ok) return { state: "failed", refusal: organization };
  return organizationWritesFor(organization.data).includes(write) ? { state: "ready", organization: organization.data } : { state: "not_offered", organization: organization.data };
};

/* ---------- wording ---------- */

export const organizationLabel = (organization: Pick<ManagedOrganization, "name">): string => organization.name.trim() || "Unnamed organization";

/** What staff type to confirm a block: the organization's name, or its id when it has none. */
export const confirmationPhrase = (organization: Pick<ManagedOrganization, "name" | "id">): string => organization.name.trim() || organization.id;

export const memberStatusLabel = (status: string): string => {
  switch (memberStanding(status)) {
    case "active":
      return "Active";
    case "deactivated":
      return "Deactivated";
    case "invited":
      return "Invited";
    case "removed":
      return "Removed";
    default:
      return "Unknown status";
  }
};

export const blockedSinceLabel = (blocked: { at: string | null }): string =>
  blocked.at ? `Blocked since ${formatContentDate(blocked.at)}` : "Blocked (the date is not recorded)";

export type WriteCopy = {
  /** The page heading and the name of the link that leads to it. */
  title: string;
  /** What the form's submit and the review's confirm controls say. */
  confirm: string;
  /** While the request is in flight. */
  sending: string;
  /** A write that takes access away is drawn as one. */
  danger: boolean;
};

export const WRITE_COPY: Record<OrganizationWrite, WriteCopy> = {
  block: { title: "Block organization", confirm: "Block organization", sending: "Blocking the organization", danger: true },
  unblock: { title: "Reactivate organization", confirm: "Reactivate organization", sending: "Reactivating the organization", danger: false },
};

/* What a block does and does not do, as both the block and the reactivate page state it. The
   exceptions are the backend's own (docs/API.md, "Staff organization block": the background work
   table and "Known limits" 1, 2 and 7). Nothing is claimed here that those do not say. */
export const BLOCK_EFFECTS = {
  does: [
    "Ends every member's session at once.",
    "Closes sign-in for every member of the organization.",
    "Closes vendor links, shared proposal pages and invitation links: they answer like a link that does not exist.",
    "Pauses background work that has not started, until the organization is reactivated.",
  ],
  doesNot: [
    "Deletes nothing: all of the organization's data is kept.",
    "Does not stop a background job that is already running when the block lands: it runs to the end and may save its result.",
    "Does not cut a notification connection or a response that is already open when the block lands: it ends with that request, and no new one can be opened.",
    "Does not close files kept under the old /uploads address: they are served by file name, with no organization in the address.",
    "Does not pause the escalation of the organization's support tickets to RFPilot staff.",
    "Does not stop RFPilot staff: staff can still view the organization and reactivate it.",
    "Is not shown to the customer as a staff change: it is recorded on the RFPilot side only.",
  ],
} as const;

/** What the form holds before the review. */
export type WriteDraft = { reason: string };
export const emptyDraft = (): WriteDraft => ({ reason: "" });

type DraftField = "reason";
export type DraftErrors = Partial<Record<DraftField, string>>;

/** The checked value a review states and a confirmation sends. */
export type WriteRequest = { reason: string };

export const checkDraft = (draft: WriteDraft): { ok: true; request: WriteRequest } | { ok: false; errors: DraftErrors } => {
  const reason = reasonOf(draft.reason);
  return reason === null ? { ok: false, errors: { reason: REASON_RULE } } : { ok: true, request: { reason } };
};

export type ReviewContext = { organization: ManagedOrganization };

/** The review, in plain words: what changes. The reason is shown beside it, as typed. */
export const reviewLines = (kind: OrganizationWrite, context: ReviewContext): string[] => {
  const organization = organizationLabel(context.organization);
  return kind === "block"
    ? [`${organization} is blocked.`, ...BLOCK_EFFECTS.does, ...BLOCK_EFFECTS.doesNot]
    : [
        `${organization} is reactivated.`,
        "Members can sign in again, and vendor links, shared proposal pages and invitation links work again.",
        "Sessions the block ended stay ended: members sign in again. Paused background work runs at its next turn.",
      ];
};

export type ResultSummary = { title: string; lines: string[] };

/** What happened, from the API's own answer. No second read is made to show it. */
export const resultSummary = (context: ReviewContext, answer: OrganizationBlockAnswer): ResultSummary => {
  const organization = organizationLabel(context.organization);
  if (answer.blocked) {
    const since = blockedSinceLabel({ at: answer.blockedAt });
    return answer.changed
      ? {
          title: "Organization blocked",
          // Without a count in the answer nothing is said about sessions.
          lines: [`${organization}: ${since}.`, answer.sessionsEnded === null ? "The block is in place." : `${countLabel(answer.sessionsEnded, "session")} ended.`],
        }
      : {
          title: "Already blocked",
          // A repeated block also ends sessions that began while the first block committed: the count is the answer's.
          lines: [
            `${organization} was already blocked: ${since}. The block itself did not change; the request is still recorded on the RFPilot side.`,
            ...(answer.sessionsEnded !== null && answer.sessionsEnded > 0 ? [`${countLabel(answer.sessionsEnded, "session")} ended with this request.`] : []),
          ],
        };
  }
  return answer.changed
    ? { title: "Organization reactivated", lines: [`${organization} is no longer blocked. Members can sign in again.`] }
    : { title: "Not blocked", lines: [`${organization} was not blocked. Nothing changed; the request is still recorded on the RFPilot side.`] };
};

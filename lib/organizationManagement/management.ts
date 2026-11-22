// Staff management of a customer organization (owner decisions, 2026-11-18): RFPilot staff change
// a member's role, deactivate and reactivate a member, reassign a member's proposals, transfer
// ownership, and block or reactivate the whole organization. Team management is the sibling of
// this file, lib/organizationManagement/teams.ts: it shares the ids, the reason, the refusals and
// their wording below.
//
// The backend routes are under /api/v1/admin/organizations/:organizationId (docs/API.md, "Staff
// member management" and "Staff organization block"). Every request, the single-member read
// included, is recorded in the staff organization's audit trail and never in the customer's. So
// nothing here is cached or fetched ahead of the screen that shows it.
//
// This file is pure: ids, paths, parsers, the refusal of every status and code, which writes a
// member's state offers, and the words of each review and result. The admin app has no generated
// contracts, so every answer is parsed field by field, and the backend's own message text is
// never kept: a code maps to fixed wording and is shown beside it as an identifier.

import type { OrganizationStanding } from "@/lib/organizationAccount";
import { formatContentDate, parseMembersPage, roleLabel, type Member, type Pagination } from "@/lib/organizationContent/content";
import { countLabel } from "@/lib/plural";

/* ---------- ids and paths ---------- */

/** The backend refuses anything but a 24-character lower-case hex id; so do the actions and links here. */
export const isManagementId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{24}$/.test(value);

export const MEMBER_WRITES = ["role", "deactivate", "reactivate", "reassign", "transfer"] as const;
export type MemberWrite = (typeof MEMBER_WRITES)[number];
export const ORGANIZATION_WRITES = ["block", "unblock"] as const;
export type OrganizationWrite = (typeof ORGANIZATION_WRITES)[number];
export type WriteKind = MemberWrite | OrganizationWrite;

export const isMemberWrite = (kind: WriteKind): kind is MemberWrite => (MEMBER_WRITES as readonly string[]).includes(kind);

/* The management pages live outside /organizations/[organizationId]/: everything under that
   address is the view-only content browser (components/organizations/content/readOnly.test.ts). */
export const MANAGEMENT_PATH = "/organization-management";

const managementBase = (organizationId: string) => `${MANAGEMENT_PATH}/${encodeURIComponent(organizationId)}`;

export const memberManagementPath = (organizationId: string, userId: string): string =>
  `${managementBase(organizationId)}/members/${encodeURIComponent(userId)}`;

const MEMBER_WRITE_SEGMENTS: Record<MemberWrite, string> = {
  role: "role",
  deactivate: "deactivate",
  reactivate: "reactivate",
  reassign: "reassign-proposals",
  transfer: "transfer-ownership",
};

export const memberWritePath = (organizationId: string, userId: string, write: MemberWrite): string =>
  `${memberManagementPath(organizationId, userId)}/${MEMBER_WRITE_SEGMENTS[write]}`;

/** The reassignment page as the step before a deactivation the API refused for owned proposals. */
export const reassignBeforeDeactivatePath = (organizationId: string, userId: string): string =>
  `${memberWritePath(organizationId, userId, "reassign")}?then=deactivate`;

export const organizationWritePath = (organizationId: string, write: OrganizationWrite): string =>
  `${managementBase(organizationId)}/${write === "block" ? "block" : "reactivate"}`;

/* ---------- what a write carries ---------- */

/** The roles the role route accepts. Owner is never among them: it only moves by a transfer. */
export const ASSIGNABLE_ROLES = ["organization_admin", "team_manager", "planner", "viewer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export const isAssignableRole = (value: unknown): value is AssignableRole =>
  typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);

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

/** A membership version: a whole number from 1. Null for anything else, a numeric string included. */
export const versionOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;

/* ---------- reading the answers ---------- */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const instant = (value: unknown): string | null =>
  typeof value === "string" && value && !Number.isNaN(new Date(value).getTime()) ? value : null;

const wholeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/** One member as the staff members read returns it, with the version every member write needs. */
export type ManagedMember = { member: Member; version: number };

/** What the management pages show of the organization: its name, standing, Owner and block. */
export type ManagedOrganization = {
  id: string;
  name: string;
  standing: OrganizationStanding;
  /** Null while not blocked. `at` is null when the answer says blocked without a usable date. */
  blocked: { at: string | null } | null;
  /** The Owner as account contact when the page loaded. Handed only to the transfer page, the one
      page that shows it; null on every other page, and when the organization has none on file. */
  owner: { name: string; email: string } | null;
};

/* The member is read through the members list's own parser (the same allowlist the view-only
   Members page uses), so a field added to the answer later does not reach the screen. */
const memberWithVersion = (holder: Record<string, unknown> | null, organizationId: string, userId?: string): ManagedMember | null => {
  if (!holder) return null;
  const member = parseMembersPage({ organizationId, members: [holder.member] }, organizationId)?.members[0];
  const version = versionOf(holder.version);
  if (!member || version === null || !isManagementId(member.userId)) return null;
  if (userId !== undefined && member.userId !== userId) return null;
  return { member, version };
};

/** Every answer names the organization it acted on. One that names another is never shown. */
const forOrganization = (data: unknown, organizationId: string): Record<string, unknown> | null => {
  const raw = record(data);
  return raw && raw.organizationId === organizationId ? raw : null;
};

/** GET members/:userId. */
export const parseManagedMember = (data: unknown, organizationId: string, userId: string): ManagedMember | null =>
  memberWithVersion(forOrganization(data, organizationId), organizationId, userId);

export type MemberChangeAnswer = { answer: "member"; changed: boolean; member: Member; version: number };
export type ReassignAnswer = { answer: "reassign"; reassignedCount: number };
export type TransferAnswer = { answer: "transfer"; previousOwner: ManagedMember; owner: ManagedMember };
export type OrganizationBlockAnswer = { answer: "organization"; changed: boolean; blocked: boolean; blockedAt: string | null; sessionsEnded: number | null };
export type WriteAnswer = MemberChangeAnswer | ReassignAnswer | TransferAnswer | OrganizationBlockAnswer;

/** The role, deactivate and reactivate routes: `{ organizationId, changed, member, version }`. */
export const parseMemberChange = (data: unknown, organizationId: string, userId: string): MemberChangeAnswer | null => {
  const raw = forOrganization(data, organizationId);
  const found = memberWithVersion(raw, organizationId, userId);
  if (!raw || !found || typeof raw.changed !== "boolean") return null;
  return { answer: "member", changed: raw.changed, ...found };
};

/** reassign-rfps: `{ organizationId, reassignedCount, rfpIds }`. The ids are not kept: the count is what is shown. */
export const parseReassignment = (data: unknown, organizationId: string): ReassignAnswer | null => {
  const raw = forOrganization(data, organizationId);
  const reassignedCount = wholeNumber(raw?.reassignedCount);
  return raw && reassignedCount !== null ? { answer: "reassign", reassignedCount } : null;
};

/** ownership/transfer: `{ organizationId, previousOwner: { member, version }, owner: { member, version } }`. */
export const parseTransfer = (data: unknown, organizationId: string, toUserId: string): TransferAnswer | null => {
  const raw = forOrganization(data, organizationId);
  const owner = memberWithVersion(record(raw?.owner), organizationId, toUserId);
  const previousOwner = memberWithVersion(record(raw?.previousOwner), organizationId);
  return owner && previousOwner ? { answer: "transfer", previousOwner, owner } : null;
};

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
  | "invalid_request"
  | "invalid_reason"
  | "invalid_role"
  | "version_required"
  | "organization_not_found"
  | "member_not_found"
  | "reassign_target_not_found"
  | "stale_version"
  | "ownership_transfer_required"
  | "owner_has_proposals"
  | "last_owner"
  | "member_removed"
  | "member_not_deactivated"
  | "member_inactive"
  | "already_owner"
  | "owner_changed"
  | "owner_not_found"
  | "organization_not_manageable"
  | "reassign_target_ineligible"
  | "reassign_to_self"
  | "proposals_not_owned"
  // Team management (lib/organizationManagement/teams.ts).
  | "invalid_team_id"
  | "invalid_team_name"
  | "invalid_teams"
  | "unknown_teams"
  | "team_not_found"
  | "team_member_not_found"
  /** MEMBER_NOT_FOUND on adding a team member or setting a manager: not an active member of the organization. */
  | "member_not_active"
  | "team_name_taken"
  | "team_archived"
  | "team_member_exists"
  | "team_manager_role_required"
  | "teams_unavailable";

const BY_CODE: Record<string, ManagementFailure> = {
  // 400
  INVALID_REASON: "invalid_reason",
  INVALID_ROLE: "invalid_role",
  VERSION_REQUIRED: "version_required",
  INVALID_ORGANIZATION_ID: "invalid_id",
  INVALID_MEMBER_ID: "invalid_id",
  MEMBER_REQUIRED: "invalid_request",
  REASSIGN_TARGET_REQUIRED: "invalid_request",
  INVALID_RFP_SELECTION: "invalid_request",
  REASSIGN_TO_SELF: "reassign_to_self",
  ALREADY_OWNER: "already_owner",
  // 403
  STAFF_ACCESS_FORBIDDEN: "forbidden",
  // 404
  ORGANIZATION_NOT_FOUND: "organization_not_found",
  MEMBER_NOT_FOUND: "member_not_found",
  REASSIGN_TARGET_NOT_FOUND: "reassign_target_not_found",
  // 409
  STALE_VERSION: "stale_version",
  OWNERSHIP_TRANSFER_REQUIRED: "ownership_transfer_required",
  OWNER_HAS_RFPS: "owner_has_proposals",
  LAST_OWNER: "last_owner",
  MEMBER_REMOVED: "member_removed",
  MEMBER_NOT_DEACTIVATED: "member_not_deactivated",
  MEMBER_INACTIVE: "member_inactive",
  OWNER_CHANGED: "owner_changed",
  OWNER_NOT_FOUND: "owner_not_found",
  ORGANIZATION_NOT_MANAGEABLE: "organization_not_manageable",
  REASSIGN_TARGET_INELIGIBLE: "reassign_target_ineligible",
  RFPS_NOT_OWNED_BY_MEMBER: "proposals_not_owned",
  // 500: the change may already be saved (the session revocation runs after it).
  STAFF_MEMBERS_INTERNAL_ERROR: "outcome_unknown",
  STAFF_ORGANIZATION_BLOCK_INTERNAL_ERROR: "outcome_unknown",
  // Staff team management (docs/API.md, "Staff team management").
  INVALID_TEAM_ID: "invalid_team_id",
  INVALID_TEAM_NAME: "invalid_team_name",
  INVALID_TEAM_MANAGER: "invalid_request",
  INVALID_TEAMS: "invalid_teams",
  UNKNOWN_TEAMS: "unknown_teams",
  TEAM_NOT_FOUND: "team_not_found",
  TEAM_MEMBER_NOT_FOUND: "team_member_not_found",
  TEAM_NAME_TAKEN: "team_name_taken",
  TEAM_ARCHIVED: "team_archived",
  TEAM_MEMBER_EXISTS: "team_member_exists",
  TEAM_MANAGER_ROLE_REQUIRED: "team_manager_role_required",
  // 503, answered before anything is written.
  TEAMS_UNAVAILABLE: "teams_unavailable",
  STAFF_TEAMS_INTERNAL_ERROR: "outcome_unknown",
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
  /** OWNER_HAS_RFPS: how many proposals the member still owns. */
  ownedProposalCount?: number;
  /** OWNER_HAS_RFPS on a deactivation that was saved and put back. */
  reverted?: true;
  /** ORGANIZATION_NOT_MANAGEABLE: `platform` or the organization's kind. */
  standing?: string;
  /** RFPS_NOT_OWNED_BY_MEMBER. */
  notOwnedCount?: number;
  /** UNKNOWN_TEAMS: the ids, of those sent, that are not active teams of the organization. */
  unknownTeamIds?: string[];
  retryAfterSeconds?: number;
};

export type ManagementResult<T> = { ok: true; data: T } | ManagementRefusal;

export const refused = (failure: ManagementFailure): ManagementRefusal => ({ ok: false, failure, code: null });

/** The refusal of an answer that was not a success. Only the code and the counted details are kept. */
export const refusalOf = (status: number, body: unknown, retryAfter: string | null | undefined, mode: RequestMode): ManagementRefusal => {
  const raw = record(body);
  const code = codeOf(raw?.code);
  const failure = managementFailure(status, code, mode);
  const owned = wholeNumber(raw?.ownedRfpCount);
  const notOwned = wholeNumber(raw?.notOwnedCount);
  const retryAfterSeconds = status === 429 ? retryAfterSecondsOf(retryAfter) : null;
  const unknownTeamIds = Array.isArray(raw?.unknownTeamIds) ? raw.unknownTeamIds.filter(isManagementId).slice(0, 100) : [];
  return {
    ok: false,
    failure,
    code,
    ...(failure === "owner_has_proposals" && owned !== null ? { ownedProposalCount: owned } : {}),
    ...(failure === "owner_has_proposals" && raw?.reverted === true ? { reverted: true as const } : {}),
    ...(failure === "organization_not_manageable" && typeof raw?.standing === "string" && /^[a-z_]{1,40}$/.test(raw.standing) ? { standing: raw.standing } : {}),
    ...(failure === "proposals_not_owned" && notOwned !== null ? { notOwnedCount: notOwned } : {}),
    ...(failure === "unknown_teams" && unknownTeamIds.length > 0 ? { unknownTeamIds } : {}),
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
};

export type FailureCopy = { title: string; message: string; tone: "calm" | "problem" };

const waitText = (seconds: number | null | undefined) =>
  seconds ? ` Try again in about ${seconds < 90 ? countLabel(seconds, "second") : countLabel(Math.ceil(seconds / 60), "minute")}.` : " Wait a few minutes, up to 15, then try again.";

/** The sentence for a refusal. Fixed wording: nothing the backend wrote is shown. */
export const managementFailureCopy = (refusal: Pick<ManagementRefusal, "failure" | "ownedProposalCount" | "reverted" | "standing" | "notOwnedCount" | "retryAfterSeconds">): FailureCopy => {
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
        message: `Member, team and organization changes share one allowance of 60 per 15 minutes for each staff account; pages opened here count toward the 300 views of customer content.${waitText(refusal.retryAfterSeconds)} Nothing was changed.`,
        tone: "calm",
      };
    case "not_available":
      return { title: "Not available yet", message: "Staff can manage this here after the next RFPilot update. Nothing was changed.", tone: "calm" };
    case "outcome_unknown":
      return {
        title: "The change may or may not have been saved",
        message: "The server did not confirm the change: it reported an error, could not be reached, or answered in a way that could not be read. Check the current state before trying again.",
        tone: "problem",
      };
    case "invalid_id":
      return { title: "This link doesn't point to a member or an organization", message: "The address is incomplete or mistyped. Open it from the organization's Members page.", tone: "calm" };
    case "invalid_request":
      return { title: "The request was not complete", message: "Something the change needs was missing or malformed. Nothing was changed. Go back, check the form and review again.", tone: "problem" };
    case "invalid_reason":
      return { title: "The reason was not accepted", message: `${REASON_RULE} Nothing was changed.`, tone: "problem" };
    case "invalid_role":
      return { title: "That role can't be given here", message: "The role must be Admin, Team Manager, Planner or Viewer. Nothing was changed.", tone: "problem" };
    case "version_required":
      return { title: "The member's current version was missing", message: "The change must name the version of the member it was reviewed against. Load the current member and review again. Nothing was changed.", tone: "problem" };
    case "organization_not_found":
      return { title: "Organization not found", message: "This organization doesn't exist, or it has been removed. Nothing was changed.", tone: "calm" };
    case "member_not_found":
      return { title: "Member not found", message: "This person is not a member of this organization. Nothing was changed.", tone: "calm" };
    case "reassign_target_not_found":
      return { title: "The receiving member was not found", message: "The member chosen to receive the proposals is not a member of this organization. Nothing was moved. Choose another member.", tone: "problem" };
    case "stale_version":
      return {
        title: "This member changed in the meantime",
        message: "This member changed after this page loaded it, so the change was not made. Load the current member, check it and review again.",
        tone: "calm",
      };
    case "ownership_transfer_required":
      return { title: "The Owner role only moves by a transfer", message: "A role change never makes a member the Owner or changes the Owner's role. Use Transfer ownership instead. Nothing was changed.", tone: "problem" };
    case "owner_has_proposals": {
      const count = refusal.ownedProposalCount;
      const owns = count === undefined ? "This member still owns proposals" : `This member still owns ${countLabel(count, "proposal")}`;
      return {
        title: `${owns}`,
        message: refusal.reverted
          ? "The member created a proposal while the deactivation was being saved, so it was put back: the member is still active. Reassign their proposals to another member, then deactivate again."
          : "A member who owns proposals can't be deactivated or made a Viewer. Reassign their proposals to another member first. Nothing was changed.",
        tone: "calm",
      };
    }
    case "last_owner":
      return { title: "The Owner can't be deactivated", message: "Transfer ownership to another active member first. Nothing was changed.", tone: "problem" };
    case "member_removed":
      return { title: "This member has been removed", message: "A removed member can't be changed. Nothing was changed.", tone: "calm" };
    case "member_not_deactivated":
      return { title: "This member is not deactivated", message: "Only a deactivated member can be reactivated. Nothing was changed.", tone: "calm" };
    case "member_inactive":
      return { title: "This member is not active", message: "Ownership can only go to an active member. Nothing was changed.", tone: "problem" };
    case "already_owner":
      return { title: "This member is already the Owner", message: "There is nothing to transfer. Nothing was changed.", tone: "calm" };
    case "owner_changed":
      return { title: "The Owner changed while this was being saved", message: "Someone else moved the ownership at the same moment, so this transfer was not made. Open this page again to see the current Owner.", tone: "problem" };
    case "owner_not_found":
      return { title: "This organization has no active Owner", message: "There is no Owner to transfer from, and staff do not appoint one. Nothing was changed.", tone: "problem" };
    case "organization_not_manageable":
      return refusal.standing === "platform"
        ? { title: "RFPilot's own organization can't be managed here", message: "Staff accounts live in it. Nothing in it is read or changed from this screen.", tone: "calm" }
        : { title: "This organization can't be managed yet", message: "It is awaiting placement, so its members can't be managed and it can't be blocked. Nothing was changed.", tone: "calm" };
    case "reassign_target_ineligible":
      return { title: "That member can't receive proposals", message: "Proposals can only go to an active member who isn't a Viewer. Nothing was moved. Choose another member.", tone: "problem" };
    case "reassign_to_self":
      return { title: "Choose a different member", message: "Proposals can't be reassigned to the member who already owns them. Nothing was moved.", tone: "problem" };
    case "proposals_not_owned": {
      const count = refusal.notOwnedCount;
      return {
        title: "Some proposals are not owned by this member",
        message: `${count === undefined ? "Some of the proposals" : countLabel(count, "proposal")} named in the request ${count === 1 ? "is" : "are"} not owned by this member. Nothing was moved.`,
        tone: "problem",
      };
    }
    case "invalid_team_id":
      return { title: "This link doesn't point to a team", message: "The address is incomplete or mistyped. Open it from the organization's Teams page.", tone: "calm" };
    case "invalid_team_name":
      return { title: "The team name was not accepted", message: "A team name must be 1 to 120 characters. Nothing was changed.", tone: "problem" };
    case "invalid_teams":
      return { title: "The list of teams was not accepted", message: "It must be a list of up to 100 teams. Nothing was changed.", tone: "problem" };
    case "unknown_teams":
      return {
        title: "Some of the teams are not active teams of this organization",
        message: "A team that is archived, missing or in another organization can't be chosen. Nothing was changed, not even the teams that are active.",
        tone: "problem",
      };
    case "team_not_found":
      return { title: "Team not found", message: "This team doesn't exist in this organization. Nothing was changed.", tone: "calm" };
    case "team_member_not_found":
      return { title: "This member is not on the team", message: "Only a member who is on the team can be taken off it or have their manager setting changed. Nothing was changed.", tone: "calm" };
    case "member_not_active":
      return { title: "Not an active member of this organization", message: "Only an active member of the organization can be added to a team or made its manager. Nothing was changed.", tone: "problem" };
    case "team_name_taken":
      return { title: "An active team already has this name", message: "Active team names are unique in an organization, ignoring case. Nothing was changed. Choose another name.", tone: "problem" };
    case "team_archived":
      return { title: "This team is archived", message: "An archived team can't be renamed, archived again or have its members changed, and there is no un-archive. Nothing was changed.", tone: "calm" };
    case "team_member_exists":
      return { title: "This member is already on the team", message: "There is nothing to add. Nothing was changed.", tone: "calm" };
    case "team_manager_role_required":
      return { title: "A team manager must hold the Team Manager role", message: "Only a member with the Team Manager role can manage a team. Nothing was changed.", tone: "problem" };
    case "teams_unavailable":
      return { title: "Teams aren't available on the server right now", message: "The server could not check the teams, so it changed nothing. Try again in a moment.", tone: "problem" };
    default:
      return { title: "Unable to load this page", message: "The server couldn't be reached or didn't answer as expected. Try again in a moment.", tone: "problem" };
  }
};

/* ---------- which writes a member's state offers ---------- */

export type MemberStanding = "active" | "deactivated" | "invited" | "removed" | "other";

/* The staff routes return the membership's stored status, where a deactivated member is
   `suspended`; the customer-facing API calls the same state `deactivated`. Both read as deactivated. */
export const memberStanding = (status: string): MemberStanding => {
  if (status === "active") return "active";
  if (status === "suspended" || status === "deactivated") return "deactivated";
  if (status === "invited" || status === "removed") return status;
  return "other";
};

export const isOwnerMember = (member: Pick<Member, "roles">): boolean => member.roles.includes("owner");

const CUSTOMER_ROLES = ["owner", ...ASSIGNABLE_ROLES] as const;
/** The single customer role a membership carries (an old membership may hold several). */
export const customerRoleOf = (roles: string[]): string | null => CUSTOMER_ROLES.find((role) => roles.includes(role)) ?? null;
export const currentRoleLabel = (member: Pick<Member, "roles">): string => {
  const role = customerRoleOf(member.roles);
  return role ? roleLabel(role) : "No role";
};

/* The writes offered for a member, by status and whether they are the Owner. The Owner is
   changed only by a transfer to someone else: never a role change, never a deactivation.
   Reassigning proposals is offered for every known status, a removed or an invited member
   included: the backend's reassignment asks only that the source is a member of the organization
   (`decideReassignment` checks the receiver's status, never the source's), and the one path that
   marks a membership removed does not move the proposals it owns, so a removed member can still
   own some. */
export const memberWritesFor = (member: Pick<Member, "roles" | "status">): MemberWrite[] => {
  const standing = memberStanding(member.status);
  const owner = isOwnerMember(member);
  const writes: MemberWrite[] = [];
  if (!owner && (standing === "active" || standing === "deactivated" || standing === "invited")) writes.push("role");
  if (!owner && standing === "active") writes.push("deactivate");
  if (standing === "deactivated") writes.push("reactivate");
  if (standing !== "other") writes.push("reassign");
  if (!owner && standing === "active") writes.push("transfer");
  return writes;
};

/** The roles a role change may name: the ones the API accepts, without the one the member has. */
export const roleChoicesFor = (member: Pick<Member, "roles">): AssignableRole[] => {
  const current = customerRoleOf(member.roles);
  return ASSIGNABLE_ROLES.filter((role) => role !== current);
};

/** Blocking is for a customer organization that is not blocked; reactivating for any that is. */
export const organizationWritesFor = (organization: Pick<ManagedOrganization, "standing" | "blocked">): OrganizationWrite[] => {
  if (organization.blocked) return ["unblock"];
  return organization.standing === "active" || organization.standing === "inactive" ? ["block"] : [];
};

/* ---------- choosing who receives the proposals ---------- */

export type ReassignCandidate = Pick<Member, "userId" | "name" | "email" | "roles" | "status">;
/** One page of the Members list as the picker gets it: only the members who can receive the
    proposals, and how many of that page cannot (counted on the server, never named). */
export type ReassignCandidatesPage = { candidates: ReassignCandidate[]; notEligibleCount: number; pagination: Pagination };

const PROPOSAL_OWNER_ROLES = ["owner", "organization_admin", "team_manager", "planner"];

/** The API's rule for the receiving member: active, allowed to own proposals, and someone else. */
export const canReceiveProposals = (candidate: ReassignCandidate, fromUserId: string): boolean =>
  isManagementId(candidate.userId) &&
  candidate.userId !== fromUserId &&
  memberStanding(candidate.status) === "active" &&
  candidate.roles.some((role) => PROPOSAL_OWNER_ROLES.includes(role));

/** What a write flow's client state belongs to: the write, the member and the version it was read at. */
export const flowKey = (write: MemberWrite, managed: ManagedMember): string => `${write}:${managed.member.userId}:${managed.version}`;

/* ---------- which backend reads each page makes ---------- */

/** The two audited reads the management pages make. A page is handed only what it shows. */
export type ManagementReads = {
  member(organizationId: string, userId: string): Promise<ManagementResult<ManagedMember>>;
  /** `write` is the page asking: the Owner's name and email are returned for a transfer only. */
  organization(organizationId: string, write: WriteKind): Promise<ManagementResult<ManagedOrganization>>;
};

/** The member page: the one member, read once. Nothing is asked for an address that is not made of ids. */
export const loadMemberPage = async (reads: Pick<ManagementReads, "member">, organizationId: string, userId: string): Promise<ManagementResult<ManagedMember>> => {
  if (!isManagementId(organizationId) || !isManagementId(userId)) return refused("invalid_id");
  return reads.member(organizationId, userId);
};

export type MemberWriteLoad =
  | { state: "ready"; member: ManagedMember; organization: ManagedOrganization }
  /** The member is there, but this write is not one their state offers: the organization is not read. */
  | { state: "not_offered"; member: ManagedMember }
  | { state: "failed"; refusal: ManagementRefusal };

/* A member write page: the member (who changes, and the version the write needs), then the
   organization (its name is in the review and is what a transfer asks staff to type; its Owner is
   who a transfer makes an Admin). The organization is read only when the flow will be shown. */
export const loadMemberWritePage = async (reads: ManagementReads, organizationId: string, userId: string, write: MemberWrite): Promise<MemberWriteLoad> => {
  if (!isManagementId(organizationId) || !isManagementId(userId)) return { state: "failed", refusal: refused("invalid_id") };
  const member = await reads.member(organizationId, userId);
  if (!member.ok) return { state: "failed", refusal: member };
  if (!memberWritesFor(member.data.member).includes(write)) return { state: "not_offered", member: member.data };
  const organization = await reads.organization(organizationId, write);
  if (!organization.ok) return { state: "failed", refusal: organization };
  return { state: "ready", member: member.data, organization: organization.data };
};

export type OrganizationWriteLoad =
  | { state: "ready"; organization: ManagedOrganization }
  | { state: "not_offered"; organization: ManagedOrganization }
  | { state: "failed"; refusal: ManagementRefusal };

/** The block and reactivate pages: the organization, read once. */
export const loadOrganizationWritePage = async (reads: Pick<ManagementReads, "organization">, organizationId: string, write: OrganizationWrite): Promise<OrganizationWriteLoad> => {
  if (!isManagementId(organizationId)) return { state: "failed", refusal: refused("invalid_id") };
  const organization = await reads.organization(organizationId, write);
  if (!organization.ok) return { state: "failed", refusal: organization };
  return organizationWritesFor(organization.data).includes(write) ? { state: "ready", organization: organization.data } : { state: "not_offered", organization: organization.data };
};

/* ---------- wording ---------- */

export const organizationLabel = (organization: Pick<ManagedOrganization, "name">): string => organization.name.trim() || "Unnamed organization";

/** What staff type to confirm a transfer or a block: the organization's name, or its id when it has none. */
export const confirmationPhrase = (organization: Pick<ManagedOrganization, "name" | "id">): string => organization.name.trim() || organization.id;

/** "Pat Planner (pat@acme.example)": the member as every review and result names them. */
export const memberLabel = (member: Pick<Member, "name" | "email">): string => {
  if (member.name && member.email) return `${member.name} (${member.email})`;
  return member.name ?? member.email ?? "A member with no name or email on file";
};

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

export const WRITE_COPY: Record<WriteKind, WriteCopy> = {
  role: { title: "Change role", confirm: "Change role", sending: "Changing the role", danger: false },
  deactivate: { title: "Deactivate member", confirm: "Deactivate member", sending: "Deactivating the member", danger: true },
  reactivate: { title: "Reactivate member", confirm: "Reactivate member", sending: "Reactivating the member", danger: false },
  reassign: { title: "Reassign proposals", confirm: "Reassign proposals", sending: "Reassigning the proposals", danger: false },
  transfer: { title: "Transfer ownership", confirm: "Transfer ownership", sending: "Transferring ownership", danger: true },
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
    "Does not stop RFPilot staff: staff can still view and manage the organization.",
    "Is not shown to the customer as a staff change: it is recorded on the RFPilot side only.",
  ],
} as const;

/** What the form holds before the review. */
export type WriteDraft = { reason: string; role: string; target: ReassignCandidate | null };
export const emptyDraft = (): WriteDraft => ({ reason: "", role: "", target: null });

export type DraftField = "reason" | "role" | "target";
export type DraftErrors = Partial<Record<DraftField, string>>;

/** The checked values a review states and a confirmation sends. */
export type WriteRequest = { reason: string; role?: AssignableRole; target?: ReassignCandidate };

export const checkDraft = (kind: WriteKind, draft: WriteDraft, member?: Pick<Member, "roles" | "userId">): { ok: true; request: WriteRequest } | { ok: false; errors: DraftErrors } => {
  const errors: DraftErrors = {};
  const reason = reasonOf(draft.reason);
  if (reason === null) errors.reason = REASON_RULE;
  if (kind === "role") {
    if (!isAssignableRole(draft.role)) errors.role = "Choose the new role.";
    else if (member && customerRoleOf(member.roles) === draft.role) errors.role = "The member already has that role. Choose a different one.";
  }
  if (kind === "reassign" && (!draft.target || !canReceiveProposals(draft.target, member?.userId ?? ""))) {
    errors.target = "Choose the member who receives the proposals.";
  }
  if (reason === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    request: {
      reason,
      ...(kind === "role" ? { role: draft.role as AssignableRole } : {}),
      ...(kind === "reassign" && draft.target ? { target: draft.target } : {}),
    },
  };
};

/* Who a transfer makes an Admin. The request names only the new Owner (`toUserId` and that
   member's version); the backend demotes whoever is the Owner when it commits. The Owner this page
   read is therefore named as the Owner "when this page loaded", never as who will be demoted. The
   organization is not read again after "Load the current member", so the wording has to hold then too. */
export const currentOwnerLine = (organization: Pick<ManagedOrganization, "owner">): string => {
  const owner = organization.owner;
  const named = owner ? memberLabel({ name: owner.name || null, email: owner.email || null }) : null;
  return named && (owner?.name || owner?.email)
    ? `The organization's current Owner becomes an Admin and is signed out everywhere at once: ${named} when this page loaded, or whoever holds the role when the transfer is saved.`
    : "The organization's current Owner, whoever holds the role when the transfer is saved, becomes an Admin and is signed out everywhere at once.";
};

export type ReviewContext = { organization: ManagedOrganization; member?: Member };

/** The review, in plain words: who and what changes. The reason is shown beside it, as typed. */
export const reviewLines = (kind: WriteKind, context: ReviewContext, request: WriteRequest): string[] => {
  const organization = organizationLabel(context.organization);
  const who = context.member ? memberLabel(context.member) : "This member";
  const role = context.member ? currentRoleLabel(context.member) : "No role";
  switch (kind) {
    case "role":
      return [
        `${who} in ${organization}: the role changes from ${role} to ${request.role ? roleLabel(request.role) : "a new role"}.`,
        "If the new role has fewer rights, the member is signed out everywhere at once. Otherwise their other sessions end on their next request.",
      ];
    case "deactivate":
      return [
        `${who} in ${organization} is deactivated.`,
        `They are signed out everywhere at once and can't sign in until they are reactivated. Their role (${role}) and their data are kept.`,
      ];
    case "reactivate":
      return [`${who} in ${organization} is reactivated, with the role ${role}.`, "They can sign in again. Sessions that were ended stay ended."];
    case "reassign":
      return [
        `Every proposal ${who} owns in ${organization} moves to ${request.target ? memberLabel(request.target) : "the member you chose"}.`,
        "Only the owner of each proposal changes. The proposals themselves, their vendors and their responses are not changed.",
      ];
    case "transfer":
      return [
        `${who} becomes the Owner of ${organization}. Their role changes from ${role} to Owner.`,
        currentOwnerLine(context.organization),
        "An organization has exactly one Owner. This can only be undone by another transfer.",
      ];
    case "block":
      return [`${organization} is blocked.`, ...BLOCK_EFFECTS.does, ...BLOCK_EFFECTS.doesNot];
    default:
      return [
        `${organization} is reactivated.`,
        "Members can sign in again, and vendor links, shared proposal pages and invitation links work again.",
        "Sessions the block ended stay ended: members sign in again. Paused background work runs at its next turn.",
      ];
  }
};

/* ---------- after a write whose outcome is unknown ---------- */

/* The backend saves a deactivation or a role change first and ends the member's sessions right
   after it. If that second step fails the answer is a 500 with the change saved (docs/API.md,
   "Staff member management", Sessions). The member loaded again then already shows the change, so
   the form has nothing left to offer; what is left is the backend's documented repair: the same
   request with the member's new version, which answers `changed: false` and asks for the sign-out
   again. What the backend source does with that request, write by write:
   - deactivate, member already `suspended`: accepted, `changed: false`, every session ended again.
   - role, member already has the role: accepted, `changed: false`, the member's other sessions end
     on their next request (the retry cannot tell which way the role moved).
   - reactivate, member already `active`: accepted, `changed: false`, and nothing else: a
     reactivation ends no session, so there is nothing to finish and no resend is offered.
   - transfer, target already the Owner: refused, 400 ALREADY_OWNER. No resend is offered.
   - reassign: the member read says nothing about proposals, so the outcome is not shown by it. */
export type UnknownOutcomeFollowUp = {
  title: string;
  lines: string[];
  /** The one resend offered: the same request, with the version of the member as loaded again. */
  resend: { label: string; sending: string } | null;
};

export const FINISH_SIGN_OUT = { label: "Finish signing this member out", sending: "Asking for the sign-out again" } as const;

/** What to say once the member, loaded again after an unknown outcome, already shows what was
    asked for. Null when it does not: the form and the review are then shown as before. */
export const unknownOutcomeFollowUp = (kind: WriteKind, context: ReviewContext, request: WriteRequest): UnknownOutcomeFollowUp | null => {
  const member = context.member;
  if (!member) return null;
  const standing = memberStanding(member.status);
  const organization = organizationLabel(context.organization);
  const who = memberLabel(member);
  const unconfirmed = "The server did not confirm the change when it was sent";
  switch (kind) {
    case "deactivate":
      if (standing !== "deactivated") return null;
      return {
        title: "The deactivation was saved",
        lines: [
          `${who} is deactivated in ${organization}.`,
          `${unconfirmed}, so signing the member out everywhere may not have completed.`,
          "Sending the same request again changes nothing about the member. It asks the server to end all of the member's sessions again.",
        ],
        resend: FINISH_SIGN_OUT,
      };
    case "role":
      if (!request.role || customerRoleOf(member.roles) !== request.role || isOwnerMember(member)) return null;
      if (standing !== "active" && standing !== "deactivated" && standing !== "invited") return null;
      return {
        title: "The role change was saved",
        lines: [
          `${who} has the role ${roleLabel(request.role)} in ${organization}.`,
          `${unconfirmed}, so signing the member out may not have completed.`,
          "Sending the same role again changes nothing about the member. It asks the server to end the member's other sessions on their next request; a repeated request can't sign the member out everywhere at once, because the server can't tell from it whether the role lost rights.",
        ],
        resend: FINISH_SIGN_OUT,
      };
    case "reactivate":
      if (standing !== "active") return null;
      return {
        title: "The reactivation was saved",
        lines: [`${who} is active in ${organization}, with the role ${currentRoleLabel(member)}.`, "A reactivation signs nobody out, so nothing more is needed."],
        resend: null,
      };
    case "transfer":
      if (!isOwnerMember(member)) return null;
      return {
        title: "The transfer was saved",
        lines: [
          `${who} is the Owner of ${organization}.`,
          `${unconfirmed}, so signing the previous Owner out everywhere may not have completed.`,
          "A transfer can't be sent again: the server refuses it because this member is already the Owner. Nothing more can be done from this page.",
        ],
        resend: null,
      };
    default:
      return null;
  }
};

/** What came before the answer a result shows. */
export type ResultHistory = {
  /** The answer is to the resend offered after an unknown outcome. */
  finishingSignOut?: boolean;
  /** An earlier attempt from this page got no confirmed answer: it may have been saved. */
  afterUnknownOutcome?: boolean;
};

export type ResultSummary = { title: string; lines: string[] };

/** What happened, from the API's own answer. No second read is made to show it. */
export const resultSummary = (kind: WriteKind, context: ReviewContext, request: WriteRequest, answer: WriteAnswer, history: ResultHistory = {}): ResultSummary => {
  const organization = organizationLabel(context.organization);
  if (answer.answer === "member") {
    const who = memberLabel(answer.member);
    const state = `${who} is ${memberStatusLabel(answer.member.status).toLowerCase()} in ${organization}, with the role ${currentRoleLabel(answer.member)}.`;
    if (!answer.changed && history.finishingSignOut && (kind === "deactivate" || kind === "role")) {
      return {
        title: "Sign-out asked for again",
        lines: [
          state,
          kind === "deactivate"
            ? "Nothing about the member changed. The server ended all of the member's sessions again and confirmed it."
            : "Nothing about the member changed. The server confirmed that the member's other sessions end on their next request.",
        ],
      };
    }
    if (!answer.changed) {
      return { title: "Nothing needed changing", lines: [state, "The member was already in that state. The request is still recorded on the RFPilot side."] };
    }
    const title = kind === "role" ? "Role changed" : kind === "deactivate" ? "Member deactivated" : "Member reactivated";
    return { title, lines: [state] };
  }
  if (answer.answer === "reassign") {
    const from = context.member ? memberLabel(context.member) : "the member";
    const to = request.target ? memberLabel(request.target) : "the member you chose";
    return answer.reassignedCount === 0
      ? {
          title: "No proposals to move",
          lines: history.afterUnknownOutcome
            ? [
                `${from} owns no proposals in ${organization} now. This request moved nothing.`,
                `An earlier attempt from this page was not confirmed by the server and may already have moved them to the member chosen then.`,
              ]
            : [`${from} owns no proposals in ${organization}. Nothing was moved.`],
        }
      : { title: "Proposals reassigned", lines: [`${countLabel(answer.reassignedCount, "proposal")} moved from ${from} to ${to} in ${organization}.`] };
  }
  if (answer.answer === "transfer") {
    return {
      title: "Ownership transferred",
      lines: [
        `${memberLabel(answer.owner.member)} is now the Owner of ${organization}.`,
        `${memberLabel(answer.previousOwner.member)} now has the role ${currentRoleLabel(answer.previousOwner.member)}.`,
      ],
    };
  }
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

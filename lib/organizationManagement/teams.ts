// Staff management of a customer organization's teams (owner decision, 2026-11-18): RFPilot staff
// create, rename and archive a team, add and remove a team member, set or unset a team manager,
// and set which teams a member is on. Teams only: staff do not change which team a proposal is
// on, and nothing here edits or deletes a proposal, a template or the vendor list.
//
// The backend routes are under /api/v1/admin/organizations/:organizationId (docs/API.md, "Staff
// team management"). Every request, the team read included, is recorded in the staff
// organization's audit trail and never in the customer's. So nothing is cached or fetched ahead
// of the screen that shows it.
//
// This file is the sibling of management.ts and is pure like it: paths, parsers, which writes a
// team's and a team member's state offer, which reads each page makes, and the words of each
// review and result. The ids, the reason, the refusals and their wording are management.ts's own.
// Every sentence about what a team change does is the backend documentation's, and says no more.

import { formatContentDate, parseTeams, type Member, type MemberTeam, type Pagination, type Team, type TeamsList } from "@/lib/organizationContent/content";
import { countLabel } from "@/lib/plural";
import {
  isManagementId,
  MANAGEMENT_PATH,
  memberLabel,
  memberManagementPath,
  memberStanding,
  organizationLabel,
  parseManagedMember,
  parseMemberChange,
  reasonOf,
  REASON_RULE,
  refused,
  type ManagedMember,
  type ManagedOrganization,
  type ManagementRefusal,
  type ManagementResult,
  type MemberChangeAnswer,
  type WriteCopy,
} from "@/lib/organizationManagement/management";

/* ---------- the writes and their addresses ---------- */

/** A write on a team itself. */
export const TEAM_ONLY_WRITES = ["rename", "addMember", "archive"] as const;
export type TeamOnlyWrite = (typeof TEAM_ONLY_WRITES)[number];
/** A write on one member of a team. */
export const TEAM_MEMBER_WRITES = ["makeManager", "removeManager", "removeMember"] as const;
export type TeamMemberWrite = (typeof TEAM_MEMBER_WRITES)[number];
export const TEAM_WRITES = ["create", ...TEAM_ONLY_WRITES, ...TEAM_MEMBER_WRITES, "memberTeams"] as const;
export type TeamWrite = (typeof TEAM_WRITES)[number];

export const isTeamMemberWrite = (kind: TeamWrite): kind is TeamMemberWrite => (TEAM_MEMBER_WRITES as readonly string[]).includes(kind);
export const isTeamOnlyWrite = (kind: TeamWrite): kind is TeamOnlyWrite => (TEAM_ONLY_WRITES as readonly string[]).includes(kind);

/* Like every management page these live outside /organizations/[organizationId]/, which is the
   view-only content browser (components/organizations/content/readOnly.test.ts). */
const teamsBase = (organizationId: string) => `${MANAGEMENT_PATH}/${encodeURIComponent(organizationId)}/teams`;

export const teamCreatePath = (organizationId: string): string => `${teamsBase(organizationId)}/new`;

export const teamManagementPath = (organizationId: string, teamId: string): string => `${teamsBase(organizationId)}/${encodeURIComponent(teamId)}`;

const TEAM_WRITE_SEGMENTS: Record<TeamOnlyWrite, string> = { rename: "rename", addMember: "members/add", archive: "archive" };

export const teamWritePath = (organizationId: string, teamId: string, write: TeamOnlyWrite): string =>
  `${teamManagementPath(organizationId, teamId)}/${TEAM_WRITE_SEGMENTS[write]}`;

const TEAM_MEMBER_WRITE_SEGMENTS: Record<TeamMemberWrite, string> = { makeManager: "make-manager", removeManager: "remove-manager", removeMember: "remove" };

export const teamMemberWritePath = (organizationId: string, teamId: string, userId: string, write: TeamMemberWrite): string =>
  `${teamManagementPath(organizationId, teamId)}/members/${encodeURIComponent(userId)}/${TEAM_MEMBER_WRITE_SEGMENTS[write]}`;

/** Under the member, beside the member's other writes: which teams the member is on. */
export const memberTeamsPath = (organizationId: string, userId: string): string => `${memberManagementPath(organizationId, userId)}/teams`;

/* ---------- what a write carries ---------- */

export const TEAM_NAME_MAX = 120;
/** The API's own rule. */
export const TEAM_NAME_RULE = `Give the team a name of 1 to ${TEAM_NAME_MAX} characters.`;

/** The name as it is sent: trimmed, 1 to 120 characters. Null when it is not one. */
export const teamNameOf = (value: unknown): string | null => {
  const name = typeof value === "string" ? value.trim() : "";
  return name.length >= 1 && name.length <= TEAM_NAME_MAX ? name : null;
};

/** `PUT members/:userId/teams` takes up to 100 team ids. */
export const MEMBER_TEAMS_MAX = 100;

/** The team ids as they are sent: a list of at most 100 ids, each one once. Null for anything else,
    a list holding one value that is not an id included. */
export const teamIdsOf = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || !value.every(isManagementId)) return null;
  const ids = [...new Set(value as string[])];
  return ids.length <= MEMBER_TEAMS_MAX ? ids : null;
};

/** The one role a team's manager must hold (TEAM_MANAGER_ROLE_REQUIRED otherwise). */
export const holdsTeamManagerRole = (roles: readonly string[]): boolean => roles.includes("team_manager");

/* ---------- reading the answers ---------- */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** The backend lists at most this many members with a team; `memberCount` is the true count. */
export const TEAM_MEMBER_LIMIT = 200;
/** And at most this many managers, with no count of them. */
export const TEAM_MANAGER_LIMIT = 200;
/** The single-member read lists at most this many of a member's team memberships. */
export const MEMBER_TEAMS_LIMIT = 500;

/** One member of a team: the member, the membership version a change of their teams needs, and whether they manage the team. */
export type TeamMember = ManagedMember & { isManager: boolean };

/** One team as the staff team routes return it, with the members listed (at most 200). */
export type ManagedTeam = { team: Team; members: TeamMember[] };

/* `{ organizationId, team, members: [{ member, version, isManager }] }`: the team read and the
   answer of every team write. The team is read through the Teams list's own parser and each
   member through the member read's (the allowlists the view-only pages use), so a field added to
   the answer later does not reach the screen. An answer that names another organization or
   another team is never shown. A member row that cannot be read is left out: the count beside
   the list then says the list is shorter. */
export const parseManagedTeam = (data: unknown, organizationId: string, teamId?: string): ManagedTeam | null => {
  const raw = record(data);
  if (!raw || raw.organizationId !== organizationId || !Array.isArray(raw.members)) return null;
  const team = parseTeams({ organizationId, teams: [raw.team] }, organizationId)?.teams[0];
  if (!team || !isManagementId(team.id) || (teamId !== undefined && team.id !== teamId)) return null;
  const members: TeamMember[] = [];
  for (const row of raw.members) {
    const entry = record(row);
    const userId = record(entry?.member)?.userId;
    const found = entry && isManagementId(userId) ? parseManagedMember({ organizationId, member: entry.member, version: entry.version }, organizationId, userId) : null;
    if (found) members.push({ ...found, isManager: entry?.isManager === true });
  }
  return { team, members };
};

export type TeamAnswer = { answer: "team"; team: ManagedTeam };
export type TeamWriteAnswer = TeamAnswer | MemberChangeAnswer;

/** What the answer to a team write must agree with. An answer that says the opposite of what was asked is not a result to show. */
export type TeamAnswerCheck = {
  teamId?: string;
  /** Create and rename: the name the team now has. */
  name?: string;
  /** Archive. */
  archived?: true;
  /** Remove: the member who must not be among the members listed. */
  absent?: string;
  /** Add and set manager: the member, when listed, with the manager setting asked for. */
  listed?: { userId: string; isManager: boolean };
};

export const parseTeamAnswer = (data: unknown, organizationId: string, check: TeamAnswerCheck): TeamAnswer | null => {
  const team = parseManagedTeam(data, organizationId, check.teamId);
  if (!team) return null;
  if (check.name !== undefined && team.team.name !== check.name) return null;
  if (check.archived && !team.team.archived) return null;
  if (check.absent !== undefined && team.members.some((entry) => entry.member.userId === check.absent)) return null;
  const listed = check.listed ? team.members.find((entry) => entry.member.userId === check.listed?.userId) : undefined;
  if (check.listed && listed && listed.isManager !== check.listed.isManager) return null;
  return { answer: "team", team };
};

/** `PUT members/:userId/teams`: `{ organizationId, changed, member, version }`, the shape of a member change. */
export const parseMemberTeamsAnswer = parseMemberChange;

/* ---------- which writes a team's and a team member's state offer ---------- */

/** An archived team offers nothing: it can't be renamed, archived again or have its members changed, and there is no un-archive. */
export const teamWritesFor = (team: Pick<Team, "archived">): TeamOnlyWrite[] => (team.archived ? [] : [...TEAM_ONLY_WRITES]);

/* The writes offered for one member of a team. The backend's rules (teams/application/manageTeams.ts):
   making a manager needs an active member of the organization who holds the Team Manager role;
   unsetting a manager and removing from the team ask nothing of the member, so a deactivated
   member can still be taken off a team or stop being its manager. */
export const teamMemberWritesFor = (row: { isManager: boolean; roles: readonly string[]; status: string }, team: Pick<Team, "archived">): TeamMemberWrite[] => {
  if (team.archived) return [];
  const writes: TeamMemberWrite[] = [];
  if (row.isManager) writes.push("removeManager");
  else if (memberStanding(row.status) === "active" && holdsTeamManagerRole(row.roles)) writes.push("makeManager");
  writes.push("removeMember");
  return writes;
};

/** Why "Make team manager" is not offered for a member who is not one. Null when it is offered, or they already are. */
export const managerNote = (row: { isManager: boolean; roles: readonly string[]; status: string }): string | null => {
  if (row.isManager) return null;
  if (memberStanding(row.status) !== "active") return "Not an active member of the organization, so they can't be made a manager.";
  return holdsTeamManagerRole(row.roles) ? null : "Does not hold the Team Manager role, so they can't be made a manager.";
};

/** A member's teams can be set for every member but a removed one (the customer rule): a deactivated member's too. */
export const memberTeamsOffered = (member: Pick<Member, "status">): boolean => ["active", "deactivated", "invited"].includes(memberStanding(member.status));

/* ---------- choosing who joins a team ---------- */

export type TeamCandidate = Pick<Member, "userId" | "name" | "email" | "roles" | "status">;
/** One page of the Members list as the picker gets it: only the members who can join the team,
    and how many of that page cannot (counted on the server, never named). */
export type TeamCandidatesPage = { candidates: TeamCandidate[]; notEligibleCount: number; pagination: Pagination };

/** The API's rule for a member a team gains: an active member of the organization. One already on the team is refused, so is not offered. */
export const canJoinTeam = (member: Pick<Member, "userId" | "status" | "teams">, teamId: string): boolean =>
  isManagementId(member.userId) && memberStanding(member.status) === "active" && !member.teams.some((team) => team.id === teamId);

/** The same rule on what the browser holds of a candidate (their teams are not handed on). */
export const isTeamCandidate = (candidate: TeamCandidate): boolean => isManagementId(candidate.userId) && memberStanding(candidate.status) === "active";

/* ---------- choosing a member's teams ---------- */

export type TeamChoice = { id: string; name: string };

/** The organization's active teams, from the Teams list read: the only teams a member's teams can name. */
export const activeTeamChoices = (list: TeamsList): TeamChoice[] => list.teams.filter((team) => !team.archived && isManagementId(team.id)).map(({ id, name }) => ({ id, name }));

/** The member's current teams, from the member read: the active ones the request replaces, and the archived ones it leaves as history. */
export const currentTeams = (member: Pick<Member, "teams">): { active: MemberTeam[]; archived: MemberTeam[] } => ({
  active: member.teams.filter((team) => !team.archived),
  archived: member.teams.filter((team) => team.archived),
});

/** The teams ticked when the page opens: the member's active teams that are among the choices. */
export const initialTeamIds = (member: Pick<Member, "teams">, choices: TeamChoice[]): string[] =>
  currentTeams(member)
    .active.map((team) => team.id)
    .filter((id) => choices.some((choice) => choice.id === id));

/** What a chosen set changes against the member's active teams now. */
export const teamsChange = (member: Pick<Member, "teams">, teamIds: string[], choices: TeamChoice[]): { joins: string[]; leaves: string[]; stays: string[] } => {
  const { active } = currentTeams(member);
  const name = (id: string) => choices.find((choice) => choice.id === id)?.name ?? active.find((team) => team.id === id)?.name ?? "A team";
  return {
    joins: teamIds.filter((id) => !active.some((team) => team.id === id)).map(name),
    leaves: active.filter((team) => !teamIds.includes(team.id)).map((team) => team.name),
    stays: teamIds.filter((id) => active.some((team) => team.id === id)).map(name),
  };
};

/* ---------- which backend reads each page makes ---------- */

/** The audited reads the team pages make. A page is handed only what it shows. */
export type TeamReads = {
  team(organizationId: string, teamId: string): Promise<ManagementResult<ManagedTeam>>;
  member(organizationId: string, userId: string): Promise<ManagementResult<ManagedMember>>;
  organization(organizationId: string): Promise<ManagementResult<ManagedOrganization>>;
  activeTeams(organizationId: string): Promise<ManagementResult<TeamChoice[]>>;
};

const failed = (refusal: ManagementRefusal) => ({ state: "failed" as const, refusal });

/** The team page: the one team, read once. Nothing is asked for an address that is not made of ids. */
export const loadTeamPage = async (reads: Pick<TeamReads, "team">, organizationId: string, teamId: string): Promise<ManagementResult<ManagedTeam>> => {
  if (!isManagementId(organizationId)) return refused("invalid_id");
  if (!isManagementId(teamId)) return refused("invalid_team_id");
  return reads.team(organizationId, teamId);
};

export type CreateTeamLoad = { state: "ready"; organization: ManagedOrganization } | { state: "failed"; refusal: ManagementRefusal };

/** The create page: the organization (its name is in the review), read once. */
export const loadCreateTeamPage = async (reads: Pick<TeamReads, "organization">, organizationId: string): Promise<CreateTeamLoad> => {
  if (!isManagementId(organizationId)) return failed(refused("invalid_id"));
  const organization = await reads.organization(organizationId);
  return organization.ok ? { state: "ready", organization: organization.data } : failed(organization);
};

export type TeamWriteLoad =
  | { state: "ready"; team: ManagedTeam; organization: ManagedOrganization }
  /** The team is there, but it is archived: the organization is not read. */
  | { state: "not_offered"; team: ManagedTeam }
  | { state: "failed"; refusal: ManagementRefusal };

/* A team write page (rename, archive, add a member): the team (what changes, and its name, which
   an archive asks staff to type), then the organization (its name is in the review). The
   organization is read only when the flow will be shown. */
export const loadTeamWritePage = async (reads: Pick<TeamReads, "team" | "organization">, organizationId: string, teamId: string, write: TeamOnlyWrite): Promise<TeamWriteLoad> => {
  if (!isManagementId(organizationId)) return failed(refused("invalid_id"));
  if (!isManagementId(teamId)) return failed(refused("invalid_team_id"));
  const team = await reads.team(organizationId, teamId);
  if (!team.ok) return failed(team);
  if (!teamWritesFor(team.data.team).includes(write)) return { state: "not_offered", team: team.data };
  const organization = await reads.organization(organizationId);
  if (!organization.ok) return failed(organization);
  return { state: "ready", team: team.data, organization: organization.data };
};

export type TeamMemberWriteLoad =
  | { state: "ready"; member: ManagedMember; membership: MemberTeam; organization: ManagedOrganization }
  /** The member is there, but is not on the team, or the write is not one their state offers: the organization is not read. */
  | { state: "not_offered"; member: ManagedMember; membership: MemberTeam | null }
  | { state: "failed"; refusal: ManagementRefusal };

/* A page about one member of a team (remove, make or stop being its manager): the member, then
   the organization. The member read carries everything the page shows of the team: its name,
   whether it is archived and whether the member manages it (`member.teams`), whatever the size
   of the team; the team read lists only its first 200 members. So the team is not read. */
export const loadTeamMemberWritePage = async (
  reads: Pick<TeamReads, "member" | "organization">,
  organizationId: string,
  teamId: string,
  userId: string,
  write: TeamMemberWrite,
): Promise<TeamMemberWriteLoad> => {
  if (!isManagementId(organizationId) || !isManagementId(userId)) return failed(refused("invalid_id"));
  if (!isManagementId(teamId)) return failed(refused("invalid_team_id"));
  const member = await reads.member(organizationId, userId);
  if (!member.ok) return failed(member);
  const membership = member.data.member.teams.find((team) => team.id === teamId) ?? null;
  if (!membership || !teamMemberWritesFor({ isManager: membership.isManager, roles: member.data.member.roles, status: member.data.member.status }, membership).includes(write)) {
    return { state: "not_offered", member: member.data, membership };
  }
  const organization = await reads.organization(organizationId);
  if (!organization.ok) return failed(organization);
  return { state: "ready", member: member.data, membership, organization: organization.data };
};

export type MemberTeamsLoad =
  | { state: "ready"; member: ManagedMember; choices: TeamChoice[]; organization: ManagedOrganization }
  /** A removed member, or a status this screen does not know: nothing else is read. */
  | { state: "not_offered"; member: ManagedMember }
  | { state: "failed"; refusal: ManagementRefusal };

/* A member's teams: the member (their teams now, and the version the write needs), then the
   organization's active teams to choose from (the content browser's Teams read, once), then the
   organization (its name is in the review). The last two are read only when the flow will be shown. */
export const loadMemberTeamsPage = async (reads: Pick<TeamReads, "member" | "activeTeams" | "organization">, organizationId: string, userId: string): Promise<MemberTeamsLoad> => {
  if (!isManagementId(organizationId) || !isManagementId(userId)) return failed(refused("invalid_id"));
  const member = await reads.member(organizationId, userId);
  if (!member.ok) return failed(member);
  if (!memberTeamsOffered(member.data.member)) return { state: "not_offered", member: member.data };
  const choices = await reads.activeTeams(organizationId);
  if (!choices.ok) return failed(choices);
  const organization = await reads.organization(organizationId);
  if (!organization.ok) return failed(organization);
  return { state: "ready", member: member.data, choices: choices.data, organization: organization.data };
};

/** What a team write flow's client state belongs to: a page that reads another team, member or version starts it again. */
export const teamFlowKey = (kind: TeamWrite, subject: { teamId?: string; member?: ManagedMember }): string =>
  [kind, subject.teamId ?? "", subject.member?.member.userId ?? "", subject.member?.version ?? ""].join(":");

/* ---------- lists that the backend cuts short ---------- */

/** Said beside a member list that is shorter than the team's count. Null when the list is whole. */
export const memberListNote = (team: ManagedTeam): string | null =>
  team.members.length < team.team.memberCount
    ? `Showing the first ${team.members.length.toLocaleString("en-US")} of ${countLabel(team.team.memberCount, "member")}. The server lists at most ${TEAM_MEMBER_LIMIT} members of a team.`
    : null;

/** Said beside a manager list that reached the backend's bound: it sends no count of managers, so there may be more. */
export const managerListNote = (team: Pick<Team, "managers">): string | null =>
  team.managers.length >= TEAM_MANAGER_LIMIT
    ? `Showing the first ${team.managers.length.toLocaleString("en-US")} managers. The server lists at most ${TEAM_MANAGER_LIMIT} and sends no count of them, so there may be more.`
    : null;

/** Said when a member's team list reached the member read's bound: the teams shown may not be all of them. */
export const memberTeamsNote = (member: Pick<Member, "teams">): string | null =>
  member.teams.length >= MEMBER_TEAMS_LIMIT
    ? `Showing the first ${member.teams.length.toLocaleString("en-US")} team memberships. The server lists at most ${MEMBER_TEAMS_LIMIT} for a member, so there may be more.`
    : null;

/* ---------- wording ---------- */

export const TEAM_WRITE_COPY: Record<TeamWrite, WriteCopy> = {
  create: { title: "Create a team", confirm: "Create team", sending: "Creating the team", danger: false },
  rename: { title: "Rename team", confirm: "Rename team", sending: "Renaming the team", danger: false },
  addMember: { title: "Add a member", confirm: "Add to team", sending: "Adding the member", danger: false },
  archive: { title: "Archive team", confirm: "Archive team", sending: "Archiving the team", danger: true },
  makeManager: { title: "Make team manager", confirm: "Make team manager", sending: "Making the member a manager", danger: false },
  removeManager: { title: "Remove as team manager", confirm: "Remove as team manager", sending: "Changing the manager setting", danger: false },
  removeMember: { title: "Remove from team", confirm: "Remove from team", sending: "Removing the member from the team", danger: true },
  memberTeams: { title: "Change teams", confirm: "Change teams", sending: "Changing the member's teams", danger: false },
};

/** What each link on the team page leads to, in a line. */
export const TEAM_WRITE_HINTS: Record<TeamOnlyWrite, string> = {
  rename: "Changes the team's name. Active team names are unique in an organization, ignoring case.",
  addMember: "Adds an active member of the organization to this team, as a plain member or, for a member with the Team Manager role, as a manager.",
  archive: "Stops the team being active. It cannot be undone, and proposals on the team keep their team.",
};

/* What an archive does and does not do (docs/API.md, "Staff team management": "Archiving a team
   changes no proposal"). Nothing is claimed here that it does not say. */
export const ARCHIVE_EFFECTS = [
  "This cannot be undone: there is no un-archive, for staff or for the customer.",
  "No proposal is changed: proposals on the team keep their team.",
  "The team's memberships are kept.",
  "The team is no longer offered for a proposal or for a member's teams.",
  "Its Team Managers lose their reach over its proposals on their next request. Owners, Admins, a proposal's owner and people a proposal is shared with keep theirs.",
  "An archived team can't be renamed, archived again or have its members changed.",
] as const;

/** What the page of an archived team says in place of any control. */
export const ARCHIVED_TEAM_NOTE = "This team is archived. An archived team can't be renamed, archived again or have its members changed, and it can't be un-archived, by staff or by the customer.";

/* The one side effect of a team change (docs/API.md, same section, "Side effects"): a Team
   Manager's reach over a team's proposals follows the team's rows on their next request. No
   session is ended, and no email or notification is sent. */
export const MANAGER_REACH = "A Team Manager's reach over this team's proposals follows the change on their next request.";
export const NO_SESSION_ENDED = "No session is ended, and no email or notification is sent.";
/** What setting a member's teams does (docs/API.md, same section, `PUT /members/:userId/teams`). */
export const MEMBER_TEAMS_EFFECTS = [
  "Manager settings are kept on teams the member stays on. A team the member joins is joined as a plain member.",
  "Memberships of archived teams are left as they are, as history.",
] as const;

/** What the form holds before the review. */
export type TeamDraft = { reason: string; name: string; target: TeamCandidate | null; makeManager: boolean; teamIds: string[] };
export const emptyTeamDraft = (teamIds: string[] = []): TeamDraft => ({ reason: "", name: "", target: null, makeManager: false, teamIds });

export type TeamDraftField = "reason" | "name" | "target" | "teams";
export type TeamDraftErrors = Partial<Record<TeamDraftField, string>>;

/** The checked values a review states and a confirmation sends. */
export type TeamRequest = { reason: string; name?: string; target?: TeamCandidate; isManager?: boolean; teamIds?: string[] };

/** What a draft is checked against: the team's name now, the member's teams now, the teams that can be chosen. */
export type TeamDraftContext = { teamName?: string; member?: Pick<Member, "teams">; choices?: TeamChoice[] };

export const checkTeamDraft = (kind: TeamWrite, draft: TeamDraft, context: TeamDraftContext = {}): { ok: true; request: TeamRequest } | { ok: false; errors: TeamDraftErrors } => {
  const errors: TeamDraftErrors = {};
  const reason = reasonOf(draft.reason);
  if (reason === null) errors.reason = REASON_RULE;
  const name = teamNameOf(draft.name);
  if (kind === "create" || kind === "rename") {
    if (name === null) errors.name = TEAM_NAME_RULE;
    else if (kind === "rename" && name === context.teamName) errors.name = "The team already has that name. Give it a different one.";
  }
  if (kind === "addMember" && (!draft.target || !isTeamCandidate(draft.target))) errors.target = "Choose the member who joins the team.";
  const teamIds = teamIdsOf(draft.teamIds);
  if (kind === "memberTeams") {
    const choices = context.choices ?? [];
    const now = context.member ? currentTeams(context.member).active.map((team) => team.id) : null;
    if (draft.teamIds.length > MEMBER_TEAMS_MAX) errors.teams = `Choose at most ${MEMBER_TEAMS_MAX} teams.`;
    else if (teamIds === null || !teamIds.every((id) => choices.some((choice) => choice.id === id))) errors.teams = "Choose only from the organization's active teams.";
    else if (now && now.length === teamIds.length && now.every((id) => teamIds.includes(id))) errors.teams = "These are the member's teams now. Choose a different set.";
  }
  if (reason === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    request: {
      reason,
      ...((kind === "create" || kind === "rename") && name !== null ? { name } : {}),
      // Only a member who holds the Team Manager role can be added as a manager.
      ...(kind === "addMember" && draft.target ? { target: draft.target, isManager: draft.makeManager && holdsTeamManagerRole(draft.target.roles) } : {}),
      ...(kind === "makeManager" ? { isManager: true } : {}),
      ...(kind === "removeManager" ? { isManager: false } : {}),
      ...(kind === "memberTeams" && teamIds !== null ? { teamIds } : {}),
    },
  };
};

const listOf = (names: string[]): string => names.join(", ");

export type TeamReviewContext = {
  organization: ManagedOrganization;
  /** The team a write is about: absent for a create and for a member's teams. */
  team?: { id: string; name: string };
  /** The member a write is about. */
  member?: Member;
  /** Whether that member manages the team now (remove). */
  isManager?: boolean;
  choices?: TeamChoice[];
};

/** The review, in plain words: who and what changes. The reason is shown beside it, as typed. */
export const teamReviewLines = (kind: TeamWrite, context: TeamReviewContext, request: TeamRequest): string[] => {
  const organization = organizationLabel(context.organization);
  const team = context.team?.name ?? "This team";
  const who = context.member ? memberLabel(context.member) : "This member";
  switch (kind) {
    case "create":
      return [`A new team named ${request.name ?? ""} is created in ${organization}.`, "It starts with no members.", "Active team names are unique in an organization, ignoring case."];
    case "rename":
      return [`The team ${team} in ${organization} is renamed to ${request.name ?? ""}.`, "Only the team's name changes. No proposal is changed."];
    case "archive":
      return [`The team ${team} in ${organization} is archived.`, ...ARCHIVE_EFFECTS];
    case "addMember":
      return [
        `${request.target ? memberLabel(request.target) : "The member you chose"} joins the team ${team} in ${organization}${request.isManager ? ", as a manager of the team" : ", as a plain member"}.`,
        ...(request.isManager ? [MANAGER_REACH] : []),
        NO_SESSION_ENDED,
      ];
    case "removeMember":
      return [
        `${who} is taken off the team ${team} in ${organization}.`,
        ...(context.isManager ? [`They are a manager of this team now. ${MANAGER_REACH}`] : []),
        `Only the membership of this team is removed. No proposal is changed. ${NO_SESSION_ENDED}`,
      ];
    case "makeManager":
      return [`${who} becomes a manager of the team ${team} in ${organization}.`, MANAGER_REACH, NO_SESSION_ENDED];
    case "removeManager":
      return [`${who} stops being a manager of the team ${team} in ${organization}, and stays on the team.`, MANAGER_REACH, NO_SESSION_ENDED];
    default: {
      const change = context.member ? teamsChange(context.member, request.teamIds ?? [], context.choices ?? []) : { joins: [], leaves: [], stays: [] };
      const archived = context.member ? currentTeams(context.member).archived.map((entry) => entry.name) : [];
      const chosen = [...change.stays, ...change.joins];
      return [
        chosen.length ? `${who} in ${organization}: their active teams become exactly ${listOf(chosen)}.` : `${who} in ${organization} is taken off every active team.`,
        ...(change.joins.length ? [`Joins: ${listOf(change.joins)}.`] : []),
        ...(change.leaves.length ? [`Leaves: ${listOf(change.leaves)}.`] : []),
        ...(change.stays.length ? [`Stays on: ${listOf(change.stays)}.`] : []),
        ...MEMBER_TEAMS_EFFECTS.slice(0, archived.length ? 2 : 1),
        ...(archived.length ? [`Archived teams this member is on, not changed: ${listOf(archived)}.`] : []),
        `${MANAGER_REACH.replace("this team's", "a team's")} ${NO_SESSION_ENDED}`,
      ];
    }
  }
};

export type TeamResultSummary = { title: string; lines: string[] };

const teamState = (team: Team, organization: string): string =>
  `${team.name} in ${organization} has ${countLabel(team.memberCount, "member")}.`;

/** What happened, from the API's own answer. No second read is made to show it. */
export const teamResultSummary = (kind: TeamWrite, context: TeamReviewContext, request: TeamRequest, answer: TeamWriteAnswer): TeamResultSummary => {
  const organization = organizationLabel(context.organization);
  if (answer.answer === "member") {
    const who = memberLabel(answer.member);
    const { active, archived } = currentTeams(answer.member);
    const names = (teams: MemberTeam[]) => listOf(teams.map((team) => `${team.name}${team.isManager ? " (manager)" : ""}`));
    const state = active.length ? `${who} in ${organization} is on: ${names(active)}.` : `${who} in ${organization} is on no active team.`;
    const history = archived.length ? [`Archived teams this member is on, not changed: ${listOf(archived.map((team) => team.name))}.`] : [];
    return answer.changed
      ? { title: "Teams changed", lines: [state, ...history] }
      : { title: "Nothing needed changing", lines: [state, ...history, "The member was already on exactly those teams. The request is still recorded on the RFPilot side."] };
  }
  const { team, members } = answer.team;
  switch (kind) {
    case "create":
      return { title: "Team created", lines: [`The team ${team.name} now exists in ${organization}, with ${countLabel(team.memberCount, "member")}.`] };
    case "rename":
      return { title: "Team renamed", lines: [`The team is now named ${team.name}, in ${organization}.`] };
    case "archive":
      return {
        title: "Team archived",
        lines: [`${team.name} in ${organization} is archived${team.archivedAt ? `, since ${formatContentDate(team.archivedAt)}` : ""}.`, "Proposals on the team keep their team. It cannot be un-archived."],
      };
    case "addMember": {
      const target = request.target;
      const row = target ? members.find((entry) => entry.member.userId === target.userId) : undefined;
      const who = row ? memberLabel(row.member) : target ? memberLabel(target) : "The member";
      return {
        title: "Member added to the team",
        lines: [
          // The answer lists at most 200 members: one who is not among them is named from the request.
          row ? `${who} is on the team ${team.name}${row.isManager ? ", as a manager" : ""}.` : `The server accepted adding ${who} to the team ${team.name}. They are not among the members it listed in its answer.`,
          teamState(team, organization),
        ],
      };
    }
    case "removeMember":
      return { title: "Member taken off the team", lines: [`${context.member ? memberLabel(context.member) : "The member"} is no longer on the team ${team.name}.`, teamState(team, organization)] };
    default: {
      const userId = context.member?.userId;
      const row = userId ? members.find((entry) => entry.member.userId === userId) : undefined;
      const who = row ? memberLabel(row.member) : context.member ? memberLabel(context.member) : "The member";
      const asked = kind === "makeManager";
      return {
        title: asked ? "Team manager set" : "Team manager unset",
        lines: [
          row
            ? `${who} ${row.isManager ? "is a manager of" : "is on the team, not as a manager:"} ${team.name}.`
            : `The server accepted the change for ${who} on the team ${team.name}. They are not among the members it listed in its answer.`,
          teamState(team, organization),
        ],
      };
    }
  }
};

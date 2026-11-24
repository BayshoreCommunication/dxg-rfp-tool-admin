// One team of a customer organization, as RFPilot staff view it (owner decision, 2026-11-24):
// the team, its managers and the members the backend lists. View only: staff do not create,
// rename or archive a team, add or remove a team member, or set a team manager, and
// app/actions/staffViewOnly.test.ts keeps those writes out.
//
// The backend route is GET /api/v1/admin/organizations/:organizationId/teams/:teamId (docs/API.md,
// "Staff team management"). The read is recorded in the staff organization's audit trail and
// never in the customer's. So nothing is cached or fetched ahead of the screen that shows it.
//
// This file is the sibling of management.ts and is pure like it: the address, the parser, the
// read the page makes and the notes beside a list the backend cut short. The ids, the refusals
// and their wording are management.ts's own.

import { parseTeams, type Team } from "@/lib/organizationContent/content";
import { countLabel } from "@/lib/plural";
import { isManagementId, MANAGEMENT_PATH, parseManagedMember, refused, type ManagedMember, type ManagementResult } from "@/lib/organizationManagement/management";

/* ---------- the address ---------- */

/* Like the member page this lives outside /organizations/[organizationId]/, the content browser
   (components/organizations/content/readOnly.test.ts). */
export const teamManagementPath = (organizationId: string, teamId: string): string =>
  `${MANAGEMENT_PATH}/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(teamId)}`;

/* ---------- reading the answers ---------- */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** The backend lists at most this many members with a team; `memberCount` is the true count. */
export const TEAM_MEMBER_LIMIT = 200;
/** And at most this many managers, with no count of them. */
export const TEAM_MANAGER_LIMIT = 200;

/** One member of a team: the member, their membership version, and whether they manage the team. */
export type TeamMember = ManagedMember & { isManager: boolean };

/** One team as the staff team routes return it, with the members listed (at most 200), and how
    many manager rows the answer held before any that could not be read was left out. */
export type ManagedTeam = { team: Team; members: TeamMember[]; managersListed: number };

/* `{ organizationId, team, members: [{ member, version, isManager }] }`: the team read. The team
   is read through the Teams list's own parser and each member through the member read's (the allowlists the view-only pages use), so a field added to
   the answer later does not reach the screen. An answer that names another organization or
   another team is never shown. A member row that cannot be read is left out: the count beside
   the list then says the list is shorter. */
export const parseManagedTeam = (data: unknown, organizationId: string, teamId: string): ManagedTeam | null => {
  const raw = record(data);
  if (!raw || raw.organizationId !== organizationId || !Array.isArray(raw.members)) return null;
  const team = parseTeams({ organizationId, teams: [raw.team] }, organizationId)?.teams[0];
  if (!team || !isManagementId(team.id) || team.id !== teamId) return null;
  const members: TeamMember[] = [];
  for (const row of raw.members) {
    const entry = record(row);
    const userId = record(entry?.member)?.userId;
    const found = entry && isManagementId(userId) ? parseManagedMember({ organizationId, member: entry.member, version: entry.version }, organizationId, userId) : null;
    if (found) members.push({ ...found, isManager: entry?.isManager === true });
  }
  const managers = record(raw.team)?.managers;
  return { team, members, managersListed: Array.isArray(managers) ? managers.length : 0 };
};

/* ---------- the read the page makes ---------- */

/** The team page: the one team, read once. Nothing is asked for an address that is not made of ids. */
export const loadTeamPage = async (reads: { team(organizationId: string, teamId: string): Promise<ManagementResult<ManagedTeam>> }, organizationId: string, teamId: string): Promise<ManagementResult<ManagedTeam>> => {
  if (!isManagementId(organizationId)) return refused("invalid_id");
  if (!isManagementId(teamId)) return refused("invalid_team_id");
  return reads.team(organizationId, teamId);
};

/* ---------- lists that the backend cuts short ---------- */

/* Said beside a member list that is shorter than the team's count. Null when the list is whole.
   `memberCount` counts every row of the team. The list can be shorter for two reasons: the
   backend's bound of 200, and rows left out (the backend leaves out a row whose user is no longer
   a member of the organization, and a row that cannot be read is dropped here). The bound is
   named only when the count is above it: at or below it, the bound is not why rows are missing. */
export const memberListNote = (team: Pick<ManagedTeam, "team" | "members">): string | null => {
  const shown = team.members.length.toLocaleString("en-US");
  const count = team.team.memberCount;
  if (team.members.length >= count) return null;
  return count <= TEAM_MEMBER_LIMIT
    ? `The server listed ${shown} of ${countLabel(count, "member")}.`
    : `Showing the first ${shown} of ${countLabel(count, "member")}. The server lists at most ${TEAM_MEMBER_LIMIT} members of a team.`;
};

/* Said beside a manager list that reached the backend's bound: it sends no count of managers, so
   there may be more. Whether the bound was reached is read off what the answer held
   (`managersListed`), not off what is left after a row that could not be read was dropped. */
export const managerListNote = (managed: Pick<ManagedTeam, "team" | "managersListed">): string | null => {
  const shown = managed.team.managers.length;
  const listed = Math.max(managed.managersListed, shown);
  if (listed < TEAM_MANAGER_LIMIT) return null;
  const more = `The server lists at most ${TEAM_MANAGER_LIMIT} and sends no count of them, so there may be more.`;
  return shown === listed
    ? `Showing the first ${shown.toLocaleString("en-US")} managers. ${more}`
    : `Showing ${shown.toLocaleString("en-US")} of the ${listed.toLocaleString("en-US")} managers the server listed. ${more}`;
};

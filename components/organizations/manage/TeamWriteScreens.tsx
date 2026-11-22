import { getManagedMemberAction, getManagedOrganizationAction, getManagedTeamAction, listActiveTeamsAction } from "@/app/actions/organizationManagement";
import { cardClass, linkClass, ManageFailureState, ManageFrame, MemberSummary, NotOfferedState } from "@/components/organizations/manage/ManageChrome";
import { TeamSummary } from "@/components/organizations/manage/TeamManagement";
import TeamWriteFlow from "@/components/organizations/manage/TeamWriteFlow";
import { organizationTeamsPath } from "@/lib/organizationContent/content";
import { isManagementId, memberLabel, memberManagementPath, organizationLabel } from "@/lib/organizationManagement/management";
import {
  ARCHIVED_TEAM_NOTE,
  loadCreateTeamPage,
  loadMemberTeamsPage,
  loadTeamMemberWritePage,
  loadTeamWritePage,
  memberTeamsPath,
  memberTeamsTooMany,
  notOnTeamNote,
  TEAM_WRITE_COPY,
  teamCreatePath,
  teamFlowKey,
  teamManagementPath,
  teamMemberWritePath,
  teamWritePath,
  type TeamMemberWrite,
  type TeamOnlyWrite,
} from "@/lib/organizationManagement/teams";
import Link from "next/link";

/* The team write pages. Each reads only what it shows, through a tested loader that decides the
   reads and skips the later ones when the flow will not be shown:
   - create: the organization (its name is in the review);
   - rename, archive, add a member: the team, then the organization;
   - remove a member, make or stop being a manager: the member (whose own teams say whether they
     are on this team and manage it), then the organization;
   - a member's teams: the member, then the organization's active teams, then the organization. */

/** Create a team. */
export async function CreateTeamScreen({ organizationId }: { organizationId: string }) {
  const load = await loadCreateTeamPage({ organization: getManagedOrganizationAction }, organizationId);
  const known = isManagementId(organizationId) ? organizationId : null;
  return (
    <ManageFrame organizationId={known} teams>
      {load.state === "failed" ? (
        <ManageFailureState refusal={load.refusal} retryHref={known ? teamCreatePath(known) : undefined} />
      ) : (
        <>
          <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-label="Organization">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#007f86]">{TEAM_WRITE_COPY.create.title}</p>
            <h1 className="mt-1 break-words text-2xl font-extrabold tracking-[-0.03em] text-[#12213a]">{organizationLabel(load.organization)}</h1>
          </section>
          {/* Keyed by the organization as read: the create page of another organization starts the flow again. */}
          <TeamWriteFlow kind="create" organization={load.organization} key={teamFlowKey("create", load.organization.id)} />
        </>
      )}
    </ManageFrame>
  );
}

/** Rename a team, archive it, or add a member to it. */
export async function TeamWriteScreen({ organizationId, teamId, write }: { organizationId: string; teamId: string; write: TeamOnlyWrite }) {
  const load = await loadTeamWritePage({ team: getManagedTeamAction, organization: getManagedOrganizationAction }, organizationId, teamId, write);
  const known = isManagementId(organizationId) ? organizationId : null;
  const knownTeam = known && isManagementId(teamId) ? teamId : undefined;
  return (
    <ManageFrame organizationId={known} teams teamId={knownTeam}>
      {load.state === "failed" ? (
        <ManageFailureState refusal={load.refusal} retryHref={known && knownTeam ? teamWritePath(known, knownTeam, write) : undefined} />
      ) : load.state === "not_offered" ? (
        <>
          <TeamSummary team={load.team.team} managersListed={load.team.managersListed} eyebrow={TEAM_WRITE_COPY[write].title} />
          <NotOfferedState title={`${TEAM_WRITE_COPY[write].title} is not available for this team`} message={ARCHIVED_TEAM_NOTE}>
            <Link href={teamManagementPath(organizationId, teamId)} prefetch={false} className={linkClass}>
              Back to this team
            </Link>
          </NotOfferedState>
        </>
      ) : (
        <>
          <TeamSummary team={load.team.team} managersListed={load.team.managersListed} eyebrow={TEAM_WRITE_COPY[write].title} />
          {/* Keyed by the team as read: a page that reads another team starts the flow again. */}
          <TeamWriteFlow kind={write} organization={load.organization} team={{ id: load.team.team.id, name: load.team.team.name }} key={teamFlowKey(write, load.organization.id, { teamId: load.team.team.id })} />
        </>
      )}
    </ManageFrame>
  );
}

/** Take a member off a team, or make them (or stop them being) its manager. */
export async function TeamMemberWriteScreen({ organizationId, teamId, userId, write }: { organizationId: string; teamId: string; userId: string; write: TeamMemberWrite }) {
  const load = await loadTeamMemberWritePage({ member: getManagedMemberAction, organization: getManagedOrganizationAction }, organizationId, teamId, userId, write);
  const known = isManagementId(organizationId) ? organizationId : null;
  const knownTeam = known && isManagementId(teamId) ? teamId : undefined;
  const knownMember = known && isManagementId(userId) ? userId : undefined;
  return (
    <ManageFrame organizationId={known} teams teamId={knownTeam} memberId={knownMember}>
      {load.state === "failed" ? (
        <ManageFailureState refusal={load.refusal} retryHref={known && knownTeam && knownMember ? teamMemberWritePath(known, knownTeam, knownMember, write) : undefined} />
      ) : load.state === "not_offered" ? (
        <>
          <MemberSummary member={load.member.member} eyebrow={TEAM_WRITE_COPY[write].title} />
          <NotOfferedState
            title={`${TEAM_WRITE_COPY[write].title} is not available for this member`}
            message={
              !load.membership
                ? notOnTeamNote(memberLabel(load.member.member), load.member.member)
                : load.membership.archived
                  ? ARCHIVED_TEAM_NOTE
                  : `${memberLabel(load.member.member)} is not in a state this change applies to on the team ${load.membership.name}. Open the team to see what can be changed.`
            }
          >
            <Link href={teamManagementPath(organizationId, teamId)} prefetch={false} className={linkClass}>
              Back to this team
            </Link>
            <Link href={memberManagementPath(organizationId, userId)} prefetch={false} className={linkClass}>
              Open this member
            </Link>
          </NotOfferedState>
        </>
      ) : (
        <>
          <MemberSummary member={load.member.member} eyebrow={`${TEAM_WRITE_COPY[write].title}: ${load.membership.name}`} />
          <TeamWriteFlow
            kind={write}
            organization={load.organization}
            team={{ id: load.membership.id, name: load.membership.name }}
            member={load.member}
            isManager={load.membership.isManager}
            key={teamFlowKey(write, load.organization.id, { teamId: load.membership.id, member: load.member })}
          />
        </>
      )}
    </ManageFrame>
  );
}

/** Which teams a member is on. */
export async function MemberTeamsScreen({ organizationId, userId }: { organizationId: string; userId: string }) {
  const load = await loadMemberTeamsPage({ member: getManagedMemberAction, activeTeams: listActiveTeamsAction, organization: getManagedOrganizationAction }, organizationId, userId);
  const known = isManagementId(organizationId) ? organizationId : null;
  const knownMember = known && isManagementId(userId) ? userId : undefined;
  return (
    <ManageFrame organizationId={known} memberId={knownMember} teams>
      {load.state === "failed" ? (
        <ManageFailureState refusal={load.refusal} retryHref={known && knownMember ? memberTeamsPath(known, knownMember) : undefined} />
      ) : load.state === "not_offered" ? (
        <>
          <MemberSummary member={load.member.member} eyebrow={TEAM_WRITE_COPY.memberTeams.title} />
          <NotOfferedState
            title="Changing teams is not available for this member"
            message={
              load.tooManyTeams
                ? memberTeamsTooMany(memberLabel(load.member.member))
                : `${memberLabel(load.member.member)} has been removed from the organization, or has a status this screen does not know. A removed member's teams can't be set.`
            }
          >
            <Link href={memberManagementPath(organizationId, userId)} prefetch={false} className={linkClass}>
              Back to this member
            </Link>
            <Link href={organizationTeamsPath(organizationId)} prefetch={false} className={linkClass}>
              Teams list
            </Link>
          </NotOfferedState>
        </>
      ) : (
        <>
          <MemberSummary member={load.member.member} eyebrow={TEAM_WRITE_COPY.memberTeams.title} />
          <TeamWriteFlow kind="memberTeams" organization={load.organization} member={load.member} choices={load.choices} choicesCut={load.choicesCut} key={teamFlowKey("memberTeams", load.organization.id, { member: load.member })} />
        </>
      )}
    </ManageFrame>
  );
}

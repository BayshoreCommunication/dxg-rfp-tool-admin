import { ContentBadge } from "@/components/organizations/content/ContentChrome";
import { cardClass, dangerLinkButton, linkButton, linkClass } from "@/components/organizations/manage/ManageChrome";
import { formatContentDate, organizationTeamsPath, personName, rolesLabel, type Team } from "@/lib/organizationContent/content";
import { isManagementId, memberManagementPath, memberStanding, memberStatusLabel } from "@/lib/organizationManagement/management";
import {
  ARCHIVED_TEAM_NOTE,
  managerListNote,
  managerNote,
  memberListNote,
  TEAM_WRITE_COPY,
  TEAM_WRITE_HINTS,
  teamMemberWritePath,
  teamMemberWritesFor,
  teamWritePath,
  teamWritesFor,
  type ManagedTeam,
} from "@/lib/organizationManagement/teams";
import { countLabel } from "@/lib/plural";
import Link from "next/link";
import type { ReactNode } from "react";

/* One team, from the one read this page makes, and the writes its state offers. Each write is a
   page of its own (form, review, confirmation); the links to them opt out of prefetch because
   each of those pages reads again when it opens. Nothing is sent from here. An archived team
   offers nothing: it says so, and that it cannot be un-archived. */

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-0.5 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
    <dt className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 sm:pt-0.5">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-[#20304b]">{children}</dd>
  </div>
);

/** The team as the API returned it: what every write on the team pages is about. */
export const TeamSummary = ({ team, eyebrow }: { team: Team; eyebrow: string }) => {
  const cut = managerListNote(team);
  return (
    <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-label="Team">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#007f86]">{eyebrow}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 break-words text-2xl font-extrabold tracking-[-0.03em] text-[#12213a]">{team.name}</h1>
        <ContentBadge tone={team.archived ? "neutral" : "good"}>{team.archived ? "Archived" : "Active"}</ContentBadge>
      </div>
      <dl className="mt-3 divide-y divide-slate-100">
        <Fact label="Members">
          <span className="tabular-nums">{countLabel(team.memberCount, "member")}</span>
        </Fact>
        <Fact label={team.managers.length === 1 ? "Manager" : "Managers"}>
          {team.managers.length ? (
            <ul>
              {team.managers.map((manager) => (
                <li key={manager.id} className="break-words">
                  {personName(manager)}
                  {manager.email ? <span className="break-all text-slate-600"> · {manager.email}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            "No manager"
          )}
          {cut ? <p className="mt-1 text-xs text-slate-600">{cut}</p> : null}
        </Fact>
        <Fact label="Created">{formatContentDate(team.createdAt)}</Fact>
        {team.archived ? <Fact label="Archived">{formatContentDate(team.archivedAt)}</Fact> : null}
      </dl>
    </section>
  );
};

export default function TeamManagement({ organizationId, managed }: { organizationId: string; managed: ManagedTeam }) {
  const { team, members } = managed;
  const writes = teamWritesFor(team);
  const cut = memberListNote(managed);
  return (
    <div className="space-y-5">
      <TeamSummary team={team} eyebrow="Manage team" />

      <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-labelledby="team-changes">
        <h2 id="team-changes" className="text-lg font-bold text-[#12213a]">
          What you can change
        </h2>
        {writes.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-slate-600" role="status">
            {ARCHIVED_TEAM_NOTE} Proposals on it keep their team.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {writes.map((write) => (
              <li key={write} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="min-w-0 text-sm leading-6 text-slate-600">{TEAM_WRITE_HINTS[write]}</p>
                <Link href={teamWritePath(organizationId, team.id, write)} prefetch={false} className={`shrink-0 ${TEAM_WRITE_COPY[write].danger ? dangerLinkButton : linkButton}`}>
                  {TEAM_WRITE_COPY[write].title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs leading-5 text-slate-600">
          Each change opens its own page with a review and a confirmation. Nothing is changed before you confirm there. Which team a proposal is on can&apos;t be changed by staff.{" "}
          <Link href={organizationTeamsPath(organizationId)} prefetch={false} className={linkClass}>
            Back to the Teams list
          </Link>
        </p>
      </section>

      <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-labelledby="team-members">
        <h2 id="team-members" className="text-lg font-bold text-[#12213a]">
          Members of this team
        </h2>
        <p className="mt-1 text-sm text-slate-600" role="status">
          <span className="tabular-nums">{countLabel(team.memberCount, "member")}</span>
          {cut ? `. ${cut}` : "."}
        </p>
        {members.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">{team.memberCount === 0 ? "Nobody is on this team." : "The server listed no member of this team."}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {members.map(({ member, isManager }) => {
              const rowWrites = teamMemberWritesFor({ isManager, roles: member.roles, status: member.status }, team);
              const why = team.archived ? null : managerNote({ isManager, roles: member.roles, status: member.status });
              const standing = memberStanding(member.status);
              return (
                <li key={member.userId} className="flex flex-col gap-2 py-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                  <div className="min-w-0 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-bold text-[#20304b]">{member.name ?? member.email ?? "Member with no name on file"}</span>
                      {isManager ? <ContentBadge tone="good">Manager of this team</ContentBadge> : null}
                      {standing === "active" ? null : <ContentBadge tone="neutral">{memberStatusLabel(member.status)}</ContentBadge>}
                    </p>
                    {member.name && member.email ? <p className="break-all text-slate-600">{member.email}</p> : null}
                    <p className="text-slate-600">{rolesLabel(member.roles)}</p>
                    {why ? <p className="text-xs text-slate-600">{why}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {rowWrites.map((write) => (
                      <Link
                        key={write}
                        href={teamMemberWritePath(organizationId, team.id, member.userId, write)}
                        prefetch={false}
                        aria-label={`${TEAM_WRITE_COPY[write].title}: ${member.name ?? member.email ?? "this member"}`}
                        className={`shrink-0 ${TEAM_WRITE_COPY[write].danger ? dangerLinkButton : linkButton}`}
                      >
                        {TEAM_WRITE_COPY[write].title}
                      </Link>
                    ))}
                    {isManagementId(member.userId) ? (
                      <Link href={memberManagementPath(organizationId, member.userId)} prefetch={false} aria-label={`Open ${member.name ?? member.email ?? "this member"}`} className={linkClass}>
                        Open member
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

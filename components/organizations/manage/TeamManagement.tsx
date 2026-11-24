import { ContentBadge } from "@/components/organizations/content/ContentChrome";
import { cardClass, linkClass } from "@/components/organizations/manage/ManageChrome";
import { formatContentDate, organizationTeamsPath, personName, rolesLabel, type Team } from "@/lib/organizationContent/content";
import { isManagementId, memberManagementPath, memberStanding, memberStatusLabel } from "@/lib/organizationManagement/management";
import { managerListNote, memberListNote, type ManagedTeam } from "@/lib/organizationManagement/teams";
import { countLabel } from "@/lib/plural";
import Link from "next/link";
import type { ReactNode } from "react";

/* One team, from the one read this page makes: the team, its managers and the members the
   backend lists. View only (owner decision, 2026-11-24): staff change nothing about a team, so
   there is no control here and nothing is sent. */

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-0.5 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
    <dt className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 sm:pt-0.5">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-[#20304b]">{children}</dd>
  </div>
);

/** The team as the API returned it. */
export const TeamSummary = ({ team, managersListed, eyebrow }: { team: Team; managersListed: number; eyebrow: string }) => {
  const cut = managerListNote({ team, managersListed });
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
  const cut = memberListNote(managed);
  return (
    <div className="space-y-5">
      <TeamSummary team={team} managersListed={managed.managersListed} eyebrow="Team" />

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
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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

      <p className="text-sm">
        <Link href={organizationTeamsPath(organizationId)} prefetch={false} className={linkClass}>
          Back to the Teams list
        </Link>
      </p>
    </div>
  );
}

import { countLabel } from "@/lib/plural";
import { formatContentDate, personName, type TeamsList as Teams } from "@/lib/organizationContent/content";
import { isManagementId } from "@/lib/organizationManagement/management";
import { teamManagementPath } from "@/lib/organizationManagement/teams";
import { UsersRound } from "lucide-react";
import Link from "next/link";
import { ContentBadge, ContentCard, EmptyState, focusRing } from "./ContentChrome";

const staffLink = `inline-flex min-h-11 items-center text-sm font-bold text-[#007f86] underline-offset-2 hover:underline dark:text-cyan-300 ${focusRing}`;

/** The organization's teams, active first. View only: the one link per team leads to the team's
    own page, also view only, which is outside this browser and reads the team when it opens. */
export default function TeamsList({ organizationId, data }: { organizationId: string; data: Teams }) {
  const { teams } = data;
  return (
    <ContentCard
      icon={UsersRound}
      title="Teams"
      count={`${teams.length.toLocaleString("en-US")} total`}
      description="This organization's teams, active first, with who manages each."
    >
      {teams.length === 0 ? (
        <EmptyState icon={UsersRound} title="No teams yet" message="This organization has not created a team." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {teams.map((team) => (
            <li key={team.id} className="grid gap-2 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.6fr)] lg:items-center lg:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-bold text-[#20304b]">{team.name}</p>
                  <ContentBadge tone={team.archived ? "neutral" : "good"}>{team.archived ? "Archived" : "Active"}</ContentBadge>
                </div>
                <p className="text-xs tabular-nums text-slate-600">{countLabel(team.memberCount, "member")}</p>
              </div>
              <div className="min-w-0 text-[13px] text-slate-600">
                <p className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">{team.managers.length === 1 ? "Manager" : "Managers"}</p>
                {team.managers.length ? (
                  <ul>
                    {team.managers.map((manager) => (
                      <li key={manager.id} className="break-words">
                        {personName(manager)}
                        {manager.email ? <span className="break-all text-slate-500"> · {manager.email}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No manager</p>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Created {formatContentDate(team.createdAt)}
                {team.archived && team.archivedAt ? ` · archived ${formatContentDate(team.archivedAt)}` : ""}
              </p>
              {isManagementId(team.id) ? (
                <p className="min-w-0">
                  <Link href={teamManagementPath(organizationId, team.id)} prefetch={false} aria-label={`View ${team.name}`} className={staffLink}>
                    View
                  </Link>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ContentCard>
  );
}

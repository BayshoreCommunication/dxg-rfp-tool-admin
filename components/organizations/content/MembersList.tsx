import { countLabel } from "@/lib/plural";
import {
  formatContentDate,
  memberStatusBadge,
  organizationMembersPath,
  pageRange,
  personName,
  roleLabel,
  rolesLabel,
  withQuery,
  type MembersPage,
} from "@/lib/organizationContent/content";
import { MailPlus, Users } from "lucide-react";
import { ContentBadge, ContentCard, EmptyState, Pager } from "./ContentChrome";

const cell = "min-w-0 break-words text-[13px] text-slate-600";
const label = "text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 lg:hidden";

/** Everyone in the organization, every status, oldest first; then the invitations still pending. View only. */
export default function MembersList({ organizationId, page }: { organizationId: string; page: MembersPage }) {
  const { members, pagination, pendingInvitations, pendingInvitationsTotal } = page;
  const range = pageRange(pagination, members.length);
  return (
    <div className="space-y-5">
      <ContentCard
        icon={Users}
        title="Members"
        count={`${pagination.total.toLocaleString("en-US")} total`}
        description="Everyone in this organization, active or not, in the order they joined."
      >
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members found" message="This organization has no members on this page." />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-slate-100 bg-[#f8fafc] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 lg:grid" aria-hidden="true">
              <span>Member</span>
              <span>Roles</span>
              <span>Teams</span>
              <span>Joined</span>
              <span>Last sign-in</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {members.map((member) => {
                const status = memberStatusBadge(member.status);
                return (
                  <li
                    key={member.userId}
                    className="grid gap-2 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words text-sm font-bold text-[#20304b]">{personName(member)}</p>
                        <ContentBadge tone={status.tone}>{status.label}</ContentBadge>
                      </div>
                      {member.email ? <p className="break-all text-xs text-slate-600">{member.email}</p> : null}
                    </div>
                    <p className={cell}>
                      <span className={label}>Roles: </span>
                      {rolesLabel(member.roles)}
                    </p>
                    <p className={cell}>
                      <span className={label}>Teams: </span>
                      {member.teams.length
                        ? member.teams
                            .map((team) => `${team.name}${team.isManager ? " (manager)" : ""}${team.archived ? " (archived)" : ""}`)
                            .join(", ")
                        : "No team"}
                    </p>
                    <p className={cell}>
                      <span className={label}>Joined: </span>
                      {formatContentDate(member.joinedAt)}
                    </p>
                    <p className={cell}>
                      <span className={label}>Last sign-in: </span>
                      {member.lastSignedInAt ? formatContentDate(member.lastSignedInAt) : "Never"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <Pager
          pagination={pagination}
          summary={`Showing ${range.start.toLocaleString("en-US")}–${range.end.toLocaleString("en-US")} of ${countLabel(pagination.total, "member")}`}
          label="Member pagination"
          hrefFor={(next) => withQuery(organizationMembersPath(organizationId), { page: next })}
        />
      </ContentCard>

      <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold text-[#12213a]">Pending invitations</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {pendingInvitationsTotal.toLocaleString("en-US")} total
          </span>
        </div>
        {pendingInvitations.length === 0 ? (
          <EmptyState icon={MailPlus} title="No pending invitations" message="Nobody is waiting to join this organization." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-col gap-1 px-5 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                  <p className="min-w-0 break-all text-sm font-semibold text-[#20304b]">{invitation.email}</p>
                  <p className="text-xs text-slate-600">
                    {roleLabel(invitation.role)} · invited {formatContentDate(invitation.createdAt)} · expires {formatContentDate(invitation.expiresAt)}
                  </p>
                </li>
              ))}
            </ul>
            {pendingInvitationsTotal > pendingInvitations.length ? (
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600 sm:px-6">
                Showing the newest {countLabel(pendingInvitations.length, "invitation")} of {pendingInvitationsTotal.toLocaleString("en-US")}.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

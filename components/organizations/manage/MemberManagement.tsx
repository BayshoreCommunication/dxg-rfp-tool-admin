import { cardClass, dangerLinkButton, linkButton, linkClass, MemberSummary } from "@/components/organizations/manage/ManageChrome";
import { organizationMembersPath } from "@/lib/organizationContent/content";
import {
  isOwnerMember,
  memberStanding,
  memberWritePath,
  memberWritesFor,
  WRITE_COPY,
  type ManagedMember,
  type MemberWrite,
} from "@/lib/organizationManagement/management";
import Link from "next/link";

/* One member, from the one read this page makes, and the writes that member's state offers. Each
   write is a page of its own (form, review, confirmation); the links to them opt out of prefetch
   because each of those pages reads the member again when it opens. Nothing is sent from here. */

const HINTS: Record<MemberWrite, string> = {
  role: "Admin, Team Manager, Planner or Viewer. The Owner role only moves by a transfer.",
  deactivate: "Signs the member out everywhere and closes their sign-in until they are reactivated. A member who owns proposals must have them reassigned first.",
  reactivate: "Lets the member sign in again, with the role they had.",
  reassign: "Moves every proposal this member owns to another active member who isn't a Viewer.",
  transfer: "Makes this member the Owner. The current Owner becomes an Admin.",
};

/** Why a write that staff might look for is not offered. */
const absentNotes = (member: ManagedMember["member"]): string[] => {
  const standing = memberStanding(member.status);
  const notes: string[] = [];
  if (isOwnerMember(member)) {
    notes.push("This member is the Owner. The Owner's role is never changed and the Owner is never deactivated directly: transfer ownership to another active member, from that member's page.");
  }
  if (standing === "removed") notes.push("This member has been removed from the organization, so nothing about them can be changed.");
  if (standing === "invited") notes.push("This member has not joined yet, so they can't be deactivated, receive ownership or have proposals reassigned.");
  if (standing === "deactivated" && !isOwnerMember(member)) notes.push("A deactivated member can't receive ownership. Reactivate them first.");
  if (standing === "other") notes.push("This member's status is not one this screen knows, so no change is offered.");
  return notes;
};

export default function MemberManagement({ organizationId, managed }: { organizationId: string; managed: ManagedMember }) {
  const { member } = managed;
  const writes = memberWritesFor(member);
  const notes = absentNotes(member);
  return (
    <div className="space-y-5">
      <MemberSummary member={member} eyebrow="Manage member" />

      <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-labelledby="member-changes">
        <h2 id="member-changes" className="text-lg font-bold text-[#12213a]">
          What you can change
        </h2>
        {writes.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-slate-600" role="status">
            Nothing can be changed for this member as they are now.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {writes.map((write) => (
              <li key={write} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="min-w-0 text-sm leading-6 text-slate-600">{HINTS[write]}</p>
                <Link
                  href={memberWritePath(organizationId, member.userId, write)}
                  prefetch={false}
                  className={`shrink-0 ${WRITE_COPY[write].danger ? dangerLinkButton : linkButton}`}
                >
                  {WRITE_COPY[write].title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {notes.length ? (
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-slate-600">
          Each change opens its own page with a review and a confirmation. Nothing is changed before you confirm there.{" "}
          <Link href={organizationMembersPath(organizationId)} prefetch={false} className={linkClass}>
            Back to the Members list
          </Link>
        </p>
      </section>
    </div>
  );
}

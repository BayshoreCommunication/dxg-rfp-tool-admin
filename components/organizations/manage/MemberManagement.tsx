import { linkClass, MemberSummary } from "@/components/organizations/manage/ManageChrome";
import { organizationMembersPath } from "@/lib/organizationContent/content";
import type { ManagedMember } from "@/lib/organizationManagement/management";
import Link from "next/link";

/* One member, from the one read this page makes. View only (owner decision, 2026-11-24): staff
   change nothing about a member, so there is no control here and nothing is sent. */
export default function MemberManagement({ organizationId, managed }: { organizationId: string; managed: ManagedMember }) {
  return (
    <div className="space-y-5">
      <MemberSummary member={managed.member} eyebrow="Member" />
      <p className="text-sm">
        <Link href={organizationMembersPath(organizationId)} prefetch={false} className={linkClass}>
          Back to the Members list
        </Link>
      </p>
    </div>
  );
}

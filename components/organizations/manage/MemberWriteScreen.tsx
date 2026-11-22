import { getManagedMemberAction, getManagedOrganizationAction } from "@/app/actions/organizationManagement";
import { linkClass, ManageFailureState, ManageFrame, MemberSummary, NotOfferedState } from "@/components/organizations/manage/ManageChrome";
import WriteFlow from "@/components/organizations/manage/WriteFlow";
import {
  isManagementId,
  loadMemberWritePage,
  memberLabel,
  memberManagementPath,
  memberWritePath,
  WRITE_COPY,
  type MemberWrite,
} from "@/lib/organizationManagement/management";
import Link from "next/link";

/* One member write page: the member (who changes, and the version the write needs), then the
   organization (its name is in the review and is what a transfer asks staff to type; its Owner is
   who a transfer makes an Admin). Both are shown, and nothing else is read: the loader decides
   the reads, and skips the organization when the flow will not be shown. */
export default async function MemberWriteScreen({
  organizationId,
  userId,
  write,
  continueToDeactivate = false,
}: {
  organizationId: string;
  userId: string;
  write: MemberWrite;
  continueToDeactivate?: boolean;
}) {
  const load = await loadMemberWritePage({ member: getManagedMemberAction, organization: getManagedOrganizationAction }, organizationId, userId, write);
  const knownOrganization = isManagementId(organizationId) ? organizationId : null;
  const knownMember = knownOrganization && isManagementId(userId) ? userId : undefined;

  return (
    <ManageFrame organizationId={knownOrganization} memberId={knownMember}>
      {load.state === "failed" ? (
        <ManageFailureState refusal={load.refusal} retryHref={knownOrganization && knownMember ? memberWritePath(knownOrganization, knownMember, write) : undefined} />
      ) : load.state === "not_offered" ? (
        <>
          <MemberSummary member={load.member.member} eyebrow={WRITE_COPY[write].title} />
          <NotOfferedState
            title={`${WRITE_COPY[write].title} is not available for this member`}
            message={`${memberLabel(load.member.member)} is not in a state this change applies to. Open the member to see what can be changed.`}
          >
            <Link href={memberManagementPath(organizationId, userId)} prefetch={false} className={linkClass}>
              Back to this member
            </Link>
          </NotOfferedState>
        </>
      ) : (
        <>
          <MemberSummary member={load.member.member} eyebrow={WRITE_COPY[write].title} />
          <WriteFlow kind={write} organization={load.organization} member={load.member} continueToDeactivate={continueToDeactivate} />
        </>
      )}
    </ManageFrame>
  );
}

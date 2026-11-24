import { getManagedMemberAction } from "@/app/actions/organizationManagement";
import { ManageFailureState, ManageFrame } from "@/components/organizations/manage/ManageChrome";
import MemberManagement from "@/components/organizations/manage/MemberManagement";
import { isManagementId, loadMemberPage, memberManagementPath } from "@/lib/organizationManagement/management";

export const metadata = { title: "Member" };
// The member read is recorded on the RFPilot side: the page is rendered for every request, links
// into it opt out of prefetching, and it asks the backend for nothing but the member it shows.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; userId: string }> };

export default async function ManageMemberPage({ params }: Props) {
  const { organizationId, userId } = await params;
  const result = await loadMemberPage({ member: getManagedMemberAction }, organizationId, userId);
  const known = isManagementId(organizationId) ? organizationId : null;

  return (
    <ManageFrame organizationId={known} viewOnly>
      {result.ok ? (
        <MemberManagement organizationId={organizationId} managed={result.data} />
      ) : (
        <ManageFailureState viewOnly refusal={result} retryHref={known && isManagementId(userId) ? memberManagementPath(known, userId) : undefined} />
      )}
    </ManageFrame>
  );
}

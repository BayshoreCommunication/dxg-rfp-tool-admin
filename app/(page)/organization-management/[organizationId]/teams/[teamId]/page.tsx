import { getManagedTeamAction } from "@/app/actions/organizationManagement";
import { ManageFailureState, ManageFrame } from "@/components/organizations/manage/ManageChrome";
import TeamManagement from "@/components/organizations/manage/TeamManagement";
import { isManagementId } from "@/lib/organizationManagement/management";
import { loadTeamPage, teamManagementPath } from "@/lib/organizationManagement/teams";

export const metadata = { title: "Team" };
// The team read is recorded on the RFPilot side: the page is rendered for every request, links
// into it opt out of prefetching, and it asks the backend for nothing but the team it shows.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; teamId: string }> };

export default async function ManageTeamPage({ params }: Props) {
  const { organizationId, teamId } = await params;
  const result = await loadTeamPage({ team: getManagedTeamAction }, organizationId, teamId);
  const known = isManagementId(organizationId) ? organizationId : null;

  return (
    <ManageFrame organizationId={known} teams viewOnly>
      {result.ok ? (
        <TeamManagement organizationId={organizationId} managed={result.data} />
      ) : (
        <ManageFailureState viewOnly refusal={result} retryHref={known && isManagementId(teamId) ? teamManagementPath(known, teamId) : undefined} />
      )}
    </ManageFrame>
  );
}

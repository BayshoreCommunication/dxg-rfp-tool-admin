import { TeamMemberWriteScreen } from "@/components/organizations/manage/TeamWriteScreens";

export const metadata = { title: "Make team manager" };
// Rendered for every request: the reads it makes are recorded.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; teamId: string; userId: string }> };

export default async function MakeTeamManagerPage({ params }: Props) {
  const { organizationId, teamId, userId } = await params;
  return <TeamMemberWriteScreen organizationId={organizationId} teamId={teamId} userId={userId} write="makeManager" />;
}

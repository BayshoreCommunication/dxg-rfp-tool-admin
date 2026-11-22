import { TeamWriteScreen } from "@/components/organizations/manage/TeamWriteScreens";

export const metadata = { title: "Archive team" };
// Rendered for every request: the reads it makes are recorded.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; teamId: string }> };

export default async function ArchiveTeamPage({ params }: Props) {
  const { organizationId, teamId } = await params;
  return <TeamWriteScreen organizationId={organizationId} teamId={teamId} write="archive" />;
}

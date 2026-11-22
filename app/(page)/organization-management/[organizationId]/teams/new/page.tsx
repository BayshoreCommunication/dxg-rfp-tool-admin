import { CreateTeamScreen } from "@/components/organizations/manage/TeamWriteScreens";

export const metadata = { title: "Create a team" };
// Rendered for every request: the reads it makes are recorded.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string }> };

export default async function CreateTeamPage({ params }: Props) {
  const { organizationId } = await params;
  return <CreateTeamScreen organizationId={organizationId} />;
}

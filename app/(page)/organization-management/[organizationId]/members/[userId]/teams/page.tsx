import { MemberTeamsScreen } from "@/components/organizations/manage/TeamWriteScreens";

export const metadata = { title: "Change teams" };
// Rendered for every request: the reads it makes are recorded.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; userId: string }> };

export default async function MemberTeamsPage({ params }: Props) {
  const { organizationId, userId } = await params;
  return <MemberTeamsScreen organizationId={organizationId} userId={userId} />;
}

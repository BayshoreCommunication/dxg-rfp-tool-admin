import MemberWriteScreen from "@/components/organizations/manage/MemberWriteScreen";

export const metadata = { title: "Deactivate member" };
// Rendered for every request: the reads it makes are recorded, and the version must be current.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string; userId: string }> };

export default async function DeactivateMemberPage({ params }: Props) {
  const { organizationId, userId } = await params;
  return <MemberWriteScreen organizationId={organizationId} userId={userId} write="deactivate" />;
}

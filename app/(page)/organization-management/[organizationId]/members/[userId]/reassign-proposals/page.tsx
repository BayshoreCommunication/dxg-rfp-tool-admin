import MemberWriteScreen from "@/components/organizations/manage/MemberWriteScreen";

export const metadata = { title: "Reassign proposals" };
// Rendered for every request: the reads it makes are recorded.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ organizationId: string; userId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReassignMemberProposalsPage({ params, searchParams }: Props) {
  const { organizationId, userId } = await params;
  // Opened from a deactivation the API refused: the result then leads back to it. Nothing else is read from the address.
  const continueToDeactivate = (await searchParams)?.then === "deactivate";
  return <MemberWriteScreen organizationId={organizationId} userId={userId} write="reassign" continueToDeactivate={continueToDeactivate} />;
}

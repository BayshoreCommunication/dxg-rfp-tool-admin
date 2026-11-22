import OrganizationWriteScreen from "@/components/organizations/manage/OrganizationWriteScreen";

export const metadata = { title: "Reactivate organization" };
// Rendered for every request: the organization read it makes is recorded.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ organizationId: string }> };

export default async function ReactivateOrganizationPage({ params }: Props) {
  const { organizationId } = await params;
  return <OrganizationWriteScreen organizationId={organizationId} write="unblock" />;
}

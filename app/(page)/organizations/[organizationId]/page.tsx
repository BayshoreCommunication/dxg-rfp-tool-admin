import { getOrganizationAccountAction, getOrganizationPlanAction } from "@/app/actions/organizationPlans";
import OrganizationAccount from "@/components/organizations/OrganizationAccount";
import { BackToOrganizations, OrganizationAccountFailureState } from "@/components/organizations/OrganizationAccountStates";
import { isOrganizationId } from "@/lib/organizationAccount";

export const metadata = { title: "Organization" };
// Each view is recorded in the staff audit trail, so the page is rendered for every request
// and links into it opt out of prefetching.
export const dynamic = "force-dynamic";

type OrganizationPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const { organizationId } = await params;
  const response = await getOrganizationAccountAction(organizationId);
  // "Change plan" needs the plan table, which only the plan routes carry. Asked for only once
  // the organization is on screen and has a plan to change; without it the button is left out.
  const plans =
    response.ok && !response.data.plan.exempt ? await getOrganizationPlanAction(response.data.organization.id) : null;

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <BackToOrganizations />
      {response.ok ? (
        <OrganizationAccount account={response.data} plans={plans?.ok ? plans.data.plans : null} />
      ) : (
        <OrganizationAccountFailureState
          failure={response.failure}
          organizationId={isOrganizationId(organizationId) ? organizationId : undefined}
        />
      )}
    </div>
  );
}

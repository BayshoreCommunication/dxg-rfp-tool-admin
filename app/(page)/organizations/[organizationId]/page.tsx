import { getOrganizationAccountAction, getOrganizationPlanAction } from "@/app/actions/organizationPlans";
import OrganizationAccount from "@/components/organizations/OrganizationAccount";
import { BackToOrganizations, OrganizationAccountFailureState } from "@/components/organizations/OrganizationAccountStates";
import { isOrganizationId, loadOrganizationPage } from "@/lib/organizationAccount";

export const metadata = { title: "Organization" };
// Each view is recorded in the staff audit trail, so the page is rendered for every request
// and links into it opt out of prefetching. A plan change made from this page re-renders it:
// the action's revalidation and the button's own refresh can each cause one, so a change
// writes up to two further read events.
export const dynamic = "force-dynamic";

type OrganizationPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const { organizationId } = await params;
  // The account once, then the plan table only if "Change plan" can be offered.
  const { account, plans } = await loadOrganizationPage(organizationId, {
    account: getOrganizationAccountAction,
    planTable: getOrganizationPlanAction,
  });

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <BackToOrganizations />
      {account.ok ? (
        <OrganizationAccount account={account.data} plans={plans} />
      ) : (
        <OrganizationAccountFailureState
          failure={account.failure}
          organizationId={isOrganizationId(organizationId) ? organizationId : undefined}
        />
      )}
    </div>
  );
}

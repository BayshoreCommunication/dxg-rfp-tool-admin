import { BackToOrganizations, OrganizationAccountSkeleton } from "@/components/organizations/OrganizationAccountStates";

export default function LoadingOrganizationPage() {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <BackToOrganizations />
      <OrganizationAccountSkeleton />
    </div>
  );
}

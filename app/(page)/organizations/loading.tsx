import { OrganizationsDirectorySkeleton } from "@/components/organizations/OrganizationsDirectory";
import TopHeader from "@/components/organizations/TopHeader";

export default function LoadingOrganizationsPage() {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6 lg:grid lg:h-[calc(100dvh-48px)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
      <TopHeader />
      <OrganizationsDirectorySkeleton />
    </div>
  );
}

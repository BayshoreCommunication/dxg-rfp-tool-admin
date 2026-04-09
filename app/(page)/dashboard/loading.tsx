import TopHeader from "@/components/dashboard/TopHeader";
import { TopCardItemSkeleton } from "@/components/dashboard/TopCardItem";
import { RecentClientsSkeleton } from "@/components/dashboard/RecentClients";

export default function LoadingDashboardPage() {
  return (
    <div className="space-y-8 px-6">
      <TopHeader />
      <TopCardItemSkeleton />
      <RecentClientsSkeleton />
    </div>
  );
}

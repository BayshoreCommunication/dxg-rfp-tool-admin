import TopHeader from "@/components/dashboard/TopHeader";
import { TopCardItemSkeleton } from "@/components/dashboard/TopCardItem";
import { RecentClientsSkeleton } from "@/components/dashboard/RecentClients";

export default function LoadingDashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <TopHeader />
      <TopCardItemSkeleton />
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.92fr)]">
        <RecentClientsSkeleton />
        <div className="min-h-[580px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

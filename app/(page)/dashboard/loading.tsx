import TopHeader from "@/components/dashboard/TopHeader";
import { TopCardItemSkeleton } from "@/components/dashboard/TopCardItem";

export default function LoadingDashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <TopHeader />
      <TopCardItemSkeleton />
      <div className="min-h-[480px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

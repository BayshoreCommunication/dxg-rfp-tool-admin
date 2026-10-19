import {
  SupportHeaderSkeleton,
  SupportInboxSkeleton,
  SupportMetricsSkeleton,
} from "@/components/support/SupportSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <SupportHeaderSkeleton />
      <SupportMetricsSkeleton />
      <SupportInboxSkeleton />
    </div>
  );
}

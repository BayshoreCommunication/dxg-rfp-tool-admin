import { SupportThreadSkeleton } from "@/components/support/SupportSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <div className="h-4 w-28 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/40" aria-hidden="true" />
      <SupportThreadSkeleton />
    </div>
  );
}

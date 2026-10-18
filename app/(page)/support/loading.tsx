import { SupportInboxSkeleton } from "@/components/support/SupportInbox";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <div className="h-16 w-80 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <SupportInboxSkeleton />
    </div>
  );
}

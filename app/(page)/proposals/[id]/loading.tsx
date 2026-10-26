export default function LoadingProposalPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6" aria-busy="true" aria-label="Loading proposal">
      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-44 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
      <div className="h-72 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
    </div>
  );
}

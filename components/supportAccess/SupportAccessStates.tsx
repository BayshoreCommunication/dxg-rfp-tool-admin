import { SUPPORT_ACCESS_PATH } from "@/lib/supportAccess/grants";
import { AlertCircle, FileQuestion } from "lucide-react";
import Link from "next/link";

type StateProps = { backHref?: string; backLabel?: string };

/** An RFP the grants don't cover, or one that isn't in that organization. Nothing about it is shown. */
export const RfpNotFound = ({ backHref = SUPPORT_ACCESS_PATH, backLabel = "Back to Granted to me" }: StateProps) => (
  <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
      <FileQuestion className="h-6 w-6" aria-hidden="true" />
    </span>
    <p className="mt-4 text-sm font-bold text-[#12213a]">RFP not found</p>
    <p className="mt-1 text-sm text-slate-500">
      Support access doesn&apos;t cover this RFP, or it no longer exists. You can open only the RFPs an organization has granted.
    </p>
    <Link href={backHref} prefetch={false} className="mt-4 text-sm font-semibold text-[#008f96] hover:underline">
      {backLabel}
    </Link>
  </div>
);

export const SupportAccessError = ({
  message,
  backHref = SUPPORT_ACCESS_PATH,
  backLabel = "Back to Granted to me",
}: StateProps & { message: string }) => (
  <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
      <AlertCircle className="h-6 w-6" aria-hidden="true" />
    </span>
    <p className="mt-4 text-sm font-bold text-rose-700">Unable to load support access</p>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
    <Link href={backHref} prefetch={false} className="mt-4 text-sm font-semibold text-[#008f96] hover:underline">
      {backLabel}
    </Link>
  </div>
);

export const SupportAccessSkeleton = ({ label }: { label: string }) => (
  <div className="mx-auto w-full max-w-[1540px] space-y-6" aria-busy="true" aria-label={label}>
    <div className="h-16 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
    <div className="h-72 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
  </div>
);

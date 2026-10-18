import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import AdminPageHeader from "@/components/layout/AdminPageHeader";
import CannedRepliesManager from "@/components/support/CannedRepliesManager";
import { listCannedRepliesAction } from "@/app/actions/supportDesk";

export const metadata = { title: "Canned replies" };

export default async function CannedRepliesPage() {
  const result = await listCannedRepliesAction();
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <AdminPageHeader
        eyebrow="Helpdesk"
        title="Canned replies"
        description="Reusable answers agents can drop into a reply with one click."
        icon={MessageSquareText}
        actions={
          <Link
            href="/support"
            className="inline-flex items-center rounded-xl border border-[#dce5ee] bg-white px-3.5 py-2 text-sm font-semibold text-[#12213a] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-[#00aeb5] hover:text-[#007f86]"
          >
            Back to inbox
          </Link>
        }
      />
      {result.ok ? (
        <CannedRepliesManager initialReplies={result.data} />
      ) : (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {result.error}
        </p>
      )}
    </div>
  );
}

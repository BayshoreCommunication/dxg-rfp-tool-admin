import { AlertCircle, ArrowLeft, LifeBuoy } from "lucide-react";
import Link from "next/link";
import AdminPageHeader from "@/components/layout/AdminPageHeader";
import {
  getSupportTicketAction,
  listCannedRepliesAction,
  listSupportAgentsAction,
} from "@/app/actions/supportDesk";
import SupportTicketWorkspace from "./SupportTicketWorkspace";

export default async function SupportTicketDetail({
  ticketId,
  currentUserId,
}: {
  ticketId: string;
  currentUserId: string;
}) {
  const [detail, agents, canned] = await Promise.all([
    getSupportTicketAction(ticketId),
    listSupportAgentsAction(),
    listCannedRepliesAction(),
  ]);

  if (!detail.ok) {
    return (
      <>
        <AdminPageHeader
          eyebrow="Helpdesk"
          title="Support ticket"
          description="The conversation you asked for is not available."
          icon={LifeBuoy}
        />
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#dce5ee] bg-white px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-rose-700">This ticket could not be loaded</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">{detail.error}</p>
          <Link href="/support" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#007f86] hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to inbox
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <Link href="/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#007f86] hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to inbox
        </Link>
      </div>
      <SupportTicketWorkspace
        ticket={detail.data.ticket}
        requester={detail.data.requester}
        assignee={detail.data.assignee}
        messages={detail.data.messages}
        agents={agents.ok ? agents.data : []}
        cannedReplies={canned.ok ? canned.data : []}
        currentUserId={currentUserId}
      />
    </>
  );
}

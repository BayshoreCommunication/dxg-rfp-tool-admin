import SupportTicketDetail from "@/components/support/SupportTicketDetail";
import { auth } from "@/auth";

export const metadata = { title: "Support ticket" };

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const session = await auth();
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <SupportTicketDetail ticketId={ticketId} currentUserId={String(session?.user?.id ?? "")} />
    </div>
  );
}

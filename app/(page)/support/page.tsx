import { LifeBuoy } from "lucide-react";
import Link from "next/link";
import AdminPageHeader from "@/components/layout/AdminPageHeader";
import SupportInbox from "@/components/support/SupportInbox";
import SupportMetricsCards from "@/components/support/SupportMetricsCards";
import { auth } from "@/auth";

export const metadata = { title: "Support inbox" };

type SupportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const single = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const params = (await searchParams) ?? {};
  const session = await auth();
  const page = Number.parseInt(single(params.page) || "1", 10);
  const filters = {
    status: single(params.status),
    assignee: single(params.assignee),
    priority: single(params.priority),
    category: single(params.category),
    search: single(params.search),
    page: Number.isNaN(page) || page < 1 ? 1 : page,
  };

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <AdminPageHeader
        eyebrow="Helpdesk"
        title="Support inbox"
        description="Every question planners send from RFPilot, triaged, assigned, and answered from one place."
        icon={LifeBuoy}
        actions={
          <Link
            href="/support/canned-replies"
            className="inline-flex items-center rounded-xl border border-[#dce5ee] bg-white px-3.5 py-2 text-sm font-semibold text-[#12213a] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-[#00aeb5] hover:text-[#007f86]"
          >
            Canned replies
          </Link>
        }
      />
      <SupportMetricsCards />
      <SupportInbox filters={filters} currentUserId={String(session?.user?.id ?? "")} />
    </div>
  );
}

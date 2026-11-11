import GrantsList from "@/components/supportAccess/GrantsList";
import SupportAccessHeader from "@/components/supportAccess/SupportAccessHeader";
import { isAccessNotice } from "@/lib/supportAccess/grants";

export const metadata = { title: "Support access" };
export const dynamic = "force-dynamic";

type SupportAccessPageProps = {
  searchParams?: Promise<{ notice?: string }>;
};

export default async function SupportAccessPage({ searchParams }: SupportAccessPageProps) {
  const params = await searchParams;
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <SupportAccessHeader />
      <GrantsList notice={isAccessNotice(params?.notice) ? params.notice : undefined} />
    </div>
  );
}

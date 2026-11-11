import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listGrantedRfpsAction } from "@/app/actions/supportAccess";
import GrantWorkspace from "@/components/supportAccess/GrantWorkspace";
import GrantedRfpList from "@/components/supportAccess/GrantedRfpList";
import { SupportAccessError } from "@/components/supportAccess/SupportAccessStates";
import { grantedOrganizationName } from "@/lib/supportAccess/grantedOrganization";
import { SUPPORT_ACCESS_PATH, accessEndedPath } from "@/lib/supportAccess/grants";

export const metadata = { title: "Granted RFPs" };
export const dynamic = "force-dynamic";

type GrantedOrganizationPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<{ search?: string; page?: string }>;
};

export default async function GrantedOrganizationPage({ params, searchParams }: GrantedOrganizationPageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
  const search = typeof query?.search === "string" ? query.search : "";
  const pageParam = Number.parseInt(typeof query?.page === "string" ? query.page : "1", 10);
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const organizationName = await grantedOrganizationName(organizationId);
  const response = await listGrantedRfpsAction(organizationId, { search, page });
  // Expired, revoked or never granted: back to "Granted to me" with a plain message.
  if (!response.ok && response.failure === "grant_required") redirect(accessEndedPath());

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <Link
        href={SUPPORT_ACCESS_PATH}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-[#008f96]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Granted to me
      </Link>
      {response.ok ? (
        <GrantWorkspace organizationId={organizationId} organizationName={organizationName} grants={response.data.grants} readAt={response.readAt}>
          <GrantedRfpList organizationId={organizationId} search={search} page={response.data} />
        </GrantWorkspace>
      ) : (
        <SupportAccessError message={response.error} />
      )}
    </div>
  );
}

import { listLegacyCustomersPageAction } from "@/app/actions/legacyCustomers";
import AdminPageHeader from "@/components/layout/AdminPageHeader";
import LegacyCustomersList from "@/components/legacyCustomers/LegacyCustomersList";
import { PlacementFailureState, PlacementFrame } from "@/components/legacyCustomers/PlacementChrome";
import { LEGACY_CUSTOMERS_PATH } from "@/lib/legacyCustomers/placement";
import { UserRoundCog } from "lucide-react";

export const metadata = { title: "Legacy customers" };
// The list changes as customers are placed: it is read for every view and never cached.
export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ page?: string | string[] }> };

/* One page of the list (at most 50 customers), chosen by ?page=, which is a number and nothing
   else. The backend returns the whole list in one answer; the action cuts the page on the server,
   so the rest of the names and emails never reach the browser. One backend read per view. The
   search is the list's own form (a POST): its text is never in this address.

   The list component keeps the rows it was first given (and the rows of its last search), so it
   is keyed on this read, not on the page number alone: every server read of the page, the same
   page number included, mounts a new list showing what that read returned. */
export default async function LegacyCustomersPage({ searchParams }: Props) {
  const result = await listLegacyCustomersPageAction((await searchParams)?.page);
  const readId = crypto.randomUUID();
  return (
    <PlacementFrame back={false}>
      <AdminPageHeader
        eyebrow="Placement"
        title="Legacy customers"
        description="Customer accounts from before organizations, each waiting to be placed, with their proposals, into a new or an existing organization. Until a customer is placed they can't sign in."
        icon={UserRoundCog}
      />
      {result.ok ? (
        <LegacyCustomersList key={`${result.data.page}:${readId}`} initial={result.data} />
      ) : (
        <PlacementFailureState failure={result.failure} retryAfterSeconds={result.retryAfterSeconds} retryHref={LEGACY_CUSTOMERS_PATH} />
      )}
    </PlacementFrame>
  );
}

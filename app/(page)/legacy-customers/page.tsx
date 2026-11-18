import { listLegacyCustomersAction } from "@/app/actions/legacyCustomers";
import AdminPageHeader from "@/components/layout/AdminPageHeader";
import LegacyCustomersList from "@/components/legacyCustomers/LegacyCustomersList";
import { PlacementFailureState, PlacementFrame } from "@/components/legacyCustomers/PlacementChrome";
import { LEGACY_CUSTOMERS_PATH } from "@/lib/legacyCustomers/placement";
import { UserRoundCog } from "lucide-react";

export const metadata = { title: "Legacy customers" };
// The list changes as customers are placed: it is read for every view and never cached.
export const dynamic = "force-dynamic";

export default async function LegacyCustomersPage() {
  const result = await listLegacyCustomersAction();
  return (
    <PlacementFrame back={false}>
      <AdminPageHeader
        eyebrow="Placement"
        title="Legacy customers"
        description="Customer accounts from before organizations, each waiting to be placed, with their proposals, into a new or an existing organization. Until a customer is placed they can't sign in."
        icon={UserRoundCog}
      />
      {result.ok ? (
        <LegacyCustomersList customers={result.data} />
      ) : (
        <PlacementFailureState failure={result.failure} retryAfterSeconds={result.retryAfterSeconds} retryHref={LEGACY_CUSTOMERS_PATH} />
      )}
    </PlacementFrame>
  );
}

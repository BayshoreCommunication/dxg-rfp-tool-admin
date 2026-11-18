import PlaceCustomerFlow from "@/components/legacyCustomers/PlaceCustomerFlow";
import { PlacementFailureState, PlacementFrame } from "@/components/legacyCustomers/PlacementChrome";
import { isPlacementId, placeCustomerPath } from "@/lib/legacyCustomers/placement";
import { loadLegacyCustomerForPlacement } from "@/lib/server/legacyCustomerForPlacement";

export const metadata = { title: "Place a legacy customer" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ userId: string }> };

/* The place flow for one customer. The API has no route for a single legacy customer, so a
   server-only helper reads the list and hands this page the one customer: who is being placed
   and how many proposals move are what the backend says now, not what an earlier page said, and
   nobody else's row reaches this page. */
export default async function PlaceLegacyCustomerPage({ params }: Props) {
  const { userId } = await params;
  if (!isPlacementId(userId)) {
    return (
      <PlacementFrame>
        <PlacementFailureState failure="invalid_id" />
      </PlacementFrame>
    );
  }
  const result = await loadLegacyCustomerForPlacement(userId);
  const customer = result.ok ? result.data : null;
  return (
    <PlacementFrame>
      {!result.ok ? (
        <PlacementFailureState failure={result.failure} retryAfterSeconds={result.retryAfterSeconds} retryHref={placeCustomerPath(userId)} />
      ) : customer ? (
        <PlaceCustomerFlow customer={customer} />
      ) : (
        <PlacementFailureState failure="already_placed" />
      )}
    </PlacementFrame>
  );
}

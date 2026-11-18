import { listLegacyCustomersAction } from "@/app/actions/legacyCustomers";
import PlaceCustomerFlow from "@/components/legacyCustomers/PlaceCustomerFlow";
import { PlacementFailureState, PlacementFrame } from "@/components/legacyCustomers/PlacementChrome";
import { isPlacementId, placeCustomerPath } from "@/lib/legacyCustomers/placement";

export const metadata = { title: "Place a legacy customer" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ userId: string }> };

/* The place flow for one customer. The API has no route for a single legacy customer, so the
   page reads the list and takes the customer from it: who is being placed and how many proposals
   move are what the backend says now, not what an earlier page said. */
export default async function PlaceLegacyCustomerPage({ params }: Props) {
  const { userId } = await params;
  if (!isPlacementId(userId)) {
    return (
      <PlacementFrame>
        <PlacementFailureState failure="invalid_id" />
      </PlacementFrame>
    );
  }
  const result = await listLegacyCustomersAction();
  const customer = result.ok ? (result.data.find((item) => item.userId === userId) ?? null) : null;
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

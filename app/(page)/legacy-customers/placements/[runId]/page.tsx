import { getPlacementRunAction } from "@/app/actions/legacyCustomers";
import { PlacementFailureState, PlacementFrame } from "@/components/legacyCustomers/PlacementChrome";
import PlacementRunView from "@/components/legacyCustomers/PlacementRunView";
import { placementRunPath, runIdFromSegment } from "@/lib/legacyCustomers/placement";

export const metadata = { title: "Placement run" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ runId: string }> };

/* One placement run, at an address keyed by its run id: a refresh, or a colleague opening the
   same link, shows and follows the same run. The page reads the run once; the view then follows
   it (components/legacyCustomers/PlacementRunView.tsx). */
export default async function PlacementRunPage({ params }: Props) {
  const runId = runIdFromSegment((await params).runId);
  if (!runId) {
    return (
      <PlacementFrame>
        <PlacementFailureState failure="invalid_id" />
      </PlacementFrame>
    );
  }
  const result = await getPlacementRunAction(runId);
  return (
    <PlacementFrame>
      {result.ok ? (
        <PlacementRunView initial={result.data} />
      ) : (
        <PlacementFailureState failure={result.failure} retryAfterSeconds={result.retryAfterSeconds} retryHref={placementRunPath(runId)} />
      )}
    </PlacementFrame>
  );
}

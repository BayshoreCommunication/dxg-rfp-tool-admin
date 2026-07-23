import PricingWorkspace from "@/components/pricing/PricingWorkspace";
import { notFound } from "next/navigation";

export default function Page() {
  if (process.env.NEXT_PUBLIC_PRICING_ENABLED !== "true") notFound();
  return <PricingWorkspace />;
}

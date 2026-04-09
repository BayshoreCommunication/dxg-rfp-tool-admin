import TopHeader from "@/components/clients/TopHeader";
import { ClientDetailsSkeleton } from "@/components/clients/ClientDetilas";

export default function LoadingClientsPage() {
  return (
    <div className="space-y-8 px-6">
      <TopHeader />
      <ClientDetailsSkeleton />
    </div>
  );
}

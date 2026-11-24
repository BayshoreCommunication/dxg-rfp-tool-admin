import { getAdminOverviewAction } from "@/app/actions/admin";
import TopCardItem from "./TopCardItem";
import TopHeader from "./TopHeader";
import LiveAiPilotCard from "./LiveAiPilotCard";
import SupportMetricsCards from "@/components/support/SupportMetricsCards";

const DashboardDetails = async () => {
  const response = await getAdminOverviewAction();
  const totals = response.data?.totals;

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <TopHeader />
      <TopCardItem totals={totals} />
      <SupportMetricsCards compact />
      <LiveAiPilotCard />
    </div>
  );
};

export default DashboardDetails;

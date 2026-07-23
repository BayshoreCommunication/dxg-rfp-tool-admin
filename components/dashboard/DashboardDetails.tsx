import { getAdminOverviewAction } from "@/app/actions/admin";
import RecentClients from "./RecentClients";
import TopCardItem from "./TopCardItem";
import TopHeader from "./TopHeader";
import LiveAiPilotCard from "./LiveAiPilotCard";

const DashboardDetails = async () => {
  const response = await getAdminOverviewAction();
  const totals = response.data?.totals;
  const latestClients = response.data?.latestClients || [];

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <TopHeader />
      <TopCardItem totals={totals} />
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.92fr)]">
        <RecentClients clients={latestClients} />
        <LiveAiPilotCard />
      </div>
    </div>
  );
};

export default DashboardDetails;

import { getAdminOverviewAction } from "@/app/actions/admin";
import RecentClients from "./RecentClients";
import TopCardItem from "./TopCardItem";
import TopHeader from "./TopHeader";

const DashboardDetials = async () => {
  const response = await getAdminOverviewAction();
  const totals = response.data?.totals;
  const latestClients = response.data?.latestClients || [];

  return (
    <div className="space-y-8 px-6">
      <TopHeader />
      <TopCardItem totals={totals} />
      <RecentClients clients={latestClients} />
    </div>
  );
};

export default DashboardDetials;

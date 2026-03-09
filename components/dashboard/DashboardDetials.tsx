import RecentClients from "./RecentClients";
import TopCardItem from "./TopCardItem";
import TopHeader from "./TopHeader";

const DashboardDetials = () => {
  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <TopHeader />

      {/* ── Stat Cards ── */}
      <TopCardItem />

      {/* ── Recent Proposals ── */}
      <RecentClients />
    </div>
  );
};

export default DashboardDetials;

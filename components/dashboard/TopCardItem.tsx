import React from "react";
import { Users, FileText, Send, MousePointerClick, TrendingUp } from "lucide-react";

interface StatMetric {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactElement<{ className?: string }>;
  iconSurface: string;
  iconColor: string;
  trendValue: string;
}

interface TopCardItemProps {
  isLoading?: boolean;
  totals?: {
    totalClients: number;
    totalProposals: number;
    totalEmailSent: number;
    totalClick: number;
  };
}

const StatCard = ({ title, value, icon, iconSurface, iconColor, trendValue }: StatMetric) => {
  return (
    <article className="group flex min-h-[154px] flex-col justify-between rounded-2xl border border-[#dce5ee] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd9e6] hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] sm:min-h-[176px] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl ${iconSurface}`}>
          {React.cloneElement(icon, { className: `h-5 w-5 sm:h-6 sm:w-6 ${iconColor}` })}
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-[#c9efea] bg-[#effbf9] px-2.5 py-1 text-xs font-bold text-[#059a91]">
          <TrendingUp className="h-3 w-3" aria-hidden="true" />
          <span>{trendValue}</span>
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <h2 className="text-sm font-semibold text-[#263650]">{title}</h2>
        <p className="mt-1 text-[34px] font-extrabold leading-none tracking-[-0.035em] text-[#10203a]">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </p>
        <p className="mt-2 text-xs font-medium text-slate-400">vs last 30 days</p>
      </div>
    </article>
  );
};

export const TopCardItemSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="min-h-[154px] rounded-2xl border border-slate-200 bg-white p-4 sm:min-h-[176px] sm:p-6">
          <div className="flex items-start justify-between">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-6 w-14 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-9 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default function TopCardItem({ totals, isLoading }: TopCardItemProps) {
  if (isLoading) return <TopCardItemSkeleton />;

  const statsData: StatMetric[] = [
    {
      id: "clients",
      title: "Total Clients",
      value: totals?.totalClients ?? 0,
      iconSurface: "bg-[#f0efff]",
      iconColor: "text-[#5b4df6]",
      trendValue: "+12%",
      icon: <Users strokeWidth={2} />,
    },
    {
      id: "proposals",
      title: "Total Proposals",
      value: totals?.totalProposals ?? 0,
      iconSurface: "bg-[#e8f8f4]",
      iconColor: "text-[#08a983]",
      trendValue: "+18%",
      icon: <FileText strokeWidth={2} />,
    },
    {
      id: "sent",
      title: "Total Email Sent",
      value: totals?.totalEmailSent ?? 0,
      iconSurface: "bg-[#e9f6fc]",
      iconColor: "text-[#08a7db]",
      trendValue: "+5%",
      icon: <Send strokeWidth={2} />,
    },
    {
      id: "clicked",
      title: "Total Email Click",
      value: totals?.totalClick ?? 0,
      iconSurface: "bg-[#fff1e7]",
      iconColor: "text-[#ff7b16]",
      trendValue: "+24%",
      icon: <MousePointerClick strokeWidth={2} />,
    },
  ];

  return (
    <section aria-label="Dashboard metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
      {statsData.map((stat) => (
        <StatCard key={stat.id} {...stat} />
      ))}
    </section>
  );
}

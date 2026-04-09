import React from "react";
import { Users, FileText, Send, MousePointerClick, TrendingUp } from "lucide-react";

interface StatMetric {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactElement<{ className?: string }>;
  bgGradient: string;
  textColor: string;
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

const StatCard = ({ title, value, icon, bgGradient, textColor, trendValue }: StatMetric) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 ${bgGradient} text-white shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl`}>
      {/* Large watermark background icon */}
      <div className="absolute -bottom-4 -right-4 opacity-20 pointer-events-none text-white w-32 h-32">
        {React.cloneElement(icon, { className: "w-full h-full" })}
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-4 text-white">
          <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
            {React.cloneElement(icon, { className: "w-6 h-6 text-white" })}
          </div>
          
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold text-white">
            <TrendingUp className="w-3 h-3" />
            <span>{trendValue}</span>
          </div>
        </div>

        <div>
          <h3 className="text-white/80 text-sm font-semibold mb-1">
            {title}
          </h3>
          <div className="text-4xl font-extrabold tracking-tight">
            {value}
          </div>
        </div>
      </div>
      
      {/* Decorative top reflection or soft glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />
    </div>
  );
};

export const TopCardItemSkeleton = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="relative overflow-hidden rounded-2xl p-6 bg-slate-100 shadow-sm border border-slate-200">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-200 animate-pulse" />
              <div className="w-12 h-6 rounded-full bg-slate-200 animate-pulse" />
            </div>
            <div>
              <div className="w-24 h-4 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="w-16 h-8 bg-slate-200 rounded animate-pulse" />
            </div>
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
      bgGradient: "bg-gradient-to-br from-indigo-500 to-indigo-700",
      textColor: "text-indigo-400",
      trendValue: "+12%",
      icon: <Users strokeWidth={2} />,
    },
    {
      id: "proposals",
      title: "Total Proposals",
      value: totals?.totalProposals ?? 0,
      bgGradient: "bg-gradient-to-br from-emerald-400 to-emerald-600",
      textColor: "text-emerald-400",
      trendValue: "+18%",
      icon: <FileText strokeWidth={2} />,
    },
    {
      id: "sent",
      title: "Total Email Sent",
      value: totals?.totalEmailSent ?? 0,
      bgGradient: "bg-gradient-to-br from-cyan-400 to-cyan-600",
      textColor: "text-cyan-400",
      trendValue: "+5%",
      icon: <Send strokeWidth={2} />,
    },
    {
      id: "clicked",
      title: "Total Email Click",
      value: totals?.totalClick ?? 0,
      bgGradient: "bg-gradient-to-br from-orange-400 to-orange-600",
      textColor: "text-orange-400",
      trendValue: "+24%",
      icon: <MousePointerClick strokeWidth={2} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat) => (
        <StatCard key={stat.id} {...stat} />
      ))}
    </div>
  );
}

import { BrainCircuit, CircleDollarSign, Database, House, Settings, UserRound, Users } from "lucide-react";

export interface NavItem {
  id: string;
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

export const navigationConfig: NavItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    href: "/dashboard",
    icon: <House size={22} />,
  },
  {
    id: "clients",
    title: "Clients",
    href: "/clients",
    icon: <UserRound size={22} />,
  },

  {
    id: "users",
    title: "Users",
    href: "/users",
    icon: <Users size={22} />,
  },

  ...(process.env.NEXT_PUBLIC_KNOWLEDGE_IMPORTS_ENABLED === "true" ? [{
    id: "knowledge-sources",
    title: "Knowledge",
    href: "/knowledge-sources",
    icon: <Database size={22} />,
  }] : []),

  ...(process.env.NEXT_PUBLIC_PRICING_ENABLED === "true" ? [{
    id: "pricing-knowledge",
    title: "Pricing",
    href: "/pricing-knowledge",
    icon: <CircleDollarSign size={22} />,
  }] : []),

  {
    id: "ai-operations",
    title: "AI",
    href: "/ai-operations",
    icon: <BrainCircuit size={22} />,
  },

  {
    id: "settings",
    title: "Settings",
    href: "/settings",
    icon: <Settings size={22} />,
  },
];

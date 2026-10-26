import { FileText, House, LifeBuoy, Settings, UserRound, Users } from "lucide-react";

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
    id: "proposals",
    title: "Proposals",
    href: "/proposals",
    icon: <FileText size={22} />,
  },

  {
    id: "users",
    title: "Users",
    href: "/users",
    icon: <Users size={22} />,
  },

  {
    id: "support",
    title: "Support",
    href: "/support",
    icon: <LifeBuoy size={22} />,
  },

  {
    id: "settings",
    title: "Settings",
    href: "/settings",
    icon: <Settings size={22} />,
  },
];

import { House, Settings, UsersRound } from "lucide-react";

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
    icon: <UsersRound  size={22} />,
  },

  {
    id: "settings",
    title: "Setting",
    href: "/settings",
    icon: <Settings size={22} />,
  },
];

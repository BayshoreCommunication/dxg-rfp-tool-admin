import { Building2, House, LifeBuoy, Settings, ShieldCheck, UserRound, Users } from "lucide-react";

export interface NavItem {
  id: string;
  title: string;
  /** Label for the phone tab bar when the title is too long for a seventh of the screen. */
  shortTitle?: string;
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
    id: "organizations",
    title: "Organizations",
    shortTitle: "Orgs",
    href: "/organizations",
    icon: <Building2 size={22} />,
  },

  {
    id: "support-access",
    title: "Support access",
    shortTitle: "Access",
    href: "/support-access",
    icon: <ShieldCheck size={22} />,
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

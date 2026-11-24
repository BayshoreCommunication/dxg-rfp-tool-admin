import type { NavItem } from "@/config/navigation";

// Whether the desktop sidebar shows icons only. Saved per browser, like the dashboard's.
export const SIDEBAR_COLLAPSED_KEY = "rfpilot-admin:sidebar-collapsed";

export const readSidebarCollapsed = (storage: Pick<Storage, "getItem"> | undefined): boolean => {
  try {
    return storage?.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

export const writeSidebarCollapsed = (
  storage: Pick<Storage, "setItem"> | undefined,
  collapsed: boolean,
) => {
  try {
    storage?.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage blocked (private window, site data off): the choice lasts for this visit only.
  }
};

// Support and Settings are pinned at the foot of the sidebar; the rest is the main list.
export const FOOTER_NAV_IDS = ["support", "settings"] as const;

export const splitNavigation = (items: NavItem[]) => ({
  main: items.filter((item) => !(FOOTER_NAV_IDS as readonly string[]).includes(item.id)),
  footer: FOOTER_NAV_IDS.map((id) => items.find((item) => item.id === id)).filter(
    (item): item is NavItem => Boolean(item),
  ),
});

export const isNavItemActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const initialsFor = (name?: string | null, email?: string | null) => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  const source = parts[0] || email?.split("@")[0] || "Admin";
  return source.slice(0, 2).toUpperCase();
};

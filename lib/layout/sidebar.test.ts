import { navigationConfig } from "@/config/navigation";
import {
  SIDEBAR_COLLAPSED_KEY,
  initialsFor,
  isNavItemActive,
  readSidebarCollapsed,
  splitNavigation,
  writeSidebarCollapsed,
} from "./sidebar";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe("admin sidebar helpers", () => {
  it("pins Support and Settings to the footer and keeps the rest in the main list", () => {
    const { main, footer } = splitNavigation(navigationConfig);
    expect(main.map((item) => item.id)).toEqual(["dashboard", "organizations", "users"]);
    expect(footer.map((item) => item.id)).toEqual(["support", "settings"]);
  });

  it("saves and reads the collapsed choice", () => {
    const storage = memoryStorage();
    expect(readSidebarCollapsed(storage)).toBe(false);
    writeSidebarCollapsed(storage, true);
    expect(storage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    expect(readSidebarCollapsed(storage)).toBe(true);
    writeSidebarCollapsed(storage, false);
    expect(readSidebarCollapsed(storage)).toBe(false);
  });

  it("treats blocked storage as expanded and does not throw", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readSidebarCollapsed(blocked)).toBe(false);
    expect(() => writeSidebarCollapsed(blocked, true)).not.toThrow();
    expect(readSidebarCollapsed(undefined)).toBe(false);
  });

  it("marks a link active on its page and the pages under it only", () => {
    expect(isNavItemActive("/support", "/support")).toBe(true);
    expect(isNavItemActive("/support/abc", "/support")).toBe(true);
    expect(isNavItemActive("/support-access", "/support")).toBe(false);
  });

  it("builds initials from the name, then the email", () => {
    expect(initialsFor("Ada Lovelace", "ada@example.com")).toBe("AL");
    expect(initialsFor("ada", null)).toBe("AD");
    expect(initialsFor("", "grace.hopper@example.com")).toBe("GR");
    expect(initialsFor(null, null)).toBe("AD");
  });
});

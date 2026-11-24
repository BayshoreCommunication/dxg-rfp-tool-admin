import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The Clients directory and the Legacy customers screens were removed on 2026-11-24 (owner
// decision). A removed screen must not answer at its address: no page, no redirect, no link.

const ROOTS = ["app", "components", "config", "lib"];
const TOP_FILES = ["proxy.ts", "next.config.ts", "auth.ts"];

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });

describe("the removed Clients and Legacy customers screens", () => {
  it("have no route, at any depth of the app directory", () => {
    const routeDirectories = (directory: string): string[] =>
      readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isDirectory() ? [name, ...routeDirectories(path)] : [];
      });
    const names = routeDirectories("app");
    expect(names).not.toContain("clients");
    expect(names).not.toContain("legacy-customers");
    // No catch-all page that would answer for them instead of the 404. The only catch-all is
    // NextAuth's own route under /api/auth.
    expect(names.filter((name) => name.startsWith("[...") || name.startsWith("[[..."))).toEqual(["[...nextauth]"]);
  });

  it("have no feature folder left behind", () => {
    for (const path of ["components/clients", "components/legacyCustomers", "lib/legacyCustomers", "app/actions/allClients.ts", "app/actions/legacyCustomers.ts", "lib/server/legacyCustomerForPlacement.ts"]) {
      expect({ path, exists: existsSync(path) }).toEqual({ path, exists: false });
    }
  });

  it("are not linked, redirected to or revalidated from anywhere", () => {
    const files = [...ROOTS.flatMap(sourceFiles), ...TOP_FILES];
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect({ file, mentions: /["'`(]\/(clients|legacy-customers)\b|all-clients|admin\/legacy-customers/.test(source) }).toEqual({ file, mentions: false });
    }
  });

  it("are not in the navigation, which keeps one entry per remaining screen", () => {
    const navigation = readFileSync("config/navigation.tsx", "utf8");
    expect([...navigation.matchAll(/href: "([^"]+)"/g)].map((match) => match[1])).toEqual(["/dashboard", "/organizations", "/users", "/support", "/settings"]);
  });
});

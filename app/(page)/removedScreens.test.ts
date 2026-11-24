import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The Clients directory and the Legacy customers screens were removed on 2026-11-24 (owner
// decision). This proves what a source scan can: no route directory that would serve either
// address, no feature folder, and no mention of either path in the app's code. It does not
// request the addresses, so it does not itself prove the 404.

const ROOTS = ["app", "components", "config", "lib"];
const TOP_FILES = ["proxy.ts", "next.config.ts", "auth.ts"];

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

// The only files that may spell either path, each for a reason unrelated to a link:
const MAY_MENTION = new Set([
  // this test, which has to name what it bans;
  "app/(page)/removedScreens.test.ts",
  // a path-traversal fixture ("../clients" as a malformed organization id).
  "lib/support/organization.test.ts",
]);

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
    // No dynamic segment at the first level of the address (such as app/(page)/[section]) either.
    // Route groups add no segment, so their children are first-level too.
    const firstLevel = (directory: string): string[] =>
      readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        if (!statSync(path).isDirectory()) return [];
        return /^\(.*\)$/.test(name) ? firstLevel(path) : [name];
      });
    expect(firstLevel("app")).toEqual(expect.arrayContaining(["dashboard", "organizations", "support"]));
    expect(firstLevel("app").filter((name) => name.startsWith("["))).toEqual([]);
  });

  it("have no feature folder left behind", () => {
    for (const path of ["components/clients", "components/legacyCustomers", "lib/legacyCustomers", "app/actions/allClients.ts", "app/actions/legacyCustomers.ts", "lib/server/legacyCustomerForPlacement.ts"]) {
      expect({ path, exists: existsSync(path) }).toEqual({ path, exists: false });
    }
  });

  it("are not named as a path anywhere in the code, tests included", () => {
    const files = [...ROOTS.flatMap(sourceFiles), ...TOP_FILES];
    // The floor only proves the scan found the source tree; lowered from 200 on 2026-11-24 by the owner's decision when the staff member and team write screens were removed (193 files remain).
    expect(files.length).toBeGreaterThan(150);
    const mentioning = files.filter((file) => /\/(clients|legacy-customers)\b|all-clients/.test(readFileSync(file, "utf8")));
    expect(mentioning.filter((file) => !MAY_MENTION.has(file))).toEqual([]);
    // The allow-list stays exact: a file on it that no longer mentions a path must come off it.
    expect(mentioning.sort()).toEqual([...MAY_MENTION].sort());
  });

  it("are not in the navigation, which keeps one entry per remaining screen", () => {
    const navigation = readFileSync("config/navigation.tsx", "utf8");
    expect([...navigation.matchAll(/href: "([^"]+)"/g)].map((match) => match[1])).toEqual(["/dashboard", "/organizations", "/users", "/support", "/settings"]);
  });
});

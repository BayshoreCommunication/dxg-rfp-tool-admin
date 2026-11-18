import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// No component harness in this repo (Jest runs in node), so these read the source, the same way
// the organization pages' tests do.

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const sourceFiles = (directory: string): string[] =>
  readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(process.cwd(), relative)).isDirectory()) return sourceFiles(relative);
    return /\.tsx?$/.test(entry) && !/\.test\.ts$/.test(entry) ? [relative] : [];
  });
const withoutComments = (source: string) => source.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "");

const PAGES = "app/(page)/legacy-customers";
const COMPONENTS = "components/legacyCustomers";
const LIB = "lib/legacyCustomers";
const ACTIONS = "app/actions/legacyCustomers.ts";
const screenFiles = [...sourceFiles(PAGES), ...sourceFiles(COMPONENTS), ...sourceFiles(LIB)];
const links = (file: string) => read(file).match(/<Link\b[^>]*>/g) ?? [];

describe("the Legacy customers screen", () => {
  it("covers every file of the feature", () => {
    expect(screenFiles.sort()).toEqual([
      `${PAGES}/[userId]/place/loading.tsx`,
      `${PAGES}/[userId]/place/page.tsx`,
      `${PAGES}/loading.tsx`,
      `${PAGES}/page.tsx`,
      `${PAGES}/placements/[runId]/loading.tsx`,
      `${PAGES}/placements/[runId]/page.tsx`,
      `${COMPONENTS}/LegacyCustomersList.tsx`,
      `${COMPONENTS}/OrganizationPicker.tsx`,
      `${COMPONENTS}/PlaceCustomerFlow.tsx`,
      `${COMPONENTS}/PlacementChrome.tsx`,
      `${COMPONENTS}/PlacementRunView.tsx`,
      `${LIB}/confirmedSubmit.ts`,
      `${LIB}/draft.ts`,
      `${LIB}/placement.ts`,
      `${LIB}/pollController.ts`,
      `${LIB}/runView.ts`,
      `${LIB}/typeahead.ts`,
    ]);
  });

  it.each(screenFiles)("%s reaches the backend only through the server actions", (file) => {
    const source = withoutComments(read(file));
    // No request of its own, by any route.
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket|\baxios\b|new Request\(/);
    // Nothing that knows where the backend is or how to sign a request to it.
    expect(source).not.toMatch(/BACKEND_URL|@\/lib\/config|backendClient|authenticatedBackendFetch|backendSession|process\.env|Authorization|Bearer/);
    expect(source).not.toMatch(/\/api\/admin\/|\/api\/v1\//);
    // The only actions it may call are this feature's.
    const imported = [...source.matchAll(/from "(@\/app\/actions\/[^"]+)"/g)].map((match) => match[1]);
    for (const path of imported) expect(path).toBe("@/app/actions/legacyCustomers");
    const actions = [...new Set(source.match(/\b\w+Action\b/g) ?? [])].filter((name) => name !== "PlacementAction");
    for (const action of actions) {
      expect(action).toMatch(/^(listLegacyCustomers|searchPlacementTargets|listPlacementTeams|placeLegacyCustomer|getPlacementRun|rollbackPlacementRun)Action$/);
    }
    // The pure code under lib/ calls nothing at all: what it sends is handed to it.
    if (file.startsWith(LIB)) expect(imported).toEqual([]);
  });

  it("is the only caller of the placement actions", () => {
    const everywhere = [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib")];
    const callers = everywhere.filter((file) => file !== ACTIONS && /@\/app\/actions\/legacyCustomers"/.test(read(file)));
    for (const file of callers) expect(file.startsWith(PAGES) || file.startsWith(COMPONENTS)).toBe(true);
    expect(callers.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps the backend in the actions file, behind the staff check and the app's signed fetch", () => {
    const source = read(ACTIONS);
    expect(source.startsWith('"use server";')).toBe(true);
    expect(source).toMatch(/const API = `\$\{BACKEND_URL\}\/api\/admin\/legacy-customers`;/);
    expect(withoutComments(source)).not.toMatch(/\bfetch\s*\(/);
    expect(source.match(/authenticatedBackendFetch\(/g)).toHaveLength(1);
    // Every exported action asks who is signed in before anything else.
    const bodies = source.split(/\nexport async function /).slice(1);
    expect(bodies).toHaveLength(6);
    for (const body of bodies) {
      const firstStatement = body.slice(body.indexOf("{\n") + 2).trimStart();
      expect(firstStatement.startsWith("const denied = await staffRefusal();\n  if (denied) return denied;")).toBe(true);
    }
  });

  it("links into organization pages without prefetching: each view of one is a recorded read", () => {
    const toOrganization = /organizationAccountPath\(|["'`{]\/organizations\/|organization\w+Path\(/;
    const found = screenFiles.flatMap((file) => links(file).filter((link) => toOrganization.test(link)).map((link) => ({ file, link })));
    expect(found).toHaveLength(1);
    expect(found[0].file).toBe(`${COMPONENTS}/PlacementRunView.tsx`);
    expect(found[0].link).toMatch(/href=\{organizationAccountPath\(run\.targetOrganizationId\)\}\s+prefetch=\{false\}/);
    // And nothing here goes there in code, where a prefetch would not show in this scan.
    for (const file of screenFiles) expect({ file, navigates: /router\.(push|replace|prefetch)\([^)]*organization/i.test(read(file)) }).toEqual({ file, navigates: false });
  });

  it("links to the organization only from a run that placed the customer", () => {
    const view = read(`${COMPONENTS}/PlacementRunView.tsx`);
    expect(view).toMatch(/\{showsOrganizationLink\(run\) && run\.targetOrganizationId \? \(\s*<p className="mt-3">\s*<Link href=\{organizationAccountPath\(run\.targetOrganizationId\)\}/);
  });

  it("never prefetches a page that reads the backend when it opens", () => {
    // The place page reads the customer list and the run page reads the run. A prefetch of either
    // would spend the allowance for a page nobody opened.
    const reading = /placeCustomerPath\(|placementRunPath\(|sessionRenewPath\(/;
    let found = 0;
    for (const file of screenFiles) {
      for (const link of links(file).filter((item) => reading.test(item))) {
        found += 1;
        expect({ file, link, optsOut: /prefetch=\{false\}/.test(link) }).toMatchObject({ optsOut: true });
      }
      expect({ file, prefetches: /router\.prefetch\(/.test(read(file)) }).toEqual({ file, prefetches: false });
    }
    expect(found).toBeGreaterThanOrEqual(6);
  });

  it("follows a run with one poll controller, made once per page and ended with it", () => {
    const view = read(`${COMPONENTS}/PlacementRunView.tsx`);
    expect(view.match(/createPollController\(/g)).toHaveLength(1);
    expect(view).toMatch(/created\.start\(\);\s*return \(\) => \{\s*document\.removeEventListener\("visibilitychange", onVisibility\);\s*created\.dispose\(\);/);
    expect(view).toMatch(/isVisible: \(\) => document\.visibilityState !== "hidden"/);
    // No timer of the view's own, and no interval handed to the controller: the floor is the controller's.
    for (const file of [...sourceFiles(PAGES), ...sourceFiles(COMPONENTS)]) {
      expect({ file, timers: /setInterval|setTimeout|requestAnimationFrame|intervalMs|router\.refresh\(/.test(withoutComments(read(file))) }).toEqual({ file, timers: false });
    }
    expect(screenFiles.filter((file) => /getPlacementRunAction\(/.test(read(file))).sort()).toEqual([`${PAGES}/placements/[runId]/page.tsx`, `${COMPONENTS}/PlacementRunView.tsx`]);
  });

  it("sends a placement and a rollback only through the confirmation gate", () => {
    const flow = read(`${COMPONENTS}/PlaceCustomerFlow.tsx`);
    const view = read(`${COMPONENTS}/PlacementRunView.tsx`);
    expect(flow.match(/placeLegacyCustomerAction\(/g)).toHaveLength(1);
    expect(flow).toMatch(/createConfirmedSubmit<PlaceResult>\(\{\s*send: async \(\) => \{\s*try \{\s*return await placeLegacyCustomerAction\(customer\.userId, request, idempotencyKey\);/);
    expect(view.match(/rollbackPlacementRunAction\(/g)).toHaveLength(1);
    expect(view).toMatch(/createConfirmedSubmit<RollbackResult>\(\{\s*send: async \(\) => \{\s*try \{\s*return await rollbackPlacementRunAction\(run\.runId, key\);/);
    // The two submit controls are off until the confirmation is given and while a request is in flight.
    expect(flow).toMatch(/<button type="submit" disabled=\{!gateState\.confirmed \|\| busy\} className=\{primaryButton\}>/);
    expect(view).toMatch(/<button type="submit" disabled=\{!gateState\.confirmed \|\| busy\} className=\{dangerButton\}>/);
    for (const source of [flow, view]) expect(source).toMatch(/const busy = gateState\.inFlight \|\| gateState\.done;/);
    // Rollback is drawn only for a run the API will roll back.
    expect(view).toMatch(/\{canRollBack\(run\) \? \(\s*<RollbackPanel/);
    expect(view.match(/<RollbackPanel\b/g)).toHaveLength(1);
  });

  it("searches organizations only through the debounced search", () => {
    const picker = read(`${COMPONENTS}/OrganizationPicker.tsx`);
    expect(picker).toMatch(/createTypeahead\(\{ search: searchPlacementTargetsAction, onChange: setState \}\)/);
    expect(screenFiles.filter((file) => /searchPlacementTargetsAction/.test(read(file)))).toEqual([`${COMPONENTS}/OrganizationPicker.tsx`]);
    expect(picker.match(/searchPlacementTargetsAction/g)).toHaveLength(2);
    expect(picker).not.toMatch(/debounceMs/);
  });

  it("offers only the three roles the API accepts", () => {
    const flow = read(`${COMPONENTS}/PlaceCustomerFlow.tsx`);
    expect(flow).toMatch(/\{PLACEMENT_ROLES\.map\(\(role\) => \(\s*<option key=\{role\} value=\{role\}>/);
    expect(read(`${LIB}/placement.ts`)).toMatch(/export const PLACEMENT_ROLES = \["organization_admin", "team_manager", "planner"\] as const;/);
    expect(flow).not.toMatch(/value="(owner|viewer)"/);
  });

  it("gives every control a name and a visible keyboard focus", () => {
    // An element from its opening to its closing tag (handlers hold ">" of their own).
    const elements = (source: string, open: RegExp, close: (name: string) => string) =>
      [...source.matchAll(open)].map((match) => {
        const end = source.indexOf(close(match[1]), match.index);
        return source.slice(match.index, end === -1 ? undefined : end);
      });
    let controls = 0;
    for (const file of sourceFiles(COMPONENTS)) {
      const source = read(file);
      // Buttons and links take the shared focus outline, by class or through a shared style.
      for (const element of elements(source, /<(button|Link)\b/g, (name) => `</${name}>`)) {
        controls += 1;
        expect({ file, element, focus: /focusRing|linkClass|primaryButton|secondaryButton|dangerButton/.test(element) }).toMatchObject({ focus: true });
      }
      // Every field is tied to a label by its id, or sits inside its label (the two radio buttons).
      for (const element of elements(source, /<(input|select)\b/g, (name) => (name === "input" ? "/>" : "</select>"))) {
        controls += 1;
        expect({ file, element, named: /\bid=\{/.test(element) || /type="radio"/.test(element) }).toMatchObject({ named: true });
        expect({ file, element, focus: /inputClass|accent-/.test(element) }).toMatchObject({ focus: true });
      }
      // Nothing is taken out of the tab order or put ahead of it.
      expect(source).not.toMatch(/tabIndex=\{[1-9]|tabIndex="[1-9]/);
    }
    expect(controls).toBeGreaterThan(25);
    // A checkbox or radio shows its focus on the label around it.
    for (const file of [`${COMPONENTS}/PlaceCustomerFlow.tsx`, `${COMPONENTS}/PlacementRunView.tsx`]) {
      expect(read(file)).toMatch(/has-\[:focus-visible\]:outline has-\[:focus-visible\]:outline-2/);
    }
    const chrome = read(`${COMPONENTS}/PlacementChrome.tsx`);
    expect(chrome).toMatch(/import \{ focusRing \} from "@\/components\/organizations\/content\/ContentChrome";/);
    for (const name of ["linkClass", "primaryButton", "dangerButton", "secondaryButton"]) {
      expect(chrome).toMatch(new RegExp(`export const ${name} =[^;]*\\$\\{focusRing\\}`));
    }
    expect(chrome).toMatch(/export const inputClass =\s*"[^"]*focus:border-\[#00aeb5\] focus:ring-4/);
  });

  it("has an entry in the navigation", () => {
    const navigation = read("config/navigation.tsx");
    expect(navigation).toMatch(/id: "legacy-customers",\s*title: "Legacy customers",\s*shortTitle: "Legacy",\s*href: "\/legacy-customers",/);
  });

  it("renders each page for every request", () => {
    for (const page of [`${PAGES}/page.tsx`, `${PAGES}/[userId]/place/page.tsx`, `${PAGES}/placements/[runId]/page.tsx`]) {
      expect(read(page)).toMatch(/export const dynamic = "force-dynamic";/);
      expect(read(page)).not.toMatch(/"use client"|revalidate|unstable_cache/);
    }
  });
});

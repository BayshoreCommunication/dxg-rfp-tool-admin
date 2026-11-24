import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// No component harness in this repo (Jest runs in node), so these read the source, the same way
// the organization pages' and the Legacy customers screen's tests do.

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const sourceFiles = (directory: string): string[] =>
  readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(process.cwd(), relative)).isDirectory()) return sourceFiles(relative);
    return /\.tsx?$/.test(entry) && !/\.test\.ts$/.test(entry) ? [relative] : [];
  });
const withoutComments = (source: string) => source.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "");

const PAGES = "app/(page)/organization-management";
const ROOT = `${PAGES}/[organizationId]`;
const COMPONENTS = "components/organizations/manage";
const LIB = "lib/organizationManagement";
const ACTIONS = "app/actions/organizationManagement.ts";
const screenFiles = [...sourceFiles(PAGES), ...sourceFiles(COMPONENTS), ...sourceFiles(LIB)];
const everywhere = [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib"), ...sourceFiles("config")];
const links = (file: string) => read(file).match(/<Link\b[^>]*>/g) ?? [];


const READ_ACTIONS = ["getManagedMemberAction", "getManagedOrganizationAction"];
// The only writes left: a block and a reactivation of the whole organization.
const WRITE_ACTIONS = ["blockOrganizationAction", "reactivateOrganizationAction"];
// The team page: its one read, its files. Nothing writes to a team.
const TEAM_READ_ACTIONS = ["getManagedTeamAction"];
const ALL_ACTIONS = [...READ_ACTIONS, ...WRITE_ACTIONS, ...TEAM_READ_ACTIONS];
const TEAM_PAGES = [`${ROOT}/teams/[teamId]/page.tsx`];
const TEAM_COMPONENTS = [`${COMPONENTS}/TeamManagement.tsx`];
const TEAM_FILES = [...TEAM_PAGES, ...TEAM_COMPONENTS, `${LIB}/teams.ts`];
const actionsIn = (file: string) => [...new Set(withoutComments(read(file)).match(/\b\w+Action\b/g) ?? [])].sort();

describe("the staff management screens", () => {
  it("covers every file of the feature", () => {
    expect(screenFiles.sort()).toEqual(
      [
        `${ROOT}/block/page.tsx`,
        `${ROOT}/loading.tsx`,
        `${ROOT}/members/[userId]/page.tsx`,
        `${ROOT}/reactivate/page.tsx`,
        `${COMPONENTS}/ManageChrome.tsx`,
        `${COMPONENTS}/MemberManagement.tsx`,
        `${COMPONENTS}/OrganizationWriteScreen.tsx`,
        `${COMPONENTS}/WriteFlow.tsx`,
        `${LIB}/confirmGate.ts`,
        `${LIB}/management.ts`,
        ...TEAM_FILES,
      ].sort(),
    );
  });

  it("lives outside the view-only content browser, and adds no page to it", () => {
    for (const file of screenFiles) {
      expect({ file, inside: file.startsWith("app/(page)/organizations/") || file.startsWith("components/organizations/content/") }).toEqual({ file, inside: false });
    }
    const lib = read(`${LIB}/management.ts`);
    expect(lib).toMatch(/export const MANAGEMENT_PATH = "\/organization-management";/);
  });

  it("is the only caller of the management actions", () => {
    const callers = everywhere.filter((file) => file !== ACTIONS && /@\/app\/actions\/organizationManagement"/.test(read(file)));
    for (const file of callers) expect({ file, inside: file.startsWith(PAGES) || file.startsWith(COMPONENTS) }).toEqual({ file, inside: true });
    expect(callers.sort()).toEqual([
      `${ROOT}/members/[userId]/page.tsx`,
      `${COMPONENTS}/OrganizationWriteScreen.tsx`,
      `${COMPONENTS}/WriteFlow.tsx`,
      `${ROOT}/teams/[teamId]/page.tsx`,
    ].sort());
    // And no file outside the feature names one of them in any other way.
    const names = new RegExp(`\\b(${ALL_ACTIONS.join("|")})\\b`);
    for (const file of everywhere) {
      if (file === ACTIONS || file.startsWith(PAGES) || file.startsWith(COMPONENTS)) continue;
      expect({ file, names: names.test(read(file)) }).toEqual({ file, names: false });
    }
  });

  it.each(screenFiles)("%s reaches the backend only through the management actions", (file) => {
    const source = withoutComments(read(file));
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket|\baxios\b|new Request\(/);
    expect(source).not.toMatch(/BACKEND_URL|@\/lib\/config|backendClient|authenticatedBackendFetch|backendSession|process\.env|Authorization|Bearer/);
    expect(source).not.toMatch(/\/api\/admin\/|\/api\/v1\//);
    const imported = [...source.matchAll(/from "(@\/app\/actions\/[^"]+)"/g)].map((match) => match[1]);
    for (const path of imported) expect(path).toBe("@/app/actions/organizationManagement");
    for (const action of actionsIn(file)) expect(ALL_ACTIONS).toContain(action);
    // The pure code under lib/ calls nothing at all: what it sends is handed to it.
    if (file.startsWith(LIB)) expect(imported).toEqual([]);
    // Nothing is cached, polled or refreshed behind the page.
    expect(source).not.toMatch(/setInterval|setTimeout|requestAnimationFrame|router\.refresh\(|revalidate|unstable_cache|"use cache"|useRouter|router\./);
  });


  it("keeps the backend in the actions file, behind the staff check and the app's signed fetch", () => {
    const source = read(ACTIONS);
    expect(source.startsWith('"use server";')).toBe(true);
    expect(source).toMatch(/const API = `\$\{BACKEND_URL\}\/api\/v1\/admin\/organizations`;/);
    expect(withoutComments(source)).not.toMatch(/\bfetch\s*\(/);
    expect(source.match(/authenticatedBackendFetch\(/g)).toHaveLength(1);
    expect(source).toMatch(/cache: "no-store"/);
    expect(source).not.toMatch(/revalidatePath|unstable_cache|force-cache|"use cache"/);
    // Every exported action asks who is signed in before anything else.
    const bodies = source.split(/\nexport async function /).slice(1);
    expect(bodies).toHaveLength(5);
    for (const body of bodies) {
      const firstStatement = body.slice(body.indexOf("{\n") + 2).trimStart();
      expect(firstStatement.startsWith("const denied = await staffRefusal();\n  if (denied) return denied;")).toBe(true);
    }
    // The only methods, and the only routes: a read is a GET, a block or a reactivation a POST.
    expect([...new Set(source.match(/method: "[A-Z]+"/g))].sort()).toEqual(['method: "GET"', 'method: "POST"']);
    // Nothing deletes, replaces or patches: the quoted word itself is nowhere in the file, so a
    // method held in a variable, or picked by a condition, fails here too.
    for (const method of ["DELETE", "PUT", "PATCH"]) expect({ method, quoted: (source.match(new RegExp(`["'\`]${method}["'\`]`, "g")) ?? []).length }).toEqual({ method, quoted: 0 });
    expect(source).toMatch(/init: \{ method: "GET" \} \| \{ method: "POST"; body: Record<string, string> \},/);
    // One POST, the block or the reactivation of the organization, and it carries the reason alone.
    expect(source.match(/method: "POST"/g)).toHaveLength(2);
    expect(source).toMatch(/ask\("write", `\/\$\{organizationId\}\/\$\{write === "block" \? "block" : "reactivate"\}`, \{ method: "POST", body: \{ reason \} \}/);
    // Every method is written out where it is asked: the one that is not is the signed fetch being handed the action's own.
    expect(source.match(/\bmethod:(?! "[A-Z]+")[^\n]*/g)).toEqual(["method: init.method,"]);
    const routes = [...source.matchAll(/ask\("(read|write)", `([^`]+)`/g)].map((match) => `${match[1]} ${match[2]}`);
    expect(routes.sort()).toEqual(
      [
        "read /${organizationId}/members/${userId}",
        'write /${organizationId}/${write === "block" ? "block" : "reactivate"}',
        "read /${organizationId}/teams/${teamId}",
      ].sort(),
    );
    // A body is never the caller's object: every one is written out field by field.
    expect(source).not.toMatch(/body: (input|fields|raw)\b|\.\.\.(input|fields)/);
    expect(source).not.toMatch(/rfpIds:/);
  });

  it("has nothing that edits or deletes a proposal, a template or a vendor", () => {
    const actions = withoutComments(read(ACTIONS));
    expect(actions).not.toMatch(/\/proposals|\/templates|\/vendors|vendor-responses/);
    for (const file of screenFiles) {
      const source = withoutComments(read(file));
      // No route, path helper, component or action of customer content, except the Members list's
      // address and, for the team pages' way back, the Teams list's.
      expect({ file, content: /organization(Proposals?|VendorResponses|Templates?|Vendors|Section)Path|organizationContent"|@\/components\/organizations\/content\/(?!ContentChrome")/.test(source) }).toEqual({ file, content: false });
      // The Teams list's address is for the team files and the frame's "Teams" way back. Every
      // other management file keeps the ban: nothing of the member, ownership or block code leads there.
      if (!TEAM_FILES.includes(file) && file !== `${COMPONENTS}/ManageChrome.tsx`) expect({ file, teamsList: /organizationTeamsPath/.test(source) }).toEqual({ file, teamsList: false });
      expect({ file, list: /(list|get)Organization\w+Action/.test(source) }).toEqual({ file, list: false });
      // No icon and no label of an edit or delete control.
      expect({ file, icons: /\b(Pencil|PencilLine|Edit|Edit2|Edit3|SquarePen|Trash|Trash2|Share|Share2|Download|Upload|FileDown|Copy|Printer|Send|Save)\b,?/.test(source) }).toEqual({ file, icons: false });
      expect({ file, labels: />\s*(Edit|Delete|Remove|Share|Export|Download|Archive|Restore|Duplicate|Invite|Resend|Revoke|Save|Print|Copy)\b/.test(source) }).toEqual({ file, labels: false });
      expect({ file, other: /ChangePlanButton|organizationPlans"|allClients|adminUser|supportDesk|legacyCustomers"/.test(source) }).toEqual({ file, other: false });
    }
    // From the content browser only the shared look is taken: the focus outline and the badge.
    const fromContent = screenFiles.flatMap((file) => [...read(file).matchAll(/import \{([^}]+)\} from "@\/components\/organizations\/content\/ContentChrome";/g)].flatMap((match) => match[1].split(",").map((name) => name.trim())));
    expect([...new Set(fromContent)].sort()).toEqual(["ContentBadge", "focusRing"]);
  });

  it("never prefetches a recorded read: every Link into an organization page or a management page opts out", () => {
    const recorded = /organizationAccountPath\(|organization\w+Path\(|memberManagementPath\(|sessionRenewPath\(|retryHref|teamManagementPath\(|["'`{]\/organizations\/|["'`{]\/organization-management/;
    let found = 0;
    for (const file of everywhere.filter((path) => /\.tsx$/.test(path))) {
      const inFeature = file.startsWith(PAGES) || file.startsWith(COMPONENTS);
      for (const link of links(file)) {
        // Inside the feature the one link that may prefetch is the Organizations list, which is not a recorded read.
        if (inFeature && /href=\{ORGANIZATIONS_PATH\}/.test(link)) continue;
        if (!inFeature && !recorded.test(link)) continue;
        if (inFeature) expect({ file, link, recorded: recorded.test(link) }).toMatchObject({ recorded: true });
        found += 1;
        expect({ file, link, optsOut: /prefetch=\{false\}/.test(link) }).toMatchObject({ optsOut: true });
      }
      if (inFeature) expect({ file, prefetches: /router\.prefetch\(|prefetch=\{true\}/.test(read(file)) }).toEqual({ file, prefetches: false });
    }
    expect(found).toBeGreaterThanOrEqual(25);
    // The ways in from outside the feature: one per member, one per team, and the block or the reactivation.
    const members = read("components/organizations/content/MembersList.tsx");
    expect(members).toMatch(/<Link\s+href=\{memberManagementPath\(organizationId, member\.userId\)\}\s+prefetch=\{false\}\s+aria-label=\{`View \$\{personName\(member\)\}`\}/);
    expect(members.match(/<Link\b/g)).toHaveLength(1);
    const account = read("components/organizations/OrganizationAccount.tsx");
    expect(account).toMatch(/<Link\s+href=\{organizationWritePath\(organization\.id, "unblock"\)\}\s+prefetch=\{false\}/);
    expect(account).toMatch(/<Link\s+href=\{organizationWritePath\(organization\.id, "block"\)\}\s+prefetch=\{false\}/);
    expect(account.match(/<Link\b/g)).toHaveLength(2);
  });

  it("makes no backend read a page does not show", () => {
    // The member page: the member, once.
    const memberPage = read(`${ROOT}/members/[userId]/page.tsx`);
    expect(actionsIn(`${ROOT}/members/[userId]/page.tsx`)).toEqual(["getManagedMemberAction"]);
    expect(memberPage).toMatch(/await loadMemberPage\(\{ member: getManagedMemberAction \}, organizationId, userId\)/);
    expect(memberPage.match(/getManagedMemberAction/g)).toHaveLength(2);
    // The block and reactivate pages: the organization, once.
    const organizationScreen = read(`${COMPONENTS}/OrganizationWriteScreen.tsx`);
    expect(actionsIn(`${COMPONENTS}/OrganizationWriteScreen.tsx`)).toEqual(["getManagedOrganizationAction"]);
    expect(organizationScreen).toMatch(/await loadOrganizationWritePage\(\{ organization: getManagedOrganizationAction \}, organizationId, write\)/);
    expect(organizationScreen.match(/getManagedOrganizationAction/g)).toHaveLength(2);
    expect(organizationScreen).toMatch(/\{organizationLabel\(organization\)\}/);
    // Every other page file only hands its address to one of those two screens.
    const thin = sourceFiles(PAGES).filter((file) => /\/page\.tsx$/.test(file) && file !== `${ROOT}/members/[userId]/page.tsx` && !TEAM_PAGES.includes(file));
    expect(thin).toEqual([`${ROOT}/block/page.tsx`, `${ROOT}/reactivate/page.tsx`]);
    for (const file of thin) {
      const source = read(file);
      expect({ file, actions: actionsIn(file) }).toEqual({ file, actions: [] });
      expect({ file, screens: (source.match(/<OrganizationWriteScreen\b/g) ?? []).length }).toEqual({ file, screens: 1 });
    }
    // In the browser the flow reads nothing at all: the two actions it names are the two writes.
    expect(actionsIn(`${COMPONENTS}/WriteFlow.tsx`)).toEqual([...WRITE_ACTIONS].sort());
    // The member page and the team page are drawn on the server and send nothing.
    for (const file of [`${COMPONENTS}/MemberManagement.tsx`, `${COMPONENTS}/TeamManagement.tsx`]) {
      expect({ file, controls: /<button\b|<form\b|<input\b|onClick=|"use client"|Action\b/.test(read(file)) }).toEqual({ file, controls: false });
    }
    // No effect anywhere in the feature starts a read: the two effects kinds are focus only.
    for (const file of sourceFiles(COMPONENTS)) {
      for (const effect of read(file).match(/useEffect\(\(\) => \{[\s\S]*?\n  \}(, \[[^\]]*\])?\);/g) ?? []) {
        expect({ file, effect, reads: /Action\(|load\w*\(/.test(effect) }).toMatchObject({ reads: false });
      }
    }
  });


  it("renders each page for every request", () => {
    const pages = sourceFiles(PAGES).filter((file) => /\/page\.tsx$/.test(file));
    expect(pages).toHaveLength(3 + TEAM_PAGES.length);
    for (const page of pages) {
      expect({ page, dynamic: /export const dynamic = "force-dynamic";/.test(read(page)) }).toEqual({ page, dynamic: true });
      expect(read(page)).not.toMatch(/"use client"|revalidate|unstable_cache|generateStaticParams/);
    }
    // Nothing is read from an address besides the ids.
    expect(pages.filter((page) => /searchParams/.test(read(page)))).toEqual([]);
  });

  it("sends every write only through the confirmation gate, with the reviewed values", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    for (const action of WRITE_ACTIONS) expect({ action, calls: (flow.match(new RegExp(`\\b${action}\\(`, "g")) ?? []).length }).toEqual({ action, calls: 1 });
    // No other file calls a write.
    for (const file of screenFiles.filter((path) => path !== `${COMPONENTS}/WriteFlow.tsx`)) {
      for (const action of WRITE_ACTIONS) expect({ file, action, named: new RegExp(`\\b${action}\\b`).test(read(file)) }).toEqual({ file, action, named: false });
    }
    // Both sit in one function, which the gate alone calls.
    const send = flow.slice(flow.indexOf("const sendWrite = async"), flow.indexOf("export default function WriteFlow"));
    for (const action of WRITE_ACTIONS) expect(send).toMatch(new RegExp(`\\b${action}\\(`));
    expect(flow.match(/\bsendWrite\(/g)).toHaveLength(1);
    expect(flow).toMatch(/createWriteGate<Answered>\(\{\s*send: \(\) => sendWrite\(kind, organization\.id, request\),\s*succeeded: \(result\) => result\.ok,\s*requiredName,\s*onChange: setGateState,/);
    expect(flow.match(/createWriteGate</g)).toHaveLength(1);
    expect(flow.match(/gate\.submit\(\)/g)).toHaveLength(1);
    // The confirm control is off until the confirmation is given and while a request is in flight.
    expect(flow).toMatch(/<button type="submit" disabled=\{!gateState\.confirmed \|\| busy\} className=\{copy\.danger \? dangerButton : primaryButton\}>/);
    expect(flow).toMatch(/const busy = gateState\.inFlight \|\| gateState\.done;/);
    // A block is confirmed by the organization's name, typed; a reactivation by a tick.
    expect(flow).toMatch(/const requiredName = kind === "block" \? confirmationPhrase\(organization\) : undefined;/);
    expect(flow).toMatch(/onChange=\{\(event\) => gate\.setTypedName\(event\.target\.value\)\}/);
    expect(flow).toMatch(/onChange=\{\(event\) => gate\.setAcknowledged\(event\.target\.checked\)\}/);
    // Only the reviewed reason is sent, written out per write.
    expect(send.match(/\{ reason: request\.reason \}/g)).toHaveLength(2);
    expect(send).not.toMatch(/rfpIds|\.\.\.request|version|userId|member/);
    // A request with no answer may have been saved.
    expect(send).toMatch(/\} catch \{[\s\S]*?return refused\("outcome_unknown"\);/);
  });

  it("shows the result from the API's answer, with the way back, and makes no read to show it", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/onDone=\{\(answer\) => setDone\(answer\)\}/);
    const result = flow.slice(flow.indexOf("function ResultStep("));
    expect(result).toMatch(/const summary = resultSummary\(\{ organization \}, answer\);/);
    expect(result).not.toMatch(/Action\(/);
    expect(result).toMatch(/<Link href=\{organizationAccountPath\(organization\.id\)\} prefetch=\{false\} className=\{linkClass\}>\s*Back to the organization/);
    expect(result).toMatch(/role="status" aria-live="polite"/);
  });

  it("leads from an unconfirmed block or reactivation to the organization, to check", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/refusal\.failure === "outcome_unknown" \? \(\s*<Link href=\{organizationAccountPath\(organization\.id\)\} prefetch=\{false\} className=\{linkClass\}>\s*Open the organization to check/);
    // The flow is handed the organization's name, standing and block, never its Owner, and reads nothing itself.
    expect(flow).not.toMatch(/organization\.owner/);
    expect(actionsIn(`${COMPONENTS}/WriteFlow.tsx`)).not.toContain("getManagedOrganizationAction");
  });

  it("shows a refusal as fixed wording with the code beside it, and announces it", () => {
    const chrome = read(`${COMPONENTS}/ManageChrome.tsx`);
    expect(chrome.match(/managementFailureCopy\(refusal\)/g)).toHaveLength(2);
    expect(chrome.match(/<RefusalCode code=\{refusal\.code\} \/>/g)).toHaveLength(2);
    expect(chrome).toMatch(/Code: <span className="break-all font-mono">\{code\}<\/span>/);
    expect(chrome).toMatch(/<div role="alert"/);
    expect(chrome).toMatch(/role=\{calm \? "status" : "alert"\}/);
    // Nothing the backend wrote is drawn: no component reads a message or an error off an answer.
    for (const file of sourceFiles(COMPONENTS)) expect({ file, text: /\.message\b(?!\})|\.error\b|dangerouslySetInnerHTML/.test(withoutComments(read(file)).replace(/copy\.message|\{message\}/g, "")) }).toEqual({ file, text: false });
    // A refused write moves focus to the refusal, which sits above the confirmation.
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/useEffect\(\(\) => \{\s*if \(refusal\) refusalNote\.current\?\.focus\(\);\s*\}, \[refusal\]\);/);
    const review = flow.slice(flow.indexOf("function ReviewStep("), flow.indexOf("const ReviewFact"));
    const note = review.indexOf("<div ref={refusalNote}");
    const confirmation = review.indexOf("{requiredName !== undefined ? (");
    const submit = review.indexOf('<button type="submit"');
    expect(note).toBeGreaterThan(0);
    expect(note).toBeLessThan(confirmation);
    expect(confirmation).toBeLessThan(submit);
  });

  it("asks for the reason with a visible counter and the API's own rule", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    const field = flow.slice(flow.indexOf("const ReasonField"), flow.indexOf("const EffectLists"));
    expect(field).toMatch(/<textarea\s+id=\{id\}\s+required/);
    expect(field).toMatch(/aria-describedby=\{`\$\{id\}-hint \$\{id\}-count/);
    expect(field).toMatch(/Required\. \{REASON_RULE\}/);
    expect(field).toMatch(/\{length\.toLocaleString\("en-US"\)\} of \{REASON_MAX\} characters/);
    expect(flow.match(/<ReasonField\b/g)).toHaveLength(1);
    expect(read(`${LIB}/management.ts`)).toMatch(/export const REASON_RULE = `Give a reason of \$\{REASON_MIN\} to \$\{REASON_MAX\} characters\.`;/);
  });

  it("draws the member page with no control at all: the member, and the way back", () => {
    const page = read(`${COMPONENTS}/MemberManagement.tsx`);
    expect(page).toMatch(/<MemberSummary member=\{managed\.member\} eyebrow="Member" \/>/);
    expect(page).not.toMatch(/What you can change|Each change opens its own page/);
    expect(page.match(/<Link\b/g)).toHaveLength(1);
    expect(page).toMatch(/<Link href=\{organizationMembersPath\(organizationId\)\} prefetch=\{false\} className=\{linkClass\}>\s*Back to the Members list/);
    // Nothing is sent from the member page: it has no control but that link.
    expect(page).not.toMatch(/<button\b|<form\b|<input\b|onClick=|"use client"|Action\b/);
    expect(read(`${ROOT}/members/[userId]/page.tsx`)).toMatch(/<ManageFrame organizationId=\{known\} viewOnly>/);
  });

  it("uses the tested rule for the block link", () => {
    // The detail page decides "Block organization" with the management pages' own rule.
    const account = read("components/organizations/OrganizationAccount.tsx");
    expect(account).toMatch(/const canBlock = organizationWritesFor\(\{ standing: organization\.standing, blocked: organization\.blocked \?\? null \}\)\.includes\("block"\);/);
    expect(account).not.toMatch(/organization\.standing === "inactive"/);
  });

  it("gives every control a name and a visible keyboard focus", () => {
    const elements = (source: string, open: RegExp, close: (name: string) => string) =>
      [...source.matchAll(open)].map((match) => {
        const end = source.indexOf(close(match[1]), match.index);
        return source.slice(match.index, end === -1 ? undefined : end);
      });
    let controls = 0;
    for (const file of sourceFiles(COMPONENTS)) {
      const source = read(file);
      for (const element of elements(source, /<(button|Link)\b/g, (name) => `</${name}>`)) {
        controls += 1;
        expect({ file, element, focus: /focusRing|linkClass|backClass|linkButton|dangerLinkButton|primaryButton|secondaryButton|dangerButton/.test(element) }).toMatchObject({ focus: true });
        // Every one has words inside it: none is an icon alone.
        expect({ file, element, named: /aria-label=|>\s*[A-Z{][^<]*$|\}\s*$|[a-z.]\s*$/.test(element) }).toMatchObject({ named: true });
      }
      // Every field is tied to a label by its id, or sits inside its label (the radio buttons).
      for (const element of elements(source, /<(input|select|textarea)\b/g, (name) => (name === "input" ? "/>" : name === "select" ? "</select>" : "/>"))) {
        controls += 1;
        expect({ file, element, named: /\bid=\{/.test(element) || /type="radio"/.test(element) }).toMatchObject({ named: true });
        expect({ file, element, focus: /inputClass|accent-/.test(element) }).toMatchObject({ focus: true });
      }
      expect(source).not.toMatch(/tabIndex=\{[1-9]|tabIndex="[1-9]/);
    }
    expect(controls).toBeGreaterThanOrEqual(18);
    // A checkbox or radio shows its focus on the label around it.
    for (const file of [`${COMPONENTS}/WriteFlow.tsx`]) expect(read(file)).toMatch(/has-\[:focus-visible\]:outline has-\[:focus-visible\]:outline-2/);
    const chrome = read(`${COMPONENTS}/ManageChrome.tsx`);
    expect(chrome).toMatch(/import \{ ContentBadge, focusRing \} from "@\/components\/organizations\/content\/ContentChrome";/);
    for (const name of ["linkClass", "primaryButton", "dangerButton", "secondaryButton"]) {
      expect(chrome).toMatch(new RegExp(`export const ${name} =[^;]*\\$\\{focusRing\\}`));
    }
    expect(chrome).toMatch(/export const inputClass =\s*"[^"]*focus:border-\[#00aeb5\] focus:ring-4/);
    // The two links on the detail page, the one on the Members list and the one on the Teams list carry the same outline.
    for (const file of ["components/organizations/OrganizationAccount.tsx", "components/organizations/content/MembersList.tsx", "components/organizations/content/TeamsList.tsx"]) {
      for (const link of elements(read(file), /<(Link)\b/g, (name) => `</${name}>`)) expect({ file, link, focus: /\$\{focusRing\}|className=\{staffLink\}/.test(link) }).toMatchObject({ focus: true });
    }
  });

  it("keeps wide content inside a phone screen", () => {
    for (const file of sourceFiles(COMPONENTS)) {
      const source = read(file);
      expect({ file, fixed: source.match(/min-w-\[\d+px\]|(?<!max-)\bw-\[\d{3,}px\]|<table\b|whitespace-nowrap/g) ?? [] }).toEqual({ file, fixed: [] });
    }
    // Names, emails, ids and the typed reason wrap.
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/block break-words \$\{preserve \? "whitespace-pre-wrap" : "font-bold"\}/);
    expect(flow).toMatch(/block break-all font-mono/);
  });

  it("shows the blocked state on the detail page from the account answer, with the date in UTC", () => {
    const account = read("components/organizations/OrganizationAccount.tsx");
    expect(account).toMatch(/\{organization\.blocked\.at \? `Blocked since \$\{formatContentDate\(organization\.blocked\.at\)\}` : "Blocked \(the date is not recorded\)"\}/);
    expect(account).toMatch(/\{organization\.blocked \? \(\s*<section\s+aria-label="This organization is blocked"/);
    // The block link sits in its own danger area, and only for an organization that can be blocked.
    expect(account).toMatch(/const canBlock = organizationWritesFor\(\{ standing: organization\.standing, blocked: organization\.blocked \?\? null \}\)\.includes\("block"\);/);
    expect(account).toMatch(/\{canBlock \? \(\s*<section aria-labelledby="danger-area"[\s\S]*?Danger area[\s\S]*?Block organization\s*<\/Link>/);
    expect(read("lib/organizationContent/content.ts")).toMatch(/timeZone: "UTC" \}\)\} UTC`;/);
    // The detail page still sends nothing itself.
    expect(account).not.toMatch(/Action\b|<button\b|<form\b/);
  });
});

describe("the team page", () => {
  const pageFile = `${COMPONENTS}/TeamManagement.tsx`;

  it("has every team file under the management addresses, and none in the view-only browser", () => {
    for (const file of TEAM_FILES) {
      expect({ file, there: screenFiles.includes(file) }).toEqual({ file, there: true });
      expect({ file, inside: file.startsWith("app/(page)/organizations/") || file.startsWith("components/organizations/content/") }).toEqual({ file, inside: false });
    }
    expect(sourceFiles(PAGES).filter((file) => /\/teams\//.test(file)).sort()).toEqual([...TEAM_PAGES].sort());
  });

  it("calls the team read only from the team page, and has no team write to call", () => {
    const names = new RegExp(`\\b(${TEAM_READ_ACTIONS.join("|")})\\b`);
    for (const file of everywhere) {
      if (file === ACTIONS || TEAM_FILES.includes(file)) continue;
      expect({ file, names: names.test(read(file)) }).toEqual({ file, names: false });
    }
    // No source file names an action that would write to a team or to a member's teams.
    for (const file of everywhere) expect({ file, teamWrite: /\b(create|rename|archive|add|remove|set)\w*Team\w*Action\b/.test(read(file)) }).toEqual({ file, teamWrite: false });
  });

  it("sits in the frame that says the page is view only, beside the block pages' own note", () => {
    expect(read(`${ROOT}/teams/[teamId]/page.tsx`)).toMatch(/<ManageFrame organizationId=\{known\} teams viewOnly>/);
    const chrome = read(`${COMPONENTS}/ManageChrome.tsx`);
    expect(chrome).toMatch(/Proposals, templates and vendors can&apos;t be changed from here\./);
    expect(chrome).toMatch(/View only\. Members, teams, proposals, templates and vendors can&apos;t be changed from here\. Each page you open is recorded on the\s+RFPilot side\./);
    expect(chrome).toMatch(/\{viewOnly \? <ViewOnlyNote \/> : <ManagementNote \/>\}/);
    // The block and reactivate pages keep the note of a page that changes something.
    expect(read(`${COMPONENTS}/OrganizationWriteScreen.tsx`)).not.toMatch(/viewOnly/);
  });

  it("makes no backend read the team page does not show", () => {
    // The team page: the team, once.
    const teamPage = read(`${ROOT}/teams/[teamId]/page.tsx`);
    expect(actionsIn(`${ROOT}/teams/[teamId]/page.tsx`)).toEqual(["getManagedTeamAction"]);
    expect(teamPage).toMatch(/await loadTeamPage\(\{ team: getManagedTeamAction \}, organizationId, teamId\)/);
    expect(teamPage.match(/getManagedTeamAction/g)).toHaveLength(2);
    expect(teamPage).toMatch(/<TeamManagement organizationId=\{organizationId\} managed=\{result\.data\} \/>/);
    // The team page and the team summary send and read nothing.
    const page = read(pageFile);
    expect(page).not.toMatch(/<button\b|<form\b|<input\b|onClick=|"use client"|Action\b/);
  });

  it("shows the backend's counts, and says when a list is shorter than its count", () => {
    const page = read(pageFile);
    expect(page).toMatch(/const cut = memberListNote\(managed\);/);
    expect(page.match(/countLabel\(team\.memberCount, "member"\)/g)).toHaveLength(2);
    expect(page).toMatch(/\{cut \? `\. \$\{cut\}` : "\."\}/);
    // The manager note is decided by how many rows the answer held, on every page that shows the team.
    expect(page).toMatch(/const cut = managerListNote\(\{ team, managersListed \}\);/);
    expect(page).toMatch(/<TeamSummary team=\{team\} managersListed=\{managed\.managersListed\} eyebrow="Team" \/>/);
    // The count is never taken from the length of a list.
    expect(page).not.toMatch(/countLabel\(members\.length|members\.length\.toLocaleString|managers\.length\.toLocaleString/);
    // Dates are UTC and labelled.
    expect(page.match(/formatContentDate\(/g)).toHaveLength(2);
    for (const file of TEAM_COMPONENTS) expect({ file, local: /toLocaleDateString|toLocaleTimeString|new Date\(/.test(read(file)) }).toEqual({ file, local: false });
  });

  it("has no control over a team, a proposal, a template or a vendor", () => {
    for (const file of TEAM_FILES) {
      const source = withoutComments(read(file));
      expect({ file, content: /organization(Proposals?|VendorResponses|Templates?|Vendors|Section)Path|\/proposals|\/templates|\/vendors|vendor-responses|rfpIds|proposalId|templateId|vendorId/.test(source) }).toEqual({ file, content: false });
      expect({ file, list: /(list|get)Organization\w+Action/.test(source) }).toEqual({ file, list: false });
    }
    const page = read(pageFile);
    expect(page).not.toMatch(/What you can change|Each change opens its own page|teamWritePath|teamMemberWritePath|TEAM_WRITE_COPY/);
    // Its only links: each listed member's own page, and the way back to the Teams list.
    expect(page.match(/<Link\b/g)).toHaveLength(2);
  });

  it("leads in from the Teams list and the frame with links that never prefetch", () => {
    const list = read("components/organizations/content/TeamsList.tsx");
    expect(list).toMatch(/<Link href=\{teamManagementPath\(organizationId, team\.id\)\} prefetch=\{false\} aria-label=\{`View \$\{team\.name\}`\} className=\{staffLink\}>\s*View\s*<\/Link>/);
    expect(list).not.toMatch(/Create a team|teamCreatePath|controls=/);
    expect(list.match(/<Link\b/g)).toHaveLength(1);
    expect(list).toMatch(/const staffLink = `[^`]*\$\{focusRing\}`;/);
    // The view-only list still sends nothing itself.
    expect(list).not.toMatch(/Action\b|<button\b|<form\b|onClick=|"use client"/);
    const chrome = read(`${COMPONENTS}/ManageChrome.tsx`);
    expect(chrome).toMatch(/\{teams \? \(\s*<Link href=\{organizationTeamsPath\(organizationId\)\} prefetch=\{false\} className=\{backClass\}>\s*Teams\s*<\/Link>/);
    // Every Link in a team file opts out, whatever it leads to.
    let found = 0;
    for (const file of TEAM_FILES.filter((path) => /\.tsx$/.test(path))) {
      for (const link of links(file)) {
        found += 1;
        expect({ file, link, optsOut: /prefetch=\{false\}/.test(link) }).toMatchObject({ optsOut: true });
      }
    }
    expect(found).toBeGreaterThanOrEqual(2);
  });

  it("names the view-only pages and the block flow in the repo's notes", () => {
    const notes = read("CLAUDE.md");
    expect(notes).toMatch(/\*\*Organization management\*\* \(owner decision, 2026-11-24,/);
    expect(notes).toMatch(/`lib\/organizationManagement\/teams\.ts`/);
    expect(notes).toMatch(/`app\/actions\/staffViewOnly\.test\.ts`/);
    expect(notes).not.toMatch(/\*\*Team management\*\*|Change teams|transfer ownership, and block/);
  });
});

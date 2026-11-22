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

const READ_ACTIONS = ["getManagedMemberAction", "getManagedOrganizationAction", "listReassignCandidatesAction"];
const WRITE_ACTIONS = [
  "changeMemberRoleAction",
  "deactivateMemberAction",
  "reactivateMemberAction",
  "reassignMemberProposalsAction",
  "transferOwnershipAction",
  "blockOrganizationAction",
  "reactivateOrganizationAction",
];
const actionsIn = (file: string) => [...new Set(withoutComments(read(file)).match(/\b\w+Action\b/g) ?? [])].sort();

describe("the staff management screens", () => {
  it("covers every file of the feature", () => {
    expect(screenFiles.sort()).toEqual(
      [
        `${ROOT}/block/page.tsx`,
        `${ROOT}/loading.tsx`,
        `${ROOT}/members/[userId]/deactivate/page.tsx`,
        `${ROOT}/members/[userId]/page.tsx`,
        `${ROOT}/members/[userId]/reactivate/page.tsx`,
        `${ROOT}/members/[userId]/reassign-proposals/page.tsx`,
        `${ROOT}/members/[userId]/role/page.tsx`,
        `${ROOT}/members/[userId]/transfer-ownership/page.tsx`,
        `${ROOT}/reactivate/page.tsx`,
        `${COMPONENTS}/ManageChrome.tsx`,
        `${COMPONENTS}/MemberManagement.tsx`,
        `${COMPONENTS}/MemberWriteScreen.tsx`,
        `${COMPONENTS}/OrganizationWriteScreen.tsx`,
        `${COMPONENTS}/ReassignTargetPicker.tsx`,
        `${COMPONENTS}/WriteFlow.tsx`,
        `${LIB}/confirmGate.ts`,
        `${LIB}/management.ts`,
      ].sort(),
    );
  });

  it("lives outside the view-only content browser, and adds no page to it", () => {
    for (const file of screenFiles) {
      expect({ file, inside: file.startsWith("app/(page)/organizations/") || file.startsWith("components/organizations/content/") }).toEqual({ file, inside: false });
    }
    const lib = read(`${LIB}/management.ts`);
    expect(lib).toMatch(/export const MANAGEMENT_PATH = "\/organization-management";/);
    // No team management here: that is a separate ticket.
    for (const file of [...screenFiles, ACTIONS]) expect({ file, teams: /\/teams\b|TeamAction|team-management/.test(withoutComments(read(file))) }).toEqual({ file, teams: false });
  });

  it("is the only caller of the management actions", () => {
    const callers = everywhere.filter((file) => file !== ACTIONS && /@\/app\/actions\/organizationManagement"/.test(read(file)));
    for (const file of callers) expect({ file, inside: file.startsWith(PAGES) || file.startsWith(COMPONENTS) }).toEqual({ file, inside: true });
    expect(callers.sort()).toEqual([
      `${ROOT}/members/[userId]/page.tsx`,
      `${COMPONENTS}/MemberWriteScreen.tsx`,
      `${COMPONENTS}/OrganizationWriteScreen.tsx`,
      `${COMPONENTS}/ReassignTargetPicker.tsx`,
      `${COMPONENTS}/WriteFlow.tsx`,
    ]);
    // And no file outside the feature names one of them in any other way.
    const names = new RegExp(`\\b(${[...READ_ACTIONS, ...WRITE_ACTIONS].join("|")})\\b`);
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
    for (const action of actionsIn(file)) expect([...READ_ACTIONS, ...WRITE_ACTIONS]).toContain(action);
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
    expect(bodies).toHaveLength(10);
    for (const body of bodies) {
      const firstStatement = body.slice(body.indexOf("{\n") + 2).trimStart();
      expect(firstStatement.startsWith("const denied = await staffRefusal();\n  if (denied) return denied;")).toBe(true);
    }
    // The only methods, and the only routes.
    expect([...new Set(source.match(/method: "[A-Z]+"/g))].sort()).toEqual(['method: "GET"', 'method: "PATCH"', 'method: "POST"']);
    expect(source).not.toMatch(/DELETE|PUT\b/);
    const routes = [...source.matchAll(/ask\("(read|write)", `([^`]+)`/g)].map((match) => `${match[1]} ${match[2]}`);
    expect(routes.sort()).toEqual(
      [
        "read /${organizationId}/members/${userId}",
        "write /${organizationId}/members/${userId}/role",
        "write /${organizationId}/members/${userId}/${route}",
        "write /${organizationId}/members/${userId}/reassign-rfps",
        "write /${organizationId}/ownership/transfer",
        'write /${organizationId}/${write === "block" ? "block" : "reactivate"}',
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
      // No route, path helper, component or action of customer content, except the Members list's address.
      expect({ file, content: /organization(Proposals?|VendorResponses|Templates?|Vendors|Teams|Section)Path|organizationContent"|@\/components\/organizations\/content\/(?!ContentChrome")/.test(source) }).toEqual({ file, content: false });
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
    const recorded = /organizationAccountPath\(|organization\w+Path\(|memberManagementPath\(|memberWritePath\(|reassignBeforeDeactivatePath\(|sessionRenewPath\(|retryHref|["'`{]\/organizations\/|["'`{]\/organization-management/;
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
    expect(found).toBeGreaterThanOrEqual(30);
    // The two ways in from outside the feature.
    const members = read("components/organizations/content/MembersList.tsx");
    expect(members).toMatch(/<Link\s+href=\{memberManagementPath\(organizationId, member\.userId\)\}\s+prefetch=\{false\}\s+aria-label=\{`Manage \$\{personName\(member\)\}`\}/);
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
    // A member write page: the member and the organization, through the tested loader, once each.
    const writeScreen = read(`${COMPONENTS}/MemberWriteScreen.tsx`);
    expect(actionsIn(`${COMPONENTS}/MemberWriteScreen.tsx`)).toEqual(["getManagedMemberAction", "getManagedOrganizationAction"]);
    expect(writeScreen).toMatch(/await loadMemberWritePage\(\{ member: getManagedMemberAction, organization: getManagedOrganizationAction \}, organizationId, userId, write\)/);
    expect(writeScreen.match(/getManaged(Member|Organization)Action/g)).toHaveLength(4);
    // What was read is shown: the member's summary and the flow that names the organization.
    expect(writeScreen).toMatch(/<MemberSummary member=\{load\.member\.member\}/);
    expect(writeScreen).toMatch(/<WriteFlow kind=\{write\} organization=\{load\.organization\} member=\{load\.member\}/);
    // The block and reactivate pages: the organization, once.
    const organizationScreen = read(`${COMPONENTS}/OrganizationWriteScreen.tsx`);
    expect(actionsIn(`${COMPONENTS}/OrganizationWriteScreen.tsx`)).toEqual(["getManagedOrganizationAction"]);
    expect(organizationScreen).toMatch(/await loadOrganizationWritePage\(\{ organization: getManagedOrganizationAction \}, organizationId, write\)/);
    expect(organizationScreen.match(/getManagedOrganizationAction/g)).toHaveLength(2);
    expect(organizationScreen).toMatch(/\{organizationLabel\(organization\)\}/);
    // Every other page file only hands its address to one of those two screens.
    const thin = sourceFiles(PAGES).filter((file) => /\/page\.tsx$/.test(file) && file !== `${ROOT}/members/[userId]/page.tsx`);
    expect(thin).toHaveLength(7);
    for (const file of thin) {
      const source = read(file);
      expect({ file, actions: actionsIn(file) }).toEqual({ file, actions: [] });
      expect({ file, screens: (source.match(/<(MemberWriteScreen|OrganizationWriteScreen)\b/g) ?? []).length }).toEqual({ file, screens: 1 });
    }
    // In the browser: the member is read again only from the control that says so, and the
    // members to choose from only from a press, one page at a time.
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow.match(/getManagedMemberAction\(/g)).toHaveLength(1);
    expect(flow).toMatch(/const loadCurrentMember = async \(\) => \{[\s\S]*?result = await getManagedMemberAction\(organization\.id, managed\.member\.userId\);/);
    expect(flow.match(/onClick=\{onLoadCurrentMember\}/g)).toHaveLength(1);
    expect(flow).toMatch(/"Load the current member"/);
    const picker = read(`${COMPONENTS}/ReassignTargetPicker.tsx`);
    expect(actionsIn(`${COMPONENTS}/ReassignTargetPicker.tsx`)).toEqual(["listReassignCandidatesAction"]);
    expect(picker.match(/listReassignCandidatesAction\(/g)).toHaveLength(1);
    // The member the proposals come from goes with the request: who can receive them is decided on the server.
    expect(picker).toMatch(/await listReassignCandidatesAction\(organizationId, fromUserId, page\);/);
    expect(picker).toMatch(/const others = ready \? ready\.notEligibleCount : 0;/);
    expect(picker.match(/\bload\(/g)).toHaveLength(3);
    for (const call of picker.match(/.*\bload\(.*/g) ?? []) expect(call).toMatch(/onClick=\{\(\) => load\(/);
    // No effect anywhere in the feature starts a read: the two effects kinds are focus only.
    for (const file of sourceFiles(COMPONENTS)) {
      for (const effect of read(file).match(/useEffect\(\(\) => \{[\s\S]*?\n  \}(, \[[^\]]*\])?\);/g) ?? []) {
        expect({ file, effect, reads: /Action\(|load\w*\(/.test(effect) }).toMatchObject({ reads: false });
      }
    }
  });

  it("renders each page for every request", () => {
    const pages = sourceFiles(PAGES).filter((file) => /\/page\.tsx$/.test(file));
    expect(pages).toHaveLength(8);
    for (const page of pages) {
      expect({ page, dynamic: /export const dynamic = "force-dynamic";/.test(read(page)) }).toEqual({ page, dynamic: true });
      expect(read(page)).not.toMatch(/"use client"|revalidate|unstable_cache|generateStaticParams/);
    }
    // The one value read from an address besides the ids: a fixed word, compared exactly.
    const withQuery = pages.filter((page) => /searchParams/.test(read(page)));
    expect(withQuery).toEqual([`${ROOT}/members/[userId]/reassign-proposals/page.tsx`]);
    expect(read(withQuery[0])).toMatch(/const continueToDeactivate = \(await searchParams\)\?\.then === "deactivate";/);
  });

  it("sends every write only through the confirmation gate, with the reviewed values", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    for (const action of WRITE_ACTIONS) expect({ action, calls: (flow.match(new RegExp(`\\b${action}\\(`, "g")) ?? []).length }).toEqual({ action, calls: 1 });
    // No other file calls a write.
    for (const file of screenFiles.filter((path) => path !== `${COMPONENTS}/WriteFlow.tsx`)) {
      for (const action of WRITE_ACTIONS) expect({ file, action, named: new RegExp(`\\b${action}\\b`).test(read(file)) }).toEqual({ file, action, named: false });
    }
    // All seven sit in one function, which the gate alone calls.
    const send = flow.slice(flow.indexOf("const sendWrite = async"), flow.indexOf("export default function WriteFlow"));
    for (const action of WRITE_ACTIONS) expect(send).toMatch(new RegExp(`\\b${action}\\(`));
    expect(flow.match(/\bsendWrite\(/g)).toHaveLength(1);
    expect(flow).toMatch(/createWriteGate<Answered>\(\{\s*send: \(\) => sendWrite\(kind, organization\.id, member, request\),\s*succeeded: \(result\) => result\.ok,\s*requiredName,\s*onChange: setGateState,/);
    expect(flow.match(/createWriteGate</g)).toHaveLength(1);
    expect(flow.match(/gate\.submit\(\)/g)).toHaveLength(1);
    // The confirm control is off until the confirmation is given and while a request is in flight.
    expect(flow).toMatch(/<button type="submit" disabled=\{!gateState\.confirmed \|\| busy\} className=\{copy\.danger \? dangerButton : primaryButton\}>/);
    expect(flow).toMatch(/const busy = gateState\.inFlight \|\| gateState\.done;/);
    // A transfer and a block are confirmed by the organization's name, typed.
    expect(flow).toMatch(/const requiredName = kind === "transfer" \|\| kind === "block" \? confirmationPhrase\(organization\) : undefined;/);
    expect(flow).toMatch(/onChange=\{\(event\) => gate\.setTypedName\(event\.target\.value\)\}/);
    expect(flow).toMatch(/onChange=\{\(event\) => gate\.setAcknowledged\(event\.target\.checked\)\}/);
    // The version sent is the one of the member as loaded; the body is written out per write.
    expect(send.match(/version: member\.version/g)).toHaveLength(4);
    expect(send).not.toMatch(/rfpIds|\.\.\.request|\.\.\.member/);
    // A request with no answer may have been saved.
    expect(send).toMatch(/\} catch \{[\s\S]*?return refused\("outcome_unknown"\);/);
  });

  it("offers one resend after an unknown outcome that turned out saved, through the same gate", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    // The review tells the flow when an answer left the outcome unknown; a new review forgets it.
    expect(flow).toMatch(/if \(outcome\.result\.failure === "outcome_unknown"\) onUnknownOutcome\(\);/);
    expect(flow).toMatch(/const toReview = \(\) => \{[\s\S]*?setUnknownRequest\(null\);/);
    // Only the member loaded again decides it, with the tested view model.
    expect(flow).toMatch(/const shown = unknownRequest \? unknownOutcomeFollowUp\(kind, \{ organization, member: result\.data\.member \}, unknownRequest\) : null;/);
    // It comes before the "not available for this member now" state, which it replaces.
    expect(flow.indexOf("if (saved && managed && followUp) {")).toBeGreaterThan(0);
    expect(flow.indexOf("if (saved && managed && followUp) {")).toBeLessThan(flow.indexOf("is not available for this member now"));
    // The resend is the review step itself: same gate, same one sendWrite, the new version.
    expect(flow).toMatch(/return followUp\.resend \? \(\s*<ReviewStep\s+key=\{`finish-\$\{saved\.id\}`\}\s+kind=\{kind\}\s+organization=\{organization\}\s+member=\{managed\}\s+request=\{saved\.request\}\s+finish=\{followUp\}/);
    expect(flow).toMatch(/\) : \(\s*<SavedStep organizationId=\{organization\.id\} memberId=\{managed\.member\.userId\} followUp=\{followUp\} \/>/);
    expect(flow.match(/<ReviewStep\b/g)).toHaveLength(2);
    expect(flow).toMatch(/onDone=\{\(answer\) => setDone\(\{ request: saved\.request, answer, history: \{ finishingSignOut: true \} \}\)\}/);
    // The step with no resend sends nothing at all.
    const savedStep = flow.slice(flow.indexOf("function SavedStep("), flow.indexOf("function ResultStep("));
    expect(savedStep).not.toMatch(/Action\(|<button\b|<form\b|gate\./);
  });

  it("names the Owner a transfer demotes only as the Owner when the page loaded, on the form and the review", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/\{currentOwnerLine\(organization\)\} An organization has exactly one Owner\./);
    expect(flow).not.toMatch(/The current Owner\{owner|organization\.owner/);
    // Loading the current member again reads the member only: the organization is not read again.
    expect(actionsIn(`${COMPONENTS}/WriteFlow.tsx`)).not.toContain("getManagedOrganizationAction");
  });

  it("remembers an unconfirmed attempt for as long as the page lives, and tells the result", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/const outcomeUnknown = \(request: WriteRequest\) => \{\s*setUnknownRequest\(request\);\s*setEverUnknown\(true\);/);
    expect(flow.match(/setEverUnknown\(/g)).toHaveLength(1);
    expect(flow).toMatch(/history=\{\{ \.\.\.done\.history, afterUnknownOutcome: everUnknown \}\}/);
  });

  it("starts the flow again when the page reads the member again", () => {
    // The flow's client state (the member, the open review, a refusal, the gate) is keyed by the member as read.
    const writeScreen = read(`${COMPONENTS}/MemberWriteScreen.tsx`);
    expect(writeScreen).toMatch(/<WriteFlow kind=\{write\} organization=\{load\.organization\} member=\{load\.member\} continueToDeactivate=\{continueToDeactivate\} key=\{flowKey\(write, load\.member\)\} \/>/);
    // "Open this page again" after OWNER_CHANGED is a full load, not a same-route Link that keeps the state.
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/refusal\.failure === "owner_changed" && memberId \? \(\s*(\/\/.*\s*)*<a href=\{memberWritePath\(organization\.id, memberId, "transfer"\)\} className=\{linkClass\}>\s*Open this page again\s*<\/a>/);
    expect(flow.match(/<a\b/g)).toHaveLength(1);
    expect(flow).not.toMatch(/<Link[^>]*>\s*Open this page again/);
  });

  it("shows the result from the API's answer, with the ways back, and makes no read to show it", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/onDone=\{\(answer\) => setDone\(\{ request: review\.request, answer \}\)\}/);
    const result = flow.slice(flow.indexOf("function ResultStep("));
    expect(result).toMatch(/const summary = resultSummary\(kind, \{ organization, member: member\?\.member \}, request, answer, history\);/);
    expect(result).not.toMatch(/Action\(/);
    expect(result).toMatch(/<Link href=\{memberManagementPath\(organization\.id, memberId\)\} prefetch=\{false\} className=\{linkClass\}>\s*Back to this member/);
    expect(result).toMatch(/<Link href=\{organizationMembersPath\(organization\.id\)\} prefetch=\{false\} className=\{linkClass\}>\s*Members list/);
    expect(result).toMatch(/<Link href=\{organizationAccountPath\(organization\.id\)\} prefetch=\{false\} className=\{linkClass\}>\s*Back to the organization/);
    expect(result).toMatch(/<Link href=\{memberWritePath\(organization\.id, memberId, "deactivate"\)\} prefetch=\{false\} className=\{linkClass\}>\s*Continue to deactivate this member/);
    expect(result).toMatch(/role="status" aria-live="polite"/);
  });

  it("leads from a refused deactivation into reassigning the member's proposals, and back", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(
      /refusal\.failure === "owner_has_proposals" && memberId \? \(\s*<Link href=\{kind === "deactivate" \? reassignBeforeDeactivatePath\(organization\.id, memberId\) : memberWritePath\(organization\.id, memberId, "reassign"\)\} prefetch=\{false\}/,
    );
    expect(read(`${COMPONENTS}/MemberWriteScreen.tsx`)).toMatch(/continueToDeactivate=\{continueToDeactivate\}/);
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

  it("offers a role only from the list the API accepts", () => {
    const flow = read(`${COMPONENTS}/WriteFlow.tsx`);
    expect(flow).toMatch(/\{\(member \? roleChoicesFor\(member\.member\) : \[\]\)\.map\(\(role\) => \(\s*<option key=\{role\} value=\{role\}>/);
    expect(flow).not.toMatch(/value="owner"/);
    expect(read(`${LIB}/management.ts`)).toMatch(/export const ASSIGNABLE_ROLES = \["organization_admin", "team_manager", "planner", "viewer"\] as const;/);
  });

  it("draws on the member page only the writes the member's state offers, as links", () => {
    const page = read(`${COMPONENTS}/MemberManagement.tsx`);
    expect(page).toMatch(/const writes = memberWritesFor\(member\);/);
    expect(page).toMatch(/\{writes\.map\(\(write\) => \(/);
    expect(page).toMatch(/href=\{memberWritePath\(organizationId, member\.userId, write\)\}\s+prefetch=\{false\}/);
    // Nothing is sent from the member page: it has no control but links.
    expect(page).not.toMatch(/<button\b|<form\b|<input\b|onClick=|"use client"|Action\b/);
  });

  it("says of a write it leaves out that it is not offered here, never that it is impossible", () => {
    const page = read(`${COMPONENTS}/MemberManagement.tsx`);
    expect(page).not.toMatch(/nothing about them can be changed|have proposals reassigned|Nothing can be changed/);
    expect(page).toMatch(/A change of role or status is not offered here for a removed member; proposals they still own can be reassigned\./);
    expect(page).toMatch(/Deactivating them is not offered here, and ownership can only go to an active member\./);
    expect(page).toMatch(/No change is offered here for this member as they are now\./);
  });

  it("keeps the keyboard focus after a page of members loads, and uses the tested rule for the block link", () => {
    const picker = read(`${COMPONENTS}/ReassignTargetPicker.tsx`);
    // The pressed control is gone once the read ends: focus goes to the loaded list, or to the retry.
    expect(picker).toMatch(/focusAfter\.current = result\.ok \? "results" : "retry";/);
    expect(picker).toMatch(/if \(focusAfter\.current === "results"\) results\.current\?\.focus\(\);\s*if \(focusAfter\.current === "retry"\) retry\.current\?\.focus\(\);/);
    expect(picker).toMatch(/<div\s+ref=\{results\}\s+tabIndex=\{-1\}\s+role="group"\s+aria-label=\{`Members who can receive the proposals, page /);
    expect(picker).toMatch(/<button ref=\{retry\} type="button" onClick=\{\(\) => load\(firstOrSame\)\}/);
    // The detail page decides "Block organization" with the management pages' own rule.
    const account = read("components/organizations/OrganizationAccount.tsx");
    expect(account).toMatch(/const canBlock = organizationWritesFor\(\{ standing: organization\.standing, blocked: organization\.blocked \?\? null \}\)\.includes\("block"\);/);
    expect(account).not.toMatch(/organization\.standing === "inactive"/);
    // The repo's notes name every refusal that offers "Load the current member".
    const notes = read("CLAUDE.md");
    for (const failure of ["stale_version", "version_required", "outcome_unknown"]) expect(read(`${COMPONENTS}/WriteFlow.tsx`)).toContain(`"${failure}"`);
    expect(notes).toMatch(/offered after a\s+`STALE_VERSION`, a `VERSION_REQUIRED` and a write whose outcome is unknown/);
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
    expect(controls).toBeGreaterThan(30);
    // A checkbox or radio shows its focus on the label around it.
    for (const file of [`${COMPONENTS}/WriteFlow.tsx`, `${COMPONENTS}/ReassignTargetPicker.tsx`]) expect(read(file)).toMatch(/has-\[:focus-visible\]:outline has-\[:focus-visible\]:outline-2/);
    const chrome = read(`${COMPONENTS}/ManageChrome.tsx`);
    expect(chrome).toMatch(/import \{ ContentBadge, focusRing \} from "@\/components\/organizations\/content\/ContentChrome";/);
    for (const name of ["linkClass", "primaryButton", "dangerButton", "secondaryButton", "linkButton", "dangerLinkButton"]) {
      expect(chrome).toMatch(new RegExp(`export const ${name} =[^;]*\\$\\{focusRing\\}`));
    }
    expect(chrome).toMatch(/export const inputClass =\s*"[^"]*focus:border-\[#00aeb5\] focus:ring-4/);
    // The two links on the detail page and the one on the Members list carry the same outline.
    for (const file of ["components/organizations/OrganizationAccount.tsx", "components/organizations/content/MembersList.tsx"]) {
      for (const link of elements(read(file), /<(Link)\b/g, (name) => `</${name}>`)) expect({ file, link, focus: /\$\{focusRing\}/.test(link) }).toMatchObject({ focus: true });
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

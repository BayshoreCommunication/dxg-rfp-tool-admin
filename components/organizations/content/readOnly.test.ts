import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// No component harness in this repo (Jest runs in node), so these read the source, the same way
// the organization detail tests check their links.

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const sourceFiles = (directory: string): string[] =>
  readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const relative = `${directory}/${entry}`;
    if (statSync(join(process.cwd(), relative)).isDirectory()) return sourceFiles(relative);
    return /\.tsx$/.test(entry) ? [relative] : [];
  });

const COMPONENTS = "components/organizations/content";
const PAGES = "app/(page)/organizations/[organizationId]";
// The detail page itself keeps its plan-change control; everything under it is the content browser.
const contentFiles = [...sourceFiles(COMPONENTS), ...sourceFiles(PAGES).filter((file) => !/^\[organizationId\]\/(page|loading)\.tsx$/.test(file.replace("app/(page)/organizations/", "")))];

const withoutComments = (source: string) => source.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "");

describe("the organization content pages are view-only", () => {
  it("covers every content component and page", () => {
    expect(sourceFiles(COMPONENTS).map((file) => file.replace(`${COMPONENTS}/`, "")).sort()).toEqual([
      "ContentChrome.tsx",
      "MembersList.tsx",
      "ProposalDetail.tsx",
      "ProposalList.tsx",
      "TeamsList.tsx",
      "TemplateDetail.tsx",
      "TemplatesList.tsx",
      "VendorResponses.tsx",
      "VendorsList.tsx",
    ]);
    expect(contentFiles.filter((file) => file.startsWith(PAGES))).toHaveLength(16);
    expect(contentFiles).not.toContain(`${PAGES}/page.tsx`);
  });

  it.each(contentFiles)("%s renders no edit, delete, share, download or export control", (file) => {
    const source = withoutComments(read(file));
    // No control that could change or take away customer content. The one form is the search box
    // in ContentChrome (checked below); it is cut out here so the rest of that file is still scanned.
    const search = /<form action=\{action\} method="get" role="search"[\s\S]*?<\/form>/;
    if (file === `${COMPONENTS}/ContentChrome.tsx`) expect(source).toMatch(search);
    const scanned = file === `${COMPONENTS}/ContentChrome.tsx` ? source.replace(search, "") : source;
    expect(scanned).not.toMatch(/<button\b|<input\b|<select\b|<textarea\b|<form\b|type="submit"/);
    expect(source).not.toMatch(/onClick=|onSubmit=|onChange=|formAction|"use client"|"use server"|useEffect|useRouter|router\./);
    expect(source).not.toMatch(/\bdownload\b|window\.open|navigator\.clipboard|Blob\(|createObjectURL|\.csv|\.xlsx/i);
    // No icon and no label of such a control.
    expect(source).not.toMatch(/\b(Pencil|PencilLine|Edit|Edit2|Edit3|SquarePen|Trash|Trash2|Share|Share2|Download|Upload|FileDown|Copy|Printer|Send|Plus|Save)\b,?/);
    expect(source).not.toMatch(/>\s*(Edit|Delete|Remove|Share|Export|Download|Archive|Restore|Duplicate|Invite|Resend|Revoke|Deactivate|Save|Print|Copy)\b/);
    expect(source).not.toMatch(/aria-label="(Edit|Delete|Remove|Share|Export|Download)/);
    // Nothing but the read actions, and only in pages; no plan, client or support action.
    const actions = [...new Set(source.match(/\b\w+Action\b/g) ?? [])];
    for (const action of actions) expect(action).toMatch(/^(list|get)Organization\w+Action$/);
    if (file.startsWith(COMPONENTS)) expect(actions).toEqual([]);
    expect(source).not.toMatch(/ChangePlanButton|ConfirmDialog|organizationPlans|allClients|adminUser|supportDesk/);
  });

  it("uses no component from outside the content browser, and no client code", () => {
    const imported = contentFiles.flatMap((file) => [...read(file).matchAll(/from "(@\/components\/[^"]+)"/g)].map((match) => match[1]));
    const outside = [...new Set(imported)].filter((path) => !path.startsWith("@/components/organizations/content/"));
    // From ClientDetilas only the page-number helper is taken, not the client controls.
    expect(outside).toEqual(["@/components/clients/ClientDetilas"]);
    expect(read(`${COMPONENTS}/ContentChrome.tsx`)).toMatch(/import \{ buildPageList \} from "@\/components\/clients\/ClientDetilas";/);
    for (const file of contentFiles) expect({ file, hooks: /from "react"/.test(read(file)) && !/import type \{[^}]*\} from "react"/.test(read(file)) }).toEqual({ file, hooks: false });
  });

  it("searches with a plain GET form: one submit, one page view, nothing sent while typing or clearing", () => {
    const chrome = read(`${COMPONENTS}/ContentChrome.tsx`);
    const form = chrome.match(/<form action=\{action\} method="get" role="search"[\s\S]*?<\/form>/)?.[0] ?? "";
    expect(form).toMatch(/<input\s+type="search"\s+name="search"\s+defaultValue=\{search\}\s+maxLength=\{200\}/);
    // Besides the search text, only the filters already chosen are sent, as hidden fields.
    expect(form.match(/<input\b/g)).toHaveLength(2);
    expect(form).toMatch(/<input key=\{name\} type="hidden" name=\{name\} value=\{value\} \/>/);
    expect(form.match(/<button\b[^>]*>\s*Search\s*<\/button>/)).not.toBeNull();
    expect(form).not.toMatch(/method="post"|onChange|onSubmit|\svalue=\{search\}/i);
    // The search boxes used elsewhere in the app navigate on their own (on mount and on clearing):
    // each of those would be a recorded read nobody asked for.
    for (const file of contentFiles) expect({ file, uses: /ClientSearchForm/.test(read(file)) }).toEqual({ file, uses: false });
    for (const list of ["ProposalList.tsx", "TemplatesList.tsx", "VendorsList.tsx"]) {
      expect(read(`${COMPONENTS}/${list}`)).toMatch(/<ContentSearch\s+action=\{organization(Proposals|Templates|Vendors)Path\(organizationId\)\}/);
    }
  });

  it("never links a page to the address it is already showing, or to a page that is not there", () => {
    const chrome = read(`${COMPONENTS}/ContentChrome.tsx`);
    // The current section, the chosen filter and the current page number are text, not links.
    expect(chrome).toMatch(/section === active && here \? \(\s*<span key=\{section\} aria-current="page"/);
    expect(chrome).toMatch(/option\.value === active \? \(\s*<span key=\{option\.value\} aria-current="true"/);
    expect(chrome).toMatch(/item === pagination\.page \? \(\s*<span\s+key=\{item\}\s+aria-current="page"/);
    // Previous and Next are links only when there is such a page.
    expect(chrome).toMatch(/\{hasPrev \? \(\s*<Link href=\{hrefFor\(pagination\.page - 1\)\}/);
    expect(chrome).toMatch(/\{hasNext \? \(\s*<Link href=\{hrefFor\(pagination\.page \+ 1\)\}/);
    expect(chrome).not.toMatch(/aria-disabled|pointer-events-none border|tabIndex/);
  });

  it("never draws the page being shown as a link, in any content component or page", () => {
    // A Link marked as the current page leads to the address already open: one more recorded read.
    const current = contentFiles.flatMap((file) =>
      (read(file).match(/<Link\b[^>]*>/g) ?? []).filter((link) => /aria-current=(?:"page"|\{[^}]*"page")/.test(link)).map((link) => ({ file, link })),
    );
    expect(current).toEqual([]);
    // The proposal's two views: the open one is text, the other one a link.
    const detail = read(`${COMPONENTS}/ProposalDetail.tsx`);
    const tabs = detail.slice(detail.indexOf("export const ProposalViewTabs"), detail.indexOf("export const BackToProposals"));
    expect(tabs).toMatch(/tab\.id === active \? \(\s*<span key=\{tab\.id\} aria-current="page"/);
    expect(tabs.match(/<Link\b/g)).toHaveLength(1);
    expect(tabs).toMatch(/\) : \(\s*<Link key=\{tab\.id\} href=\{tab\.href\} prefetch=\{false\}/);
    // Each of the two pages names its own view as the open one.
    expect(detail).toMatch(/<ProposalViewTabs organizationId=\{organizationId\} proposalId=\{proposal\.id\} active="proposal" \/>/);
    expect(read(`${PAGES}/proposals/[proposalId]/vendor-responses/page.tsx`)).toMatch(
      /<ProposalViewTabs organizationId=\{organizationId\} proposalId=\{proposalId\} active="vendor-responses" \/>/,
    );
    expect(contentFiles.flatMap((file) => read(file).match(/<ProposalViewTabs\b/g) ?? [])).toHaveLength(2);
  });

  it("links out of the app only for an address the planner typed, never for a file", () => {
    const anchors = contentFiles.flatMap((file) => (read(file).match(/<a\b[^>]*>/g) ?? []).map((anchor) => ({ file, anchor })));
    expect(anchors.map(({ file }) => file)).toEqual([`${COMPONENTS}/ProposalDetail.tsx`, `${COMPONENTS}/ProposalDetail.tsx`]);
    const [typed, section] = anchors.map(({ anchor }) => anchor);
    expect(typed).toMatch(/^<a href=\{field\.value\} target="_blank" rel="noreferrer noopener"/);
    expect(section).toMatch(/^<a href=\{`#\$\{section\.key\}`\}/);
    for (const { anchor } of anchors) expect(anchor).not.toMatch(/download/);
    // The one outside link is drawn only for a row of kind "link"; file rows are kind "text"
    // (lib/organizationContent/proposalFields.test.ts), so a filename is plain text.
    const detail = read(`${COMPONENTS}/ProposalDetail.tsx`);
    expect(detail).toMatch(/\{field\.kind === "link" \? \(\s*<a href=\{field\.value\}[^>]*>\s*\{field\.value\}\s*<\/a>\s*\) : \(\s*field\.value\s*\)\}/);
    expect(detail.match(/field\.kind === "link"/g)).toHaveLength(1);
    const fields = read("lib/organizationContent/proposalFields.ts");
    const fileRows = fields.slice(fields.indexOf("for (const [key, label] of UPLOAD_FILE_FIELDS)"), fields.indexOf("const brandGuide ="));
    expect(fileRows).toMatch(/kind: "text"/);
    expect(fileRows).not.toMatch(/kind: "link"|isWebAddress/);
    // A vendor response shows how many documents it has, and nothing to open.
    const responses = read(`${COMPONENTS}/VendorResponses.tsx`);
    expect(responses).toMatch(/countLabel\(response\.documentCount, "document"\)/);
    expect(responses).not.toMatch(/<a\b|<Link\b|href=/);
  });

  it("never prefetches a recorded read: every Link in the content pages and components opts out", () => {
    let found = 0;
    for (const file of contentFiles) {
      for (const link of read(file).match(/<Link\b[^>]*>/g) ?? []) {
        // The Organizations list is not customer content and is not a recorded read.
        // Nor is the sign-in page.
        if (/href=\{ORGANIZATIONS_PATH\}|href="\/sign-in"/.test(link)) continue;
        found += 1;
        expect({ file, link, optsOut: /prefetch=\{false\}/.test(link) }).toMatchObject({ optsOut: true });
      }
      expect({ file, prefetches: /router\.prefetch\(|prefetch=\{true\}|prefetch(?!=\{false\})=/.test(read(file)) }).toEqual({ file, prefetches: false });
    }
    expect(found).toBeGreaterThanOrEqual(12);
  });

  it("says on every content page that it is view-only and where the view is recorded", () => {
    const chrome = read(`${COMPONENTS}/ContentChrome.tsx`);
    expect(chrome).toMatch(/View only\. Each page you open here is recorded on the RFPilot side; the organization does not see it\./);
    for (const file of contentFiles.filter((path) => /\/page\.tsx$/.test(path))) {
      const source = read(file);
      expect({ file, framed: /<ContentFrame organizationId=\{known\} active="/.test(source) && /<ContentFailureState\b/.test(source) }).toEqual({ file, framed: true });
    }
  });

  it("shows keyboard focus on the pager, the proposal views and the way back, and gives the pager a 44px target", () => {
    const chrome = read(`${COMPONENTS}/ContentChrome.tsx`);
    const detail = read(`${COMPONENTS}/ProposalDetail.tsx`);
    // One focus style, the one the filter pills carry.
    expect(chrome).toMatch(
      /export const focusRing =\s*"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#00aeb5\]";/,
    );
    const pills = chrome.slice(chrome.indexOf("const pillClass"), chrome.indexOf("/* A page never links"));
    expect(pills).toMatch(/\$\{focusRing\}/);
    // Every link of the pager: the two step arrows and the page numbers.
    const pager = chrome.slice(chrome.indexOf("export const Pager"));
    const pagerLinks = pager.match(/<Link\b[^>]*>/g) ?? [];
    expect(pagerLinks).toHaveLength(3);
    for (const link of pagerLinks) expect(link).toMatch(/className=\{(stepClass\(true\)|pageLinkClass)\}/);
    expect(pager).toMatch(/const stepClass = [\s\S]*?enabled \? `[^`]*\$\{focusRing\}`/);
    expect(pager).toMatch(/const pageLinkClass = `[^`]*\$\{focusRing\}`/);
    // 44px (h-11 w-11) for everything in the pager that can be pressed; nothing left at 36px.
    expect(pager).toMatch(/const stepClass = [\s\S]*?`inline-flex h-11 w-11 /);
    expect(pager).toMatch(/const pageClass = "inline-flex h-11 w-11 /);
    expect(pager).toMatch(/const pageLinkClass = `\$\{pageClass\} /);
    expect(pager).not.toMatch(/\b[hw]-9\b/);
    // The proposal's other view and the way back to the list.
    const tabs = detail.slice(detail.indexOf("export const ProposalViewTabs"), detail.indexOf("export const BackToProposals"));
    expect(tabs).toMatch(/<Link key=\{tab\.id\}[^>]*className=\{`[^`]*\$\{focusRing\}[^`]*`\}/);
    const back = detail.slice(detail.indexOf("export const BackToProposals"), detail.indexOf("/** A view-only page"));
    expect(back).toMatch(/<Link\b[^>]*className=\{`[^`]*\$\{focusRing\}`\}/);
    // Secondary text is not paler than on the other content pages.
    expect(detail).not.toMatch(/text-slate-400/);
    expect(detail).toMatch(/<span className="text-slate-600">No longer a member<\/span>/);
    expect(detail).toMatch(/<p className="px-1 text-xs text-slate-600">\s*Not filled in yet:/);
  });

  it("keeps wide content inside a phone screen: lists stack, and the one table is desktop-only", () => {
    const tables = contentFiles.filter((file) => /<table\b/.test(read(file)));
    expect(tables).toEqual([`${COMPONENTS}/ProposalList.tsx`]);
    const list = read(`${COMPONENTS}/ProposalList.tsx`);
    // The table is hidden below the lg breakpoint, where the stacked cards are shown instead.
    expect(list).toMatch(/<div className="hidden p-4 sm:p-5 lg:block">\s*<div\s+className="overflow-auto/);
    expect(list).toMatch(/<div className="divide-y divide-slate-100 lg:hidden">/);
    for (const file of sourceFiles(COMPONENTS)) {
      const source = read(file);
      // No fixed minimum width outside that table (the 84px one is the Search button).
      expect({ file, fixed: (source.match(/min-w-\[\d+px\]/g) ?? []).filter((width) => width !== "min-w-[880px]" && width !== "min-w-[84px]") }).toEqual({ file, fixed: [] });
    }
  });
});

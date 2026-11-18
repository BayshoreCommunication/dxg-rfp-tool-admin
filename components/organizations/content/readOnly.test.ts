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
    // No control that could change or take away customer content: the only form is the search box.
    expect(source).not.toMatch(/<button\b|<input\b|<select\b|<textarea\b|<form\b|onClick=|onSubmit=|onChange=|formAction|"use client"|"use server"/);
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

  it("uses no interactive component except the search box", () => {
    const imported = contentFiles.flatMap((file) => [...read(file).matchAll(/from "(@\/components\/[^"]+)"/g)].map((match) => match[1]));
    const outside = [...new Set(imported)].filter((path) => !path.startsWith("@/components/organizations/content/"));
    expect(outside.sort()).toEqual(["@/components/clients/ClientDetilas", "@/components/clients/ClientSearchForm"]);
    // From ClientDetilas only the page-number helper is taken, not the client controls.
    expect(read(`${COMPONENTS}/ContentChrome.tsx`)).toMatch(/import \{ buildPageList \} from "@\/components\/clients\/ClientDetilas";/);
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
        if (/href=\{ORGANIZATIONS_PATH\}/.test(link)) continue;
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

  it("keeps wide content inside a phone screen: lists stack, and the one table is desktop-only", () => {
    const tables = contentFiles.filter((file) => /<table\b/.test(read(file)));
    expect(tables).toEqual([`${COMPONENTS}/ProposalList.tsx`]);
    const list = read(`${COMPONENTS}/ProposalList.tsx`);
    // The table is hidden below the lg breakpoint, where the stacked cards are shown instead.
    expect(list).toMatch(/<div className="hidden p-4 sm:p-5 lg:block">\s*<div\s+className="overflow-auto/);
    expect(list).toMatch(/<div className="divide-y divide-slate-100 lg:hidden">/);
    for (const file of sourceFiles(COMPONENTS)) {
      const source = read(file);
      // No fixed minimum width outside that table, and no nowrap on customer text.
      expect({ file, fixed: (source.match(/min-w-\[\d+px\]/g) ?? []).filter((width) => width !== "min-w-[880px]") }).toEqual({ file, fixed: [] });
    }
  });
});

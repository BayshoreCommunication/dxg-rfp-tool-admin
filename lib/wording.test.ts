import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The user-facing noun is "proposal" (owner decision, 2026-11-12, same rule as the dashboard's
// lib/wording.test.ts): no on-screen text may call the document a planner writes an "RFP". The
// product name RFPilot is allowed. Comments and identifiers (rfpId, GrantedRfpList, OWNER_HAS_RFPS,
// the "rfp" grant scope, the /rfps/ route) are not on screen and are not checked. Text the backend
// writes and this app only displays is out of this test's reach: it is the backend's to word.
//
// What this does NOT catch: an all-lowercase "rfp" that reaches the screen from data (a stored
// key or a backend code shown as is), since lowercase "rfp" in source is nearly always an
// identifier or a value. And it reads source text, not syntax: a bare identifier named `Rfp` or
// `RFP` in non-test source trips it, and needs a longer name (rfpId, RFP_SECTIONS) or an ALLOWED
// entry.
const ROOTS = ["app", "components", "config", "lib"];
const ROOT_FILES = ["auth.ts", "proxy.ts", "next.config.ts"];

// "RFP", "RFPs", "RFP's" (or "Rfp") as a word of its own: not RFPilot, not part of an identifier.
const RFP_NOUN = /(?<![A-Za-z0-9_])R[Ff][Pp](?:s|'s|’s)?(?![A-Za-z0-9_])/;

// Blanks out comments but keeps the line count, so a finding points at the right line.
// "//" counts as a comment only at the start of a line or after a space (not in "https://"), and
// "/*" only at the start of a line or after a space, "{", "(", ";" or "," (not in accept="image/*").
const withoutComments = (source: string): string =>
  source
    .replace(/(^|[\s{(;,])(\/\*[\s\S]*?\*\/)|<!--[\s\S]*?-->/gm, (comment, before: string | undefined) =>
      (before ?? "") + comment.slice((before ?? "").length).replace(/[^\n]/g, " "),
    )
    .replace(/(^|\s)\/\/.*$/gm, "$1");

// Deliberate exceptions: [file, text on the line]. Each one must say why it stays. None today:
// the admin app has no screen that defines the term, and its wordmark is an image.
const ALLOWED: Array<[file: string, text: string]> = [];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|html)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : [];
  });

describe("user-facing wording", () => {
  it('says "proposal", not "RFP", in on-screen text', () => {
    const paths = [...ROOTS.flatMap((root) => sourceFiles(join(process.cwd(), root))), ...ROOT_FILES.map((file) => join(process.cwd(), file))];
    const leftovers = paths.flatMap((path) => {
      const file = path.replace(process.cwd() + "/", "");
      const allowed = ALLOWED.filter(([allowedFile]) => allowedFile === file).map(([, text]) => text);
      return withoutComments(readFileSync(path, "utf8"))
        .split("\n")
        .map((text, index) => ({ line: index + 1, text }))
        .filter(({ text }) => RFP_NOUN.test(allowed.reduce((rest, phrase) => rest.replace(phrase, ""), text)))
        .map(({ line, text }) => `${file}:${line} ${text.trim()}`);
    });
    expect(leftovers).toEqual([]);
  });

  it("keeps every documented exception in use", () => {
    const stale = ALLOWED.filter(([file, text]) => !readFileSync(join(process.cwd(), file), "utf8").includes(text));
    expect(stale).toEqual([]);
  });

  it("tells the noun from the product name and from identifiers", () => {
    expect(RFP_NOUN.test("New RFP")).toBe(true);
    expect(RFP_NOUN.test("your RFPs")).toBe(true);
    expect(RFP_NOUN.test("this RFP's owner")).toBe(true);
    expect(RFP_NOUN.test("1 Rfps")).toBe(true);
    expect(RFP_NOUN.test("RFPilot Support")).toBe(false);
    expect(RFP_NOUN.test('OWNER_HAS_RFPS rfpId GrantedRfpList scope: "rfp" /rfps/')).toBe(false);
    expect(withoutComments('a // RFP\n"https://x" /* RFP\nRFP */ b')).not.toMatch(RFP_NOUN);
    expect(withoutComments("a\n{/* RFP */}\n(/* RFP */ b, /* RFP */ c); /* RFP */")).not.toMatch(RFP_NOUN);
    // "/*" inside a string is not a comment start: the text after it is still checked.
    expect(withoutComments('accept="image/*" RFP {/* x */}')).toMatch(RFP_NOUN);
    expect(withoutComments('"*/*;q=0.8"\nRFP\n/* x */')).toMatch(RFP_NOUN);
    expect(withoutComments("a /* x\ny */ b").split("\n")).toHaveLength(2);
  });
});

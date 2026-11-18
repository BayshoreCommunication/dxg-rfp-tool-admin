// How a customer's proposal is put into words for RFPilot staff in the organization content
// browser (owner decision, 2026-11-17). Pure helpers; they came from the grant workspace (ORG-406).

/**
 * A published RFP is Live unless it was switched off. "rejected" is a status left by an
 * early version of the planner app (its control was removed in April 2026); the planner app
 * shows those as offline too, so it is never shown as "Rejected" here.
 */
export const publishedState = (rfp: { isActive?: boolean; status?: string }) =>
  rfp.isActive === false || rfp.status === "rejected" ? "Offline" : "Live";

const STAGE_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  receiving_responses: "Receiving responses",
  under_review: "Under review",
  awarded: "Awarded",
  archived: "Archived",
};

/** The RFP's lifecycle stage as the planner sees it; an unknown stage is shown in plain words. */
export const stageLabel = (rfp: { stage?: string | null; isDraft?: boolean; isArchived?: boolean }): string => {
  const stage = String(rfp.stage ?? "").trim().toLowerCase();
  if (stage) return STAGE_LABELS[stage] ?? humanizeValue(stage.toUpperCase());
  if (rfp.isArchived) return "Archived";
  return rfp.isDraft ? "Draft" : "Sent";
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/**
 * Timestamps and plain "YYYY-MM-DD" dates are formatted (the latter in UTC so
 * they never shift a day); anything else the planner typed is shown as is.
 */
export const formatDate = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return null;
  const plainDate = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (!plainDate && !/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;
  const date = new Date(plainDate ? `${raw}T00:00:00Z` : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-US", plainDate ? { ...DATE_FORMAT, timeZone: "UTC" } : DATE_FORMAT);
};

/** "Nov 12 – 14, 2026" style range from the planner's free-text event dates. */
export const eventDates = (rfp: { startDate?: string | null; endDate?: string | null }) => {
  const start = formatDate(rfp.startDate);
  const end = formatDate(rfp.endDate);
  if (start && end && start !== end) return `${start} – ${end}`;
  return start ?? end ?? "Not set";
};

// ---- RFP detail: turning stored form data into readable rows ----

export type ProposalField =
  | { kind: "text"; label: string; value: string }
  | { kind: "link"; label: string; value: string }
  | { kind: "group"; label: string; items: { title: string; fields: ProposalField[] }[] };

const ACRONYMS: Record<string, string> = {
  av: "AV", coi: "COI", dei: "DEI", nda: "NDA", qa: "Q&A", url: "URL", urls: "URLs",
  rfp: "proposal", rfps: "proposals", led: "LED", imag: "IMAG", ppl: "people", qty: "qty", ext: "ext.", id: "ID",
};

/** "venueAvContactName" → "Venue AV contact name". */
export const humanizeKey = (key: string): string => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.toLowerCase());
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
};

// Stored answers that predate the RFPilot name; the saved value is unchanged.
const LEGACY_ANSWERS: Record<string, string> = { "DXG Runs Rehearsal": "RFPilot Runs Rehearsal" };

/** Codes and booleans as words, dates as dates; everything else as typed. */
export const humanizeValue = (value: unknown): string => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-US");
  const raw = String(value ?? "").trim();
  if (LEGACY_ANSWERS[raw]) return LEGACY_ANSWERS[raw];
  if (/^(YES|NO)$/i.test(raw)) return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(raw) || /^[A-Z]{4,}$/.test(raw)) {
    const words = raw.toLowerCase().split("_").map((word) => ACRONYMS[word] ?? word).join(" ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return `${date.toLocaleString("en-US", DATE_TIME)} UTC`;
  }
  return formatDate(raw) ?? raw;
};

const isBlank = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every(isBlank);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isBlank);
  return false;
};

const ITEM_TITLE_KEYS = ["roomFunction", "functionName", "name", "fileName", "originalName", "companyName", "title", "label"];

const itemTitle = (item: Record<string, unknown>, fallback: string) => {
  const key = ITEM_TITLE_KEYS.find((candidate) => typeof item[candidate] === "string" && String(item[candidate]).trim());
  if (!key) return fallback;
  // A file's title is its bare name, whatever was stored under it.
  return key === "fileName" || key === "originalName" ? bareFilename(item[key]) ?? fallback : String(item[key]).trim();
};

/**
 * A file's name and nothing else. Anything that could address the file (a path, a query
 * string, a scheme) is cut away, the way the backend does it; what is left is shown as text.
 */
export const bareFilename = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const name = (value.split(/[?#]/)[0].split(/[\\/]/).pop() ?? "").trim();
  return name && !name.includes(":") ? name : null;
};

/* Keys that hold uploaded files, in any section (the same pattern the backend's template
   snapshot uses to leave files out). Staff cannot open a customer's files, so whatever is stored
   there (a name, an address, an object describing the file) is shown as bare file names only. */
const FILE_KEY = /(Files?|Docs|Documents|Attachments?)$|^(fileName|filename|originalName)$/;
const FILE_NAME_KEYS = ["fileName", "originalName", "name", "filename", "url", "key", "path"];

const fileNames = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const file = entry as Record<string, unknown>;
      const name = FILE_NAME_KEYS.map((key) => bareFilename(file[key])).find(Boolean);
      return name ? [name] : [];
    }
    const name = bareFilename(entry);
    return name ? [name] : [];
  });

/**
 * Flattens one stored section into labelled rows, skipping anything left
 * blank. Nested answers ("podiumMic": {"podiumMic", "podiumMicQty"}) become
 * their own rows; lists of objects (rooms, sessions) become groups. Every row
 * is plain text: nothing a planner stored becomes a link here, and a key that
 * holds files shows their bare names only. (The two addresses a planner types
 * on purpose are linked by uploadsFields, and nowhere else.)
 */
export const proposalFields = (data: unknown, parent?: string): ProposalField[] => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const fields: ProposalField[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isBlank(value)) continue;
    const label =
      parent && !key.toLowerCase().startsWith(parent.toLowerCase())
        ? `${humanizeKey(parent)} · ${humanizeKey(key)}`
        : humanizeKey(key);
    if (FILE_KEY.test(key)) {
      const names = fileNames(value);
      if (names.length) fields.push({ kind: "text", label, value: names.join("\n") });
      continue;
    }
    if (Array.isArray(value)) {
      const present = value.filter((item) => !isBlank(item));
      if (present.every((item) => typeof item !== "object")) {
        fields.push({ kind: "text", label, value: present.map(humanizeValue).join(", ") });
      } else {
        fields.push({
          kind: "group",
          label,
          items: present.map((item, index) =>
            typeof item === "object" && item
              ? { title: itemTitle(item as Record<string, unknown>, `${humanizeKey(key)} ${index + 1}`), fields: proposalFields(item) }
              : { title: humanizeValue(item), fields: [] },
          ),
        });
      }
    } else if (typeof value === "object") {
      fields.push(...proposalFields(value, key));
    } else {
      fields.push({ kind: "text", label, value: humanizeValue(value) });
    }
  }
  return fields;
};

/** The planner's form sections, in the order they fill them in. */
export const PROPOSAL_SECTIONS: { key: string; title: string }[] = [
  { key: "event", title: "Event overview" },
  { key: "contact", title: "Contact" },
  { key: "venueSchedule", title: "Venue & schedule" },
  { key: "venue", title: "Venue logistics" },
  { key: "roomByRoom", title: "Rooms & sessions" },
  { key: "production", title: "Production" },
  { key: "hybridVirtual", title: "Hybrid & virtual" },
  { key: "contentCreative", title: "Content & creative" },
  { key: "videoRecordingStep", title: "Video recording" },
  { key: "budget", title: "Budget & evaluation" },
  { key: "uploads", title: "Files & references" },
];

/* ---------- Files & references ---------- */

/* The backend returns `uploads` as an allowlist: seven file fields as arrays of bare filenames
   (staff cannot open a customer's files, so there is nothing to link to), and the fields the
   planner typed. The same allowlist is applied here, so a key added to the response later is
   not shown, and a file is only ever a name in plain text. */
export const UPLOAD_FILE_FIELDS: Array<[key: string, label: string]> = [
  ["brandGuideFiles", "Brand guide files"],
  ["eventLogoFiles", "Event logo files"],
  ["referenceFiles", "Reference files"],
  ["venueDocs", "Venue documents"],
  ["ndaDocumentFiles", "NDA document files"],
  ["scenicInspirationFiles", "Scenic inspiration files"],
  ["venueCoiFiles", "Venue COI files"],
];

const CO_VENDORS: Array<[key: string, title: string]> = [
  ["inHouseVenueAv", "In-house venue AV"],
  ["eventDecorator", "Event decorator"],
  ["registrationTech", "Registration tech"],
  ["agencyOfRecord", "Agency of record"],
  ["photographer", "Photographer"],
];
const CO_VENDOR_FIELDS = ["companyName", "contactName", "contactEmail", "contactPhone", "status", "notes"];

const plainText = (label: string, value: unknown): ProposalField[] => {
  const raw = typeof value === "string" ? value.trim() : typeof value === "boolean" || typeof value === "number" ? value : "";
  return raw === "" ? [] : [{ kind: "text", label, value: humanizeValue(raw) }];
};

const isWebAddress = (value: string) => /^https?:\/\//i.test(value);

/** The "Files & references" rows. File names are always `kind: "text"`: never a link. */
export const uploadsFields = (data: unknown): ProposalField[] => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const uploads = data as Record<string, unknown>;
  const fields: ProposalField[] = [];

  for (const [key, label] of UPLOAD_FILE_FIELDS) {
    // Strings only here: the response's file fields are arrays of names, never objects.
    const stored = uploads[key];
    const names = (Array.isArray(stored) ? stored : [stored]).flatMap((entry) => {
      const name = bareFilename(entry);
      return name ? [name] : [];
    });
    if (names.length) fields.push({ kind: "text", label, value: names.join("\n") });
  }

  const brandGuide = typeof uploads.brandGuideUrl === "string" ? uploads.brandGuideUrl.trim() : "";
  if (brandGuide) fields.push({ kind: isWebAddress(brandGuide) ? "link" : "text", label: "Brand guide URL", value: brandGuide });

  const references = (Array.isArray(uploads.referenceUrls) ? uploads.referenceUrls : []).flatMap((entry, index) => {
    const reference = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const url = typeof reference.url === "string" ? reference.url.trim() : "";
    const label = typeof reference.label === "string" ? reference.label.trim() : "";
    if (!url && !label) return [];
    const row: ProposalField[] = url ? [{ kind: isWebAddress(url) ? "link" : "text", label: "URL", value: url }] : [];
    return [{ title: label || `Reference ${index + 1}`, fields: row }];
  });
  if (references.length) fields.push({ kind: "group", label: "Reference URLs", items: references });

  fields.push(...plainText("NDA required", uploads.ndaRequired), ...plainText("NDA type", uploads.ndaType));

  const coVendors = uploads.coVendors && typeof uploads.coVendors === "object" && !Array.isArray(uploads.coVendors)
    ? (uploads.coVendors as Record<string, unknown>)
    : {};
  const vendors = CO_VENDORS.flatMap(([key, title]) => {
    const vendor = coVendors[key] && typeof coVendors[key] === "object" ? (coVendors[key] as Record<string, unknown>) : {};
    const rows = CO_VENDOR_FIELDS.flatMap((field) => (typeof vendor[field] === "string" ? plainText(humanizeKey(field), vendor[field]) : []));
    return rows.length ? [{ title, fields: rows }] : [];
  });
  if (vendors.length) fields.push({ kind: "group", label: "Co-vendors", items: vendors });

  return fields;
};

/** A section's rows; a list section (rooms) is wrapped so it renders as cards. */
export const sectionFields = (key: string, value: unknown): ProposalField[] => {
  if (key === "uploads") return uploadsFields(value);
  return Array.isArray(value) ? proposalFields({ [key]: value }) : proposalFields(value);
};

/** What a template keeps from a proposal: content sections only (no contact, no files). */
export const TEMPLATE_SECTIONS = PROPOSAL_SECTIONS.filter((section) =>
  ["event", "venueSchedule", "roomByRoom", "production", "hybridVirtual", "contentCreative", "venue", "budget"].includes(section.key),
);

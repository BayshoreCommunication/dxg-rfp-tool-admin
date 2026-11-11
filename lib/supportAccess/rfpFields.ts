// How a granted RFP is put into words for RFPilot Support (ORG-406). Pure helpers, moved from
// the old all-organization "Proposals" screens, which no longer exist.

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

export type RfpField =
  | { kind: "text"; label: string; value: string }
  | { kind: "link"; label: string; value: string }
  | { kind: "group"; label: string; items: { title: string; fields: RfpField[] }[] };

const ACRONYMS: Record<string, string> = {
  av: "AV", coi: "COI", dei: "DEI", nda: "NDA", qa: "Q&A", url: "URL", urls: "URLs",
  rfp: "RFP", led: "LED", imag: "IMAG", ppl: "people", qty: "qty", ext: "ext.", id: "ID",
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
    const words = raw.toLowerCase().replace(/_/g, " ");
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
  return key ? String(item[key]).trim() : fallback;
};

/**
 * Flattens one stored section into labelled rows, skipping anything left
 * blank. Nested answers ("podiumMic": {"podiumMic", "podiumMicQty"}) become
 * their own rows; lists of objects (rooms, sessions, files) become groups.
 */
export const rfpFields = (data: unknown, parent?: string): RfpField[] => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const fields: RfpField[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isBlank(value)) continue;
    const label =
      parent && !key.toLowerCase().startsWith(parent.toLowerCase())
        ? `${humanizeKey(parent)} · ${humanizeKey(key)}`
        : humanizeKey(key);
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
              ? { title: itemTitle(item as Record<string, unknown>, `${humanizeKey(key)} ${index + 1}`), fields: rfpFields(item) }
              : { title: humanizeValue(item), fields: [] },
          ),
        });
      }
    } else if (typeof value === "object") {
      fields.push(...rfpFields(value, key));
    } else {
      const text = String(value).trim();
      fields.push(/^https?:\/\//i.test(text) ? { kind: "link", label, value: text } : { kind: "text", label, value: humanizeValue(value) });
    }
  }
  return fields;
};

/** The planner's form sections, in the order they fill them in. */
export const RFP_SECTIONS: { key: string; title: string }[] = [
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

/** A section's rows; a list section (rooms) is wrapped so it renders as cards. */
export const sectionFields = (key: string, value: unknown): RfpField[] =>
  Array.isArray(value) ? rfpFields({ [key]: value }) : rfpFields(value);

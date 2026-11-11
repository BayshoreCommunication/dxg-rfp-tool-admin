// ORG-406 (PRD P0-9). RFPilot Support reads a customer organization's RFPs only under a
// grant issued by that organization's Owner or Admin. The admin app has no generated
// contracts, so everything the backend sends is parsed here before a screen uses it.

export type GrantScope = "organization" | "rfp";

/** The permission an agent is working under, as shown in the banner. */
export type GrantBannerInfo = {
  id: string;
  scope: GrantScope;
  rfpId: string | null;
  expiresAt: string | null;
  secondsRemaining: number;
};

/** One row of "Granted to me". */
export type GrantedAccess = GrantBannerInfo & {
  organization: { id: string; name: string | null };
  reason: string | null;
  createdAt: string | null;
};

export type GrantedRfpOwner = { id: string; name: string | null; email: string | null };

export type GrantedRfpListItem = {
  id: string;
  eventName: string;
  status: string;
  stage: string | null;
  isDraft: boolean;
  isArchived: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  owner: GrantedRfpOwner | null;
};

export type GrantedRfpPage = {
  grants: GrantBannerInfo[];
  rfps: GrantedRfpListItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
};

export type GrantedRfpDetail = {
  grant: GrantBannerInfo;
  rfp: Record<string, unknown> & { id: string };
  owner: GrantedRfpOwner | null;
};

export type GrantedVendorResponse = {
  id: string;
  vendorName: string | null;
  submittedBy: string | null;
  email: string | null;
  message: string | null;
  documentCount: number;
  currentVersionNumber: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GrantedVendorResponses = { grant: GrantBannerInfo; vendorResponses: GrantedVendorResponse[] };

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const wholeNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const instant = (value: unknown): string | null => {
  const raw = text(value);
  return raw && !Number.isNaN(new Date(raw).getTime()) ? raw : null;
};

/** The backend refuses anything but a 24-character lower-case hex id; so do the links built here. */
export const isSupportAccessId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{24}$/.test(value);

/**
 * Seconds left on a grant. The expiry instant wins over the server's own count when both are
 * present, so a page that sat open is never more generous than the grant.
 */
const secondsLeft = (expiresAt: string | null, reported: unknown, now: number): number => {
  const fromServer = wholeNumber(reported);
  if (!expiresAt) return fromServer;
  const fromExpiry = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  return typeof reported === "number" ? Math.min(fromServer, fromExpiry) : fromExpiry;
};

export const parseGrantBanner = (value: unknown, now: number = Date.now()): GrantBannerInfo | null => {
  const raw = record(value);
  if (!raw || !isSupportAccessId(raw.id)) return null;
  const rfpId = isSupportAccessId(raw.proposalId) ? raw.proposalId : isSupportAccessId(record(raw.rfp)?.id) ? (record(raw.rfp)?.id as string) : null;
  // A grant that names an RFP is never widened to the organization, whatever `scope` says.
  const scope: GrantScope = rfpId ? "rfp" : "organization";
  if (raw.scope === "rfp" && !rfpId) return null;
  const expiresAt = instant(raw.expiresAt);
  return { id: raw.id, scope, rfpId, expiresAt, secondsRemaining: secondsLeft(expiresAt, raw.secondsRemaining, now) };
};

/** "Granted to me". Rows that can't be read, and grants with no time left, are dropped. */
export const parseGrantedAccessList = (value: unknown, now: number = Date.now()): GrantedAccess[] => {
  const rows = record(value)?.grants;
  if (!Array.isArray(rows)) return [];
  const grants: GrantedAccess[] = [];
  for (const row of rows) {
    const raw = record(row);
    const banner = parseGrantBanner(raw, now);
    const organization = record(raw?.organization);
    if (!raw || !banner || !organization || !isSupportAccessId(organization.id) || banner.secondsRemaining <= 0) continue;
    grants.push({
      ...banner,
      organization: { id: organization.id, name: text(organization.name) },
      reason: text(raw.reason),
      createdAt: instant(raw.createdAt),
    });
  }
  return grants;
};

const parseOwner = (value: unknown): GrantedRfpOwner | null => {
  const raw = record(value);
  return raw && typeof raw.id === "string" ? { id: raw.id, name: text(raw.name), email: text(raw.email) } : null;
};

export const parseGrantedRfpPage = (value: unknown, now: number = Date.now()): GrantedRfpPage | null => {
  const raw = record(value);
  if (!raw || !Array.isArray(raw.rfps)) return null;
  const grants = (Array.isArray(raw.grants) ? raw.grants : [])
    .map((grant) => parseGrantBanner(grant, now))
    .filter((grant): grant is GrantBannerInfo => grant !== null);
  // The list is only ever shown under a grant: no readable grant, nothing to show.
  if (grants.length === 0) return null;
  const rfps: GrantedRfpListItem[] = [];
  for (const row of raw.rfps) {
    const item = record(row);
    if (!item || !isSupportAccessId(item.id)) continue;
    rfps.push({
      id: item.id,
      eventName: text(item.eventName) ?? "Untitled event",
      status: text(item.status) ?? "",
      stage: text(item.stage),
      isDraft: item.isDraft === true,
      isArchived: item.isArchived === true,
      startDate: text(item.startDate),
      endDate: text(item.endDate),
      createdAt: text(item.createdAt),
      updatedAt: text(item.updatedAt),
      owner: parseOwner(item.owner),
    });
  }
  const pagination = record(raw.pagination);
  const total = wholeNumber(pagination?.total);
  return {
    grants,
    rfps,
    pagination: {
      page: Math.max(1, wholeNumber(pagination?.page)),
      perPage: Math.max(1, wholeNumber(pagination?.perPage) || rfps.length),
      total: Math.max(total, rfps.length),
      totalPages: Math.max(1, wholeNumber(pagination?.totalPages)),
    },
  };
};

export const parseGrantedRfpDetail = (value: unknown, now: number = Date.now()): GrantedRfpDetail | null => {
  const raw = record(value);
  const grant = parseGrantBanner(raw?.grant, now);
  const rfp = record(raw?.rfp);
  if (!raw || !grant || !rfp || !isSupportAccessId(rfp.id)) return null;
  return { grant, rfp: rfp as GrantedRfpDetail["rfp"], owner: parseOwner(raw.owner) };
};

export const parseGrantedVendorResponses = (value: unknown, now: number = Date.now()): GrantedVendorResponses | null => {
  const raw = record(value);
  const grant = parseGrantBanner(raw?.grant, now);
  if (!raw || !grant || !Array.isArray(raw.vendorResponses)) return null;
  const vendorResponses: GrantedVendorResponse[] = [];
  for (const row of raw.vendorResponses) {
    const item = record(row);
    if (!item || typeof item.id !== "string") continue;
    vendorResponses.push({
      id: item.id,
      vendorName: text(item.vendorName),
      submittedBy: text(item.submittedBy),
      email: text(item.email),
      message: text(item.message),
      documentCount: wholeNumber(item.documentCount),
      currentVersionNumber: wholeNumber(item.currentVersionNumber),
      createdAt: text(item.createdAt),
      updatedAt: text(item.updatedAt),
    });
  }
  return { grant, vendorResponses };
};

// ---- What a refused or failed read means for the screen ----

export type SupportAccessFailure =
  /** No active grant (never granted, expired, or revoked): back to "Granted to me". */
  | "grant_required"
  /** The RFP isn't covered by the grants, or isn't in that organization: a not-found state. */
  | "not_found"
  | "error";

export const supportAccessFailure = (status: number, code?: string | null): SupportAccessFailure => {
  if (code === "SUPPORT_GRANT_REQUIRED") return "grant_required";
  if (status === 404 || code === "PROPOSAL_NOT_FOUND") return "not_found";
  return "error";
};

// ---- Copy ----

export const grantScopeLabel = (scope: GrantScope) => (scope === "organization" ? "Whole organization" : "One RFP");

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

/** "6 days 4 hours", "3 hours 12 minutes", "45 seconds"; "Ended" at zero. */
export const formatTimeLeft = (seconds: number): string => {
  const left = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  if (left <= 0) return "Ended";
  const days = Math.floor(left / 86_400);
  const hours = Math.floor((left % 86_400) / 3_600);
  const minutes = Math.floor((left % 3_600) / 60);
  if (days > 0) return hours > 0 ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
  if (hours > 0) return minutes > 0 ? `${plural(hours, "hour")} ${plural(minutes, "minute")}` : plural(hours, "hour");
  if (minutes > 0) return plural(minutes, "minute");
  return plural(left, "second");
};

/** Under an hour left: the banner turns amber so the agent isn't cut off mid-read by surprise. */
export const isGrantEndingSoon = (seconds: number) => seconds > 0 && seconds <= 3_600;

const EXPIRY_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
};

/** Always UTC, and labelled, so the server render and the browser agree. */
export const formatGrantExpiry = (expiresAt: string | null): string => {
  if (!expiresAt) return "Unknown";
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) ? "Unknown" : `${date.toLocaleString("en-US", EXPIRY_FORMAT)} UTC`;
};

export const organizationLabel = (name: string | null | undefined) => name?.trim() || "Unnamed organization";

// ---- Routes ----

export const SUPPORT_ACCESS_PATH = "/support-access";

export const organizationRfpsPath = (organizationId: string) => `${SUPPORT_ACCESS_PATH}/${organizationId}`;
export const grantedRfpPath = (organizationId: string, rfpId: string) => `${organizationRfpsPath(organizationId)}/rfps/${rfpId}`;
export const grantedVendorResponsesPath = (organizationId: string, rfpId: string) => `${grantedRfpPath(organizationId, rfpId)}/vendor-responses`;

/** Where a grant in "Granted to me" leads: the organization's RFPs, or the one granted RFP. */
export const grantedAccessPath = (grant: Pick<GrantedAccess, "organization" | "scope" | "rfpId">) =>
  grant.scope === "rfp" && grant.rfpId ? grantedRfpPath(grant.organization.id, grant.rfpId) : organizationRfpsPath(grant.organization.id);

/** Why an agent was sent back to "Granted to me". A fixed set: nothing from the URL is echoed. */
export const ACCESS_NOTICES = {
  ended: "Support access to that organization has ended or was revoked, so its RFPs are closed. Ask the organization's Owner or Admin for a new grant if you still need it.",
} as const;

export type AccessNotice = keyof typeof ACCESS_NOTICES;

export const isAccessNotice = (value: unknown): value is AccessNotice =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ACCESS_NOTICES, value);

export const accessEndedPath = () => `${SUPPORT_ACCESS_PATH}?notice=ended`;

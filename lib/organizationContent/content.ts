// The organization content browser (owner decision, 2026-11-17): RFPilot staff can VIEW
// everything in every organization with no grant: proposals, vendor responses, members, teams,
// templates and the vendor list. Read-only. The backend routes are the eight GETs under
// /api/v1/admin/organizations/:organizationId; each successful read (and each 404) is recorded
// in the staff organization's audit trail, never in the customer's.
//
// The admin app has no generated contracts, so everything the backend sends is parsed here
// before a screen uses it, field by field: a field added to a response later does not reach
// the screen by accident.

import { ORGANIZATIONS_PATH } from "@/lib/organizationAccount";

/* ---------- ids and paths ---------- */

/** The backend refuses anything but a 24-character lower-case hex id; so do the links built here. */
export const isContentId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{24}$/.test(value);

export const CONTENT_SECTIONS = ["proposals", "members", "teams", "templates", "vendors"] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

export const CONTENT_SECTION_LABELS: Record<ContentSection, string> = {
  proposals: "Proposals",
  members: "Members",
  teams: "Teams",
  templates: "Templates",
  vendors: "Vendors",
};

const organizationBase = (organizationId: string) => `${ORGANIZATIONS_PATH}/${encodeURIComponent(organizationId)}`;

export const organizationSectionPath = (organizationId: string, section: ContentSection): string =>
  `${organizationBase(organizationId)}/${section}`;
export const organizationProposalsPath = (organizationId: string) => organizationSectionPath(organizationId, "proposals");
export const organizationProposalPath = (organizationId: string, proposalId: string) =>
  `${organizationProposalsPath(organizationId)}/${encodeURIComponent(proposalId)}`;
export const organizationVendorResponsesPath = (organizationId: string, proposalId: string) =>
  `${organizationProposalPath(organizationId, proposalId)}/vendor-responses`;
export const organizationMembersPath = (organizationId: string) => organizationSectionPath(organizationId, "members");
export const organizationTeamsPath = (organizationId: string) => organizationSectionPath(organizationId, "teams");
export const organizationTemplatesPath = (organizationId: string) => organizationSectionPath(organizationId, "templates");
export const organizationTemplatePath = (organizationId: string, templateId: string) =>
  `${organizationTemplatesPath(organizationId)}/${encodeURIComponent(templateId)}`;
export const organizationVendorsPath = (organizationId: string) => organizationSectionPath(organizationId, "vendors");

/** A list address with only the query values that are set, so page 1 with no filter is the bare path. */
export const withQuery = (path: string, query: Record<string, string | number | undefined>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
    params.set(key, String(value));
  }
  return params.size ? `${path}?${params.toString()}` : path;
};

/* ---------- what a page asks for ---------- */

export const STATUS_FILTERS = ["all", "active", "archived"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const TEMPLATE_SCOPES = ["all", "organization", "personal"] as const;
export type TemplateScope = (typeof TEMPLATE_SCOPES)[number];

export type ListQuery = { page: number; search: string };
export type TemplatesQuery = ListQuery & { scope: TemplateScope; status: StatusFilter };
export type VendorsQuery = ListQuery & { status: StatusFilter };

type RawQuery = Record<string, string | string[] | undefined> | undefined;

const one = (value: string | string[] | undefined): string => (typeof value === "string" ? value : "");

/** A page number from the address bar: 1 unless it is a whole number from 2 to 10,000. */
export const pageOf = (value: unknown): number => {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,5}$/.test(raw)) return 1;
  const page = Number(raw);
  return page >= 1 && page <= 10_000 ? page : 1;
};

/** The backend cuts a search at 200 characters; so does the request. */
export const searchOf = (value: unknown): string => (typeof value === "string" ? value.trim().slice(0, 200) : "");

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : allowed[0];

export const listQueryOf = (query: RawQuery): ListQuery => ({ page: pageOf(one(query?.page)), search: searchOf(one(query?.search)) });
export const pageQueryOf = (query: RawQuery): { page: number } => ({ page: pageOf(one(query?.page)) });
/** A filter value outside its list is never sent (the backend answers 400 to one): it reads as "all". */
export const templatesQueryOf = (query: RawQuery): TemplatesQuery => ({
  ...listQueryOf(query),
  scope: oneOf(one(query?.scope), TEMPLATE_SCOPES),
  status: oneOf(one(query?.status), STATUS_FILTERS),
});
export const vendorsQueryOf = (query: RawQuery): VendorsQuery => ({
  ...listQueryOf(query),
  status: oneOf(one(query?.status), STATUS_FILTERS),
});

/* ---------- reading the responses ---------- */

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

export type Pagination = { page: number; perPage: number; total: number; totalPages: number };

const parsePagination = (value: unknown, rows: number): Pagination => {
  const pagination = record(value);
  const total = wholeNumber(pagination?.total);
  return {
    page: Math.max(1, wholeNumber(pagination?.page)),
    perPage: Math.max(1, wholeNumber(pagination?.perPage) || rows),
    total: Math.max(total, rows),
    totalPages: Math.max(1, wholeNumber(pagination?.totalPages)),
  };
};

export type Person = { id: string; name: string | null; email: string | null };

const parsePerson = (value: unknown): Person | null => {
  const raw = record(value);
  return raw && typeof raw.id === "string" ? { id: raw.id, name: text(raw.name), email: text(raw.email) } : null;
};

/** Every response names the organization it read. One that names another is never shown. */
const forOrganization = (value: unknown, organizationId: string): Record<string, unknown> | null => {
  const raw = record(value);
  return raw && raw.organizationId === organizationId ? raw : null;
};

// ---- Proposals ----

export type ProposalListItem = {
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
  owner: Person | null;
};

export type ProposalsPage = { rfps: ProposalListItem[]; pagination: Pagination };

export const parseProposalsPage = (value: unknown, organizationId: string): ProposalsPage | null => {
  const raw = forOrganization(value, organizationId);
  if (!raw || !Array.isArray(raw.rfps)) return null;
  const rfps: ProposalListItem[] = [];
  for (const row of raw.rfps) {
    const item = record(row);
    if (!item || !isContentId(item.id)) continue;
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
      owner: parsePerson(item.owner),
    });
  }
  return { rfps, pagination: parsePagination(raw.pagination, rfps.length) };
};

export type ProposalDetail = {
  /** The proposal as the planner filled it in. Sections are put into words by proposalFields. */
  rfp: Record<string, unknown> & { id: string };
  owner: Person | null;
};

export const parseProposalDetail = (value: unknown, organizationId: string, proposalId: string): ProposalDetail | null => {
  const raw = forOrganization(value, organizationId);
  const rfp = record(raw?.rfp);
  // Never show a proposal other than the one asked for.
  if (!raw || !rfp || rfp.id !== proposalId) return null;
  return { rfp: rfp as ProposalDetail["rfp"], owner: parsePerson(raw.owner) };
};

export type VendorResponse = {
  id: string;
  vendorName: string | null;
  submittedBy: string | null;
  email: string | null;
  message: string | null;
  /** A count only: the backend sends no documents, and none are linked. */
  documentCount: number;
  currentVersionNumber: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type VendorResponses = { vendorResponses: VendorResponse[] };

export const parseVendorResponses = (value: unknown, organizationId: string, proposalId: string): VendorResponses | null => {
  const raw = forOrganization(value, organizationId);
  if (!raw || raw.proposalId !== proposalId || !Array.isArray(raw.vendorResponses)) return null;
  const vendorResponses: VendorResponse[] = [];
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
  return { vendorResponses };
};

// ---- Members ----

export type MemberTeam = { id: string; name: string; archived: boolean; isManager: boolean };

export type Member = {
  userId: string;
  name: string | null;
  email: string | null;
  roles: string[];
  status: string;
  teams: MemberTeam[];
  joinedAt: string | null;
  lastSignedInAt: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | null;
  createdAt: string | null;
};

export type MembersPage = {
  members: Member[];
  pagination: Pagination;
  pendingInvitations: PendingInvitation[];
  pendingInvitationsTotal: number;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap((entry) => (typeof entry === "string" && entry.trim() ? [entry.trim()] : [])) : [];

export const parseMembersPage = (value: unknown, organizationId: string): MembersPage | null => {
  const raw = forOrganization(value, organizationId);
  if (!raw || !Array.isArray(raw.members)) return null;
  const members: Member[] = [];
  for (const row of raw.members) {
    const item = record(row);
    if (!item || typeof item.userId !== "string" || !item.userId) continue;
    members.push({
      userId: item.userId,
      name: text(item.name),
      email: text(item.email),
      roles: strings(item.roles),
      status: text(item.status) ?? "",
      teams: (Array.isArray(item.teams) ? item.teams : []).flatMap((entry) => {
        const team = record(entry);
        return team && typeof team.id === "string"
          ? [{ id: team.id, name: text(team.name) ?? "Unnamed team", archived: team.archived === true, isManager: team.isManager === true }]
          : [];
      }),
      joinedAt: instant(item.joinedAt),
      lastSignedInAt: instant(item.lastSignedInAt),
    });
  }
  const pendingInvitations: PendingInvitation[] = [];
  for (const row of Array.isArray(raw.pendingInvitations) ? raw.pendingInvitations : []) {
    const item = record(row);
    if (!item || typeof item.id !== "string" || !text(item.email)) continue;
    pendingInvitations.push({
      id: item.id,
      email: text(item.email) as string,
      role: text(item.role) ?? "",
      status: text(item.status) ?? "",
      expiresAt: instant(item.expiresAt),
      createdAt: instant(item.createdAt),
    });
  }
  return {
    members,
    pagination: parsePagination(raw.pagination, members.length),
    pendingInvitations,
    pendingInvitationsTotal: Math.max(wholeNumber(raw.pendingInvitationsTotal), pendingInvitations.length),
  };
};

// ---- Teams ----

export type Team = {
  id: string;
  name: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  memberCount: number;
  managers: Person[];
};

export type TeamsList = { teams: Team[] };

export const parseTeams = (value: unknown, organizationId: string): TeamsList | null => {
  const raw = forOrganization(value, organizationId);
  if (!raw || !Array.isArray(raw.teams)) return null;
  const teams: Team[] = [];
  for (const row of raw.teams) {
    const item = record(row);
    if (!item || typeof item.id !== "string" || !item.id) continue;
    teams.push({
      id: item.id,
      name: text(item.name) ?? "Unnamed team",
      archived: item.archived === true,
      archivedAt: instant(item.archivedAt),
      createdAt: instant(item.createdAt),
      memberCount: wholeNumber(item.memberCount),
      managers: (Array.isArray(item.managers) ? item.managers : []).flatMap((entry) => {
        const person = parsePerson(entry);
        return person ? [person] : [];
      }),
    });
  }
  return { teams };
};

// ---- Templates ----

export type TemplateSummary = {
  id: string;
  scope: string;
  title: string;
  description: string | null;
  eventName: string | null;
  presentationLayout: string | null;
  publishedAt: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  owner: Person | null;
};

export type TemplatesPage = { templates: TemplateSummary[]; pagination: Pagination };
export type TemplateDetail = TemplateSummary & { content: Record<string, unknown> };

const parseTemplateSummary = (value: unknown): TemplateSummary | null => {
  const item = record(value);
  if (!item || !isContentId(item.id)) return null;
  return {
    id: item.id,
    scope: text(item.scope) ?? "",
    title: text(item.title) ?? "Untitled template",
    description: text(item.description),
    eventName: text(item.eventName),
    presentationLayout: text(item.presentationLayout),
    publishedAt: instant(item.publishedAt),
    archived: item.archived === true,
    archivedAt: instant(item.archivedAt),
    createdAt: instant(item.createdAt),
    updatedAt: instant(item.updatedAt),
    owner: parsePerson(item.owner),
  };
};

export const parseTemplatesPage = (value: unknown, organizationId: string): TemplatesPage | null => {
  const raw = forOrganization(value, organizationId);
  if (!raw || !Array.isArray(raw.templates)) return null;
  const templates = raw.templates.flatMap((row) => {
    const summary = parseTemplateSummary(row);
    return summary ? [summary] : [];
  });
  return { templates, pagination: parsePagination(raw.pagination, templates.length) };
};

export const parseTemplateDetail = (value: unknown, organizationId: string, templateId: string): { template: TemplateDetail } | null => {
  const raw = forOrganization(value, organizationId);
  const summary = parseTemplateSummary(raw?.template);
  if (!raw || !summary || summary.id !== templateId) return null;
  return { template: { ...summary, content: record(record(raw.template)?.content) ?? {} } };
};

// ---- Vendors ----

export type Vendor = {
  id: string;
  company: string;
  category: string | null;
  contacts: Array<{ name: string | null; email: string | null }>;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type VendorsPage = { vendors: Vendor[]; pagination: Pagination };

export const parseVendorsPage = (value: unknown, organizationId: string): VendorsPage | null => {
  const raw = forOrganization(value, organizationId);
  if (!raw || !Array.isArray(raw.vendors)) return null;
  const vendors: Vendor[] = [];
  for (const row of raw.vendors) {
    const item = record(row);
    if (!item || typeof item.id !== "string" || !item.id) continue;
    vendors.push({
      id: item.id,
      company: text(item.company) ?? "Unnamed company",
      category: text(item.category),
      contacts: (Array.isArray(item.contacts) ? item.contacts : []).flatMap((entry) => {
        const contact = record(entry);
        const name = text(contact?.name);
        const email = text(contact?.email);
        return name || email ? [{ name, email }] : [];
      }),
      archived: item.archived === true,
      archivedAt: instant(item.archivedAt),
      createdAt: instant(item.createdAt),
      updatedAt: instant(item.updatedAt),
    });
  }
  return { vendors, pagination: parsePagination(raw.pagination, vendors.length) };
};

/* ---------- when a page can't show its content ---------- */

export type ContentFailure =
  /** The organization id in the address is not an id. */
  | "invalid_id"
  /** The organization is not there. */
  | "organization_not_found"
  /** The proposal or template is not there, or belongs to another organization. */
  | "record_not_found"
  /** The admin app is ahead of the API: the route itself answers 404 until the backend release. */
  | "not_available"
  | "forbidden"
  | "session_ended"
  | "rate_limited"
  | "unavailable";

/* A missing organization, a missing record and a missing route are all 404. Only the backend's
   own code tells them apart; a 404 without one comes from the API not having the route yet. */
export const contentFailure = (status: number, code: string | null): ContentFailure => {
  if (code === "INVALID_ORGANIZATION_ID") return "invalid_id";
  if (code === "ORGANIZATION_NOT_FOUND") return "organization_not_found";
  if (code === "PROPOSAL_NOT_FOUND" || code === "TEMPLATE_NOT_FOUND" || code === "INVALID_PROPOSAL_ID" || code === "INVALID_TEMPLATE_ID") {
    return "record_not_found";
  }
  if (status === 404) return "not_available";
  if (status === 401) return "session_ended";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  return "unavailable";
};

/** What a page was showing, for the wording of its failure. */
export type ContentKind = ContentSection | "proposal" | "vendor_responses" | "template";

const KIND_WORDS: Record<ContentKind, { these: string; record: string | null }> = {
  proposals: { these: "this organization's proposals", record: null },
  proposal: { these: "this proposal", record: "Proposal" },
  vendor_responses: { these: "this proposal's vendor responses", record: "Proposal" },
  members: { these: "this organization's members", record: null },
  teams: { these: "this organization's teams", record: null },
  templates: { these: "this organization's templates", record: null },
  template: { these: "this template", record: "Template" },
  vendors: { these: "this organization's vendors", record: null },
};

export const contentFailureCopy = (failure: ContentFailure, kind: ContentKind): { title: string; message: string } => {
  const { these, record: recordName } = KIND_WORDS[kind];
  switch (failure) {
    case "invalid_id":
      return {
        title: "This link doesn't point to an organization",
        message: "The address is incomplete or mistyped. Open the organization from the Organizations list.",
      };
    case "organization_not_found":
      return { title: "Organization not found", message: "This organization doesn't exist, or it has been removed." };
    case "record_not_found":
      return {
        title: `${recordName ?? "Page"} not found`,
        message: `It doesn't exist in this organization, or it has been removed. Nothing about it is shown.`,
      };
    case "not_available":
      return {
        title: "Not available yet",
        message: `Staff can view ${these} here after the next RFPilot update.`,
      };
    case "forbidden":
      return { title: "You can't view this", message: "Only RFPilot staff can view an organization's content." };
    case "session_ended":
      return { title: "Your session has ended", message: `Sign in again to view ${these}.` };
    case "rate_limited":
      return {
        title: "Too many pages opened",
        message: "You have opened a lot of customer content in a short time. Wait a few minutes, up to 15, then try again.",
      };
    default:
      return {
        title: "Unable to load this page",
        message: "The server couldn't be reached or didn't answer as expected. Try again in a moment.",
      };
  }
};

export type ContentResult<T> = { ok: true; data: T } | { ok: false; failure: ContentFailure };

/* ---------- which backend reads each page makes ---------- */

/** The eight audited reads. A page is handed only the one it shows. */
export type ContentReads = {
  proposals(organizationId: string, query: ListQuery): Promise<ContentResult<ProposalsPage>>;
  proposal(organizationId: string, proposalId: string): Promise<ContentResult<ProposalDetail>>;
  vendorResponses(organizationId: string, proposalId: string): Promise<ContentResult<VendorResponses>>;
  members(organizationId: string, query: { page: number }): Promise<ContentResult<MembersPage>>;
  teams(organizationId: string): Promise<ContentResult<TeamsList>>;
  templates(organizationId: string, query: TemplatesQuery): Promise<ContentResult<TemplatesPage>>;
  template(organizationId: string, templateId: string): Promise<ContentResult<{ template: TemplateDetail }>>;
  vendors(organizationId: string, query: VendorsQuery): Promise<ContentResult<VendorsPage>>;
};

const refuse = (failure: ContentFailure): { ok: false; failure: ContentFailure } => ({ ok: false, failure });

/* Each page view makes exactly one read: the one it shows. Its loader is typed to be handed
   that read alone, and asks nothing when the address is not made of ids. The organization's
   name is not on these pages: it would take a second audited read. */

export const loadProposalsPage = async (reads: Pick<ContentReads, "proposals">, organizationId: string, query: RawQuery) => {
  const asked = listQueryOf(query);
  if (!isContentId(organizationId)) return { query: asked, result: refuse("invalid_id") as ContentResult<ProposalsPage> };
  return { query: asked, result: await reads.proposals(organizationId, asked) };
};

export const loadProposalPage = async (reads: Pick<ContentReads, "proposal">, organizationId: string, proposalId: string): Promise<ContentResult<ProposalDetail>> => {
  if (!isContentId(organizationId)) return refuse("invalid_id");
  if (!isContentId(proposalId)) return refuse("record_not_found");
  return reads.proposal(organizationId, proposalId);
};

export const loadVendorResponsesPage = async (reads: Pick<ContentReads, "vendorResponses">, organizationId: string, proposalId: string): Promise<ContentResult<VendorResponses>> => {
  if (!isContentId(organizationId)) return refuse("invalid_id");
  if (!isContentId(proposalId)) return refuse("record_not_found");
  return reads.vendorResponses(organizationId, proposalId);
};

export const loadMembersPage = async (reads: Pick<ContentReads, "members">, organizationId: string, query: RawQuery) => {
  const asked = pageQueryOf(query);
  if (!isContentId(organizationId)) return { query: asked, result: refuse("invalid_id") as ContentResult<MembersPage> };
  return { query: asked, result: await reads.members(organizationId, asked) };
};

export const loadTeamsPage = async (reads: Pick<ContentReads, "teams">, organizationId: string): Promise<ContentResult<TeamsList>> => {
  if (!isContentId(organizationId)) return refuse("invalid_id");
  return reads.teams(organizationId);
};

export const loadTemplatesPage = async (reads: Pick<ContentReads, "templates">, organizationId: string, query: RawQuery) => {
  const asked = templatesQueryOf(query);
  if (!isContentId(organizationId)) return { query: asked, result: refuse("invalid_id") as ContentResult<TemplatesPage> };
  return { query: asked, result: await reads.templates(organizationId, asked) };
};

export const loadTemplatePage = async (reads: Pick<ContentReads, "template">, organizationId: string, templateId: string): Promise<ContentResult<{ template: TemplateDetail }>> => {
  if (!isContentId(organizationId)) return refuse("invalid_id");
  if (!isContentId(templateId)) return refuse("record_not_found");
  return reads.template(organizationId, templateId);
};

export const loadVendorsPage = async (reads: Pick<ContentReads, "vendors">, organizationId: string, query: RawQuery) => {
  const asked = vendorsQueryOf(query);
  if (!isContentId(organizationId)) return { query: asked, result: refuse("invalid_id") as ContentResult<VendorsPage> };
  return { query: asked, result: await reads.vendors(organizationId, asked) };
};

/* ---------- the old Support access addresses ---------- */

/* /support-access was the grant workspace. Each old address goes to its place in the
   organization content browser; one that is not made of ids goes to the Organizations list.
   Nothing is read to decide. */
export const supportAccessRedirect = (segments: { organizationId?: string; rfpId?: string; vendorResponses?: boolean } = {}): string => {
  const { organizationId, rfpId, vendorResponses } = segments;
  if (organizationId === undefined) return ORGANIZATIONS_PATH;
  if (!isContentId(organizationId)) return ORGANIZATIONS_PATH;
  if (rfpId === undefined) return organizationBase(organizationId);
  if (!isContentId(rfpId)) return organizationProposalsPath(organizationId);
  return vendorResponses ? organizationVendorResponsesPath(organizationId, rfpId) : organizationProposalPath(organizationId, rfpId);
};

/* ---------- wording ---------- */

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  organization_admin: "Admin",
  team_manager: "Team Manager",
  planner: "Planner",
  viewer: "Viewer",
};

const readable = (value: string): string => {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
};

/** The role names staff know; a role added later still reads as words. */
export const roleLabel = (role: string): string => ROLE_LABELS[role] ?? (readable(role) || "No role");
export const rolesLabel = (roles: string[]): string => (roles.length ? roles.map(roleLabel).join(", ") : "No role");

export type Tone = "good" | "warning" | "danger" | "neutral";

const MEMBER_STATUSES: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "good" },
  deactivated: { label: "Deactivated", tone: "danger" },
  invited: { label: "Invited", tone: "warning" },
  pending: { label: "Pending", tone: "warning" },
};

export const memberStatusBadge = (status: string): { label: string; tone: Tone } =>
  MEMBER_STATUSES[status] ?? { label: readable(status) || "Unknown status", tone: "neutral" };

export const personName = (person: { name: string | null } | null): string => person?.name || "Unnamed member";

export const templateScopeLabel = (scope: string): string =>
  scope === "organization" ? "Organization template" : scope === "personal" ? "Personal template" : readable(scope) || "Template";

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = { all: "All", active: "Active", archived: "Archived" };
export const TEMPLATE_SCOPE_LABELS: Record<TemplateScope, string> = { all: "All templates", organization: "Organization", personal: "Personal" };

// The pages are rendered on the server, so times are given in UTC and say so.
export const formatContentDate = (iso: string | null): string => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not recorded";
  return `${date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} UTC`;
};

/** "Showing 21–40 of 57 members": the range a list page is on. */
export const pageRange = (pagination: Pagination, rows: number): { start: number; end: number } => {
  const start = pagination.total === 0 || rows === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  return { start, end: start === 0 ? 0 : Math.min(start + rows - 1, pagination.total) };
};

// Legacy customer placement (backend ORG-110, /api/admin/legacy-customers): the shapes the
// admin app keeps from the five routes, the checks it makes before asking, and the fixed wording
// for every refusal. Nothing here talks to the backend; app/actions/legacyCustomers.ts does.
//
// Placement moves a customer's records between organizations. So every value that goes to the
// backend is rebuilt here from checked parts (never a client object passed through), every
// response is read as an allowlist, and backend error text never reaches the screen: a code is
// mapped to a sentence written here.

import { countLabel } from "@/lib/plural";

export const LEGACY_CUSTOMERS_PATH = "/legacy-customers";

/** A MongoDB id as the backend writes it: 24 lower-case hex. */
export const isPlacementId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{24}$/.test(value);

/** A run id as the backend makes it: `placement-<ISO instant>-<8 hex>`. */
export const isRunId = (value: unknown): value is string =>
  typeof value === "string" && /^placement-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[0-9a-f]{8}$/.test(value);

/** The run id of an address segment, which may arrive percent-encoded (it holds colons). */
export const runIdFromSegment = (segment: unknown): string | null => {
  if (typeof segment !== "string") return null;
  if (isRunId(segment)) return segment;
  try {
    const decoded = decodeURIComponent(segment);
    return isRunId(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

export const placeCustomerPath = (userId: string) => `${LEGACY_CUSTOMERS_PATH}/${userId}/place`;
export const placementRunPath = (runId: string) => `${LEGACY_CUSTOMERS_PATH}/placements/${encodeURIComponent(runId)}`;

/** Sent as Idempotency-Key. The backend takes 1 to 200 printable characters; this app sends a UUID. */
export const isIdempotencyKey = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9-]{16,64}$/.test(value);

// ── What the backend accepts ────────────────────────────────────────────────────────────────

export const PLACEMENT_ROLES = ["organization_admin", "team_manager", "planner"] as const;
export type PlacementRole = (typeof PLACEMENT_ROLES)[number];
export const PLACEMENT_ROLE_LABELS: Record<PlacementRole, string> = {
  organization_admin: "Organization admin",
  team_manager: "Team manager",
  planner: "Planner",
};
export const isPlacementRole = (value: unknown): value is PlacementRole =>
  typeof value === "string" && (PLACEMENT_ROLES as readonly string[]).includes(value);
/** The role a run reports: one of the three, or Owner for a customer placed in a new organization. */
export const roleLabel = (role: string | null): string =>
  role === "owner" ? "Owner" : isPlacementRole(role) ? PLACEMENT_ROLE_LABELS[role] : "Unknown role";

export const ORGANIZATION_TYPES = ["corporate", "association", "agency", "venue", "government", "other"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  corporate: "Corporate",
  association: "Association",
  agency: "Agency",
  venue: "Venue",
  government: "Government",
  other: "Other",
};

// The same limits as the backend's organization model. The API checks the name and the type
// when the request is made; the other four are only checked when the task writes the
// organization, where a bad value fails the whole run. So they are all checked here first.
export const ORGANIZATION_LIMITS = { name: 200, industry: 120, eventsPerYear: 100_000 } as const;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export type NewOrganization = {
  name: string;
  type?: OrganizationType;
  industry?: string;
  country?: string;
  timeZone?: string;
  eventsPerYear?: number;
};
export type PlacementRequest =
  | { target: "new"; organization: NewOrganization }
  | { target: "existing"; organizationId: string; role: PlacementRole; teamId?: string };

export type PlacementField = "target" | "name" | "type" | "industry" | "country" | "timeZone" | "eventsPerYear" | "organizationId" | "role" | "teamId";
export type FieldErrors = Partial<Record<PlacementField, string>>;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const blank = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/* Builds the request body from whatever was passed, field by field. Unknown fields are dropped;
   a field with a wrong value refuses the whole request, with the message the form shows. */
export const validatePlacementRequest = (input: unknown): { ok: true; request: PlacementRequest } | { ok: false; errors: FieldErrors } => {
  const raw = record(input);
  const errors: FieldErrors = {};
  if (raw?.target === "new") {
    const given = record(raw.organization) ?? {};
    const organization: NewOrganization = { name: "" };
    const name = typeof given.name === "string" ? given.name.trim() : "";
    if (!name || name.length > ORGANIZATION_LIMITS.name) errors.name = `Enter the organization's name (up to ${ORGANIZATION_LIMITS.name} characters).`;
    else organization.name = name;
    if (!blank(given.type)) {
      if ((ORGANIZATION_TYPES as readonly unknown[]).includes(given.type)) organization.type = given.type as OrganizationType;
      else errors.type = "Choose a type from the list.";
    }
    if (!blank(given.industry)) {
      const industry = typeof given.industry === "string" ? given.industry.trim() : "";
      if (!industry || industry.length > ORGANIZATION_LIMITS.industry) errors.industry = `Industry can be up to ${ORGANIZATION_LIMITS.industry} characters.`;
      else organization.industry = industry;
    }
    if (!blank(given.country)) {
      const country = typeof given.country === "string" ? given.country.trim().toUpperCase() : "";
      if (!/^[A-Z]{2}$/.test(country)) errors.country = "Enter the two-letter country code, for example US.";
      else organization.country = country;
    }
    if (!blank(given.timeZone)) {
      const timeZone = typeof given.timeZone === "string" ? given.timeZone.trim() : "";
      if (!timeZone || timeZone.length > 64 || !isTimeZone(timeZone)) errors.timeZone = "Enter a time zone name, for example America/New_York.";
      else organization.timeZone = timeZone;
    }
    if (!blank(given.eventsPerYear)) {
      const events = typeof given.eventsPerYear === "number" ? given.eventsPerYear : typeof given.eventsPerYear === "string" && /^\d{1,6}$/.test(given.eventsPerYear.trim()) ? Number(given.eventsPerYear.trim()) : NaN;
      if (!Number.isInteger(events) || events < 0 || events > ORGANIZATION_LIMITS.eventsPerYear) {
        errors.eventsPerYear = `Events per year is a whole number from 0 to ${ORGANIZATION_LIMITS.eventsPerYear.toLocaleString("en-US")}.`;
      } else organization.eventsPerYear = events;
    }
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, request: { target: "new", organization } };
  }
  if (raw?.target === "existing") {
    if (!isPlacementId(raw.organizationId)) errors.organizationId = "Choose an organization from the search results.";
    if (!isPlacementRole(raw.role)) errors.role = "Choose a role.";
    if (!blank(raw.teamId) && !isPlacementId(raw.teamId)) errors.teamId = "Choose a team from the list, or no team.";
    if (Object.keys(errors).length) return { ok: false, errors };
    return {
      ok: true,
      request: {
        target: "existing",
        organizationId: raw.organizationId as string,
        role: raw.role as PlacementRole,
        ...(isPlacementId(raw.teamId) ? { teamId: raw.teamId } : {}),
      },
    };
  }
  return { ok: false, errors: { target: "Choose a new or an existing organization." } };
};

/** What a search box sends: trimmed, and nothing at all below two characters. */
export const searchTermOf = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const term = value.trim().slice(0, SEARCH_MAX_LENGTH);
  return term.length >= SEARCH_MIN_LENGTH ? term : null;
};

// ── What the backend answers ────────────────────────────────────────────────────────────────

const text = (value: unknown, max = 300): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
const instant = (value: unknown): string | null => (typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null);

export type LegacyCustomer = { userId: string; name: string | null; email: string | null; company: string | null; proposalCount: number };

export const parseLegacyCustomers = (data: unknown): LegacyCustomer[] | null => {
  const rows = record(data)?.customers;
  if (!Array.isArray(rows)) return null;
  const customers: LegacyCustomer[] = [];
  for (const row of rows) {
    const item = record(row);
    if (!item || !isPlacementId(item.userId)) continue;
    customers.push({ userId: item.userId, name: text(item.name), email: text(item.email), company: text(item.company), proposalCount: count(item.proposalCount) });
  }
  return customers;
};

export type TargetOrganization = { organizationId: string; name: string; slug: string | null };

export const parseTargetOrganizations = (data: unknown): TargetOrganization[] | null => {
  const rows = record(data)?.organizations;
  if (!Array.isArray(rows)) return null;
  const organizations: TargetOrganization[] = [];
  for (const row of rows) {
    const item = record(row);
    if (!item || !isPlacementId(item.organizationId)) continue;
    organizations.push({ organizationId: item.organizationId, name: text(item.name, 200) ?? "Unnamed organization", slug: text(item.slug, 80) });
  }
  return organizations;
};

export const RUN_STATUSES = ["queued", "running", "succeeded", "failed", "rolled_back"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
/** The run is still being worked on: the only two statuses a screen keeps reading for. */
export const isActiveStatus = (status: RunStatus) => status === "queued" || status === "running";

const RUN_STATES = ["queued", "started", "done", "failed", "aborted", "rolling_back", "rolled_back"] as const;
export type RunState = (typeof RUN_STATES)[number];
export type RunOperation = "placement" | "rollback";
const TASK_STATUSES = ["queued", "running", "succeeded", "failed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
const sum = (value: unknown): number => {
  const counts = record(value);
  return counts ? Object.values(counts).reduce<number>((total, item) => total + count(item), 0) : 0;
};
/** A failure code is an identifier, shown as one; anything else is dropped. */
const codeOf = (value: unknown): string | null => (typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : null);

export type RunVerification = { passed: boolean; leftInHolding: number; orphanedProposalsInTarget: number; lostProposals: number };

const parseVerification = (value: unknown): RunVerification | null => {
  const raw = record(value);
  if (!raw || typeof raw.passed !== "boolean") return null;
  const leftovers = record(raw.holdingLeftovers);
  return {
    passed: raw.passed,
    leftInHolding: sum(leftovers?.mongo) + sum(leftovers?.postgres),
    orphanedProposalsInTarget: count(raw.orphanedProposalsInTarget),
    lostProposals: Array.isArray(raw.lostProposals) ? raw.lostProposals.length : 0,
  };
};

export type RunTask = {
  operation: RunOperation;
  status: TaskStatus;
  requestedAt: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  code: string | null;
  /** The three flags the runbook acts on, and whether failed checks were rolled back by the task itself. */
  auditUnconfirmed: boolean;
  needsOperatorCheck: boolean;
  rolledBack: boolean | null;
};

export type PlacementRun = {
  runId: string;
  userId: string | null;
  targetOrganizationId: string | null;
  createdOrganization: boolean;
  role: string | null;
  teamId: string | null;
  state: RunState | null;
  status: RunStatus;
  operation: RunOperation;
  rollbackRequired: boolean;
  verification: RunVerification | null;
  /** Proposals given to the customer after the placement, which a rollback leaves in the organization. */
  proposalsLeftInTarget: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  task: RunTask | null;
};

/* The run as GET /placements/:runId returns it, kept as an allowlist. `error` and `task.message`
   are sentences the backend wrote; they are not kept. The screen words a failure from its code. */
export const parsePlacementRun = (value: unknown): PlacementRun | null => {
  const raw = record(value);
  const status = oneOf(raw?.status, RUN_STATUSES);
  if (!raw || !isRunId(raw.runId) || !status) return null;
  const task = record(raw.task);
  const taskStatus = oneOf(task?.status, TASK_STATUSES);
  const details = record(task?.details);
  const leftInTarget = record(raw.leftInTarget);
  return {
    runId: raw.runId,
    userId: isPlacementId(raw.userId) ? raw.userId : null,
    targetOrganizationId: isPlacementId(raw.targetOrganizationId) ? raw.targetOrganizationId : null,
    createdOrganization: raw.createdOrganization === true,
    role: raw.role === "owner" || isPlacementRole(raw.role) ? raw.role : null,
    teamId: isPlacementId(raw.teamId) ? raw.teamId : null,
    state: oneOf(raw.state, RUN_STATES),
    status,
    operation: raw.operation === "rollback" ? "rollback" : "placement",
    rollbackRequired: raw.rollbackRequired === true,
    verification: parseVerification(raw.verification) ?? parseVerification(details?.verification),
    proposalsLeftInTarget: leftInTarget ? count(leftInTarget.proposals) : null,
    createdAt: instant(raw.createdAt),
    updatedAt: instant(raw.updatedAt),
    task:
      task && taskStatus
        ? {
            operation: task.operation === "rollback" ? "rollback" : "placement",
            status: taskStatus,
            requestedAt: instant(task.requestedAt),
            startedAt: instant(task.startedAt),
            heartbeatAt: instant(task.heartbeatAt),
            finishedAt: instant(task.finishedAt),
            code: codeOf(task.code),
            auditUnconfirmed: details?.auditUnconfirmed === true,
            needsOperatorCheck: details?.needsOperatorCheck === true,
            rolledBack: typeof details?.rolledBack === "boolean" ? details.rolledBack : null,
          }
        : null,
  };
};

export type StartedRun = { runId: string; replayed: boolean; run: PlacementRun | null };

/** The run a 202 (task) names, or the run id a 201 / 200 names (a server that places inside the request). */
export const startedRunOf = (data: unknown): StartedRun | null => {
  const raw = record(data);
  const placement = record(raw?.placement) ?? record(raw?.rollback);
  return placement && isRunId(placement.runId) ? { runId: placement.runId, replayed: raw?.replayed === true, run: parsePlacementRun(placement) } : null;
};

// ── Refusals ────────────────────────────────────────────────────────────────────────────────

export type PlacementFailure =
  | "session_ended"
  /** 403 PLACEMENT_FORBIDDEN, or the route guard's plain 403. */
  | "forbidden"
  | "staff_organization_required"
  /** 429 PLACEMENT_RATE_LIMITED: this staff member has used an allowance. */
  | "rate_limited"
  /** 429 PLACEMENT_CAPACITY_REACHED: another placement or rollback is running. */
  | "capacity_reached"
  /** 503 PLACEMENT_REQUIRES_MIGRATION_ROLE: the server cannot start placements. */
  | "not_configured"
  | "misconfigured"
  /** 503 …_TASK_START_FAILED: nothing moved, the request can be made again. */
  | "start_failed"
  | "invalid_id"
  | "invalid_request"
  | "customer_not_found"
  /** 409 NOT_A_LEGACY_CUSTOMER: already placed, or never a legacy customer. */
  | "already_placed"
  /** 409 PLACEMENT_IN_PROGRESS on a placement: this customer is being placed right now. */
  | "placement_in_progress"
  | "organization_not_found"
  | "already_a_member"
  | "unknown_team"
  | "idempotency_conflict"
  | "run_not_found"
  /** Rollback refusals: the run cannot be rolled back as it stands. */
  | "run_still_running"
  | "rollback_in_progress"
  | "already_rolled_back"
  | "nothing_to_roll_back"
  | "organization_in_use"
  | "user_is_owner"
  | "rollback_conflict"
  /** A server that places inside the request answered with the placement's own failure. */
  | "placement_failed"
  | "verification_failed"
  /** 404 with no known code: the API does not have the route. */
  | "not_available"
  | "unavailable";

export type PlacementAction = "list" | "search" | "place" | "run" | "rollback";

const BY_CODE: Record<string, PlacementFailure> = {
  PLACEMENT_FORBIDDEN: "forbidden",
  STAFF_ORGANIZATION_REQUIRED: "staff_organization_required",
  PLACEMENT_RATE_LIMITED: "rate_limited",
  PLACEMENT_CAPACITY_REACHED: "capacity_reached",
  PLACEMENT_REQUIRES_MIGRATION_ROLE: "not_configured",
  PLACEMENT_TASK_MISCONFIGURED: "misconfigured",
  PLACEMENT_TASK_START_FAILED: "start_failed",
  ROLLBACK_TASK_START_FAILED: "start_failed",
  USER_NOT_FOUND: "customer_not_found",
  NOT_A_LEGACY_CUSTOMER: "already_placed",
  ORGANIZATION_NOT_FOUND: "organization_not_found",
  ALREADY_A_MEMBER: "already_a_member",
  UNKNOWN_TEAM: "unknown_team",
  TARGET_REQUIRED: "invalid_request",
  ORGANIZATION_NAME_REQUIRED: "invalid_request",
  INVALID_ORGANIZATION_TYPE: "invalid_request",
  INVALID_ROLE: "invalid_request",
  INVALID_IDEMPOTENCY_KEY: "invalid_request",
  IDEMPOTENCY_KEY_REUSED: "idempotency_conflict",
  PLACEMENT_NOT_FOUND: "run_not_found",
  ROLLBACK_IN_PROGRESS: "rollback_in_progress",
  ALREADY_ROLLED_BACK: "already_rolled_back",
  NOTHING_TO_ROLL_BACK: "nothing_to_roll_back",
  ORGANIZATION_IN_USE: "organization_in_use",
  USER_IS_OWNER: "user_is_owner",
  ROLLBACK_CONFLICT: "rollback_conflict",
  PLACEMENT_FAILED: "placement_failed",
  PLACEMENT_VERIFICATION_FAILED: "verification_failed",
};

/** One refusal for each status and code the five routes answer with. */
export const placementFailure = (status: number, code: string | null, action: PlacementAction): PlacementFailure => {
  // The same code means two things: on a placement, this customer is already being placed; on
  // a rollback, the placement's own task has not finished.
  if (code === "PLACEMENT_IN_PROGRESS") return action === "rollback" ? "run_still_running" : "placement_in_progress";
  const known = code ? BY_CODE[code] : undefined;
  if (known) return known;
  if (status === 401) return "session_ended";
  if (status === 403) return "forbidden";
  // A 429 without the capacity code is an allowance (the limiter, or a proxy in front of it).
  if (status === 429) return "rate_limited";
  if (status === 404) return "not_available";
  return "unavailable";
};

/** Retry-After in seconds, when the answer carries a usable one (at most the 15-minute window). */
export const retryAfterSecondsOf = (header: string | null | undefined): number | null => {
  if (!header || !/^\d{1,5}$/.test(header.trim())) return null;
  const seconds = Number(header.trim());
  return seconds >= 1 ? Math.min(seconds, 900) : null;
};

export type FailureCopy = { title: string; message: string; tone: "calm" | "problem" };

const waitText = (seconds: number | null | undefined) =>
  seconds ? ` Try again in about ${seconds < 90 ? countLabel(seconds, "second") : countLabel(Math.ceil(seconds / 60), "minute")}.` : " Try again in a few minutes.";

/** The sentence for a refusal. Fixed wording: nothing the backend wrote is shown. */
export const placementFailureCopy = (failure: PlacementFailure, retryAfterSeconds?: number | null): FailureCopy => {
  switch (failure) {
    case "session_ended":
      return { title: "Your session has ended", message: "Sign in again to continue. Nothing was sent.", tone: "problem" };
    case "forbidden":
      return {
        title: "This account can't place customers",
        message: "Placing legacy customers needs an RFPilot staff account with an admin role. Ask a super admin if you should have access.",
        tone: "problem",
      };
    case "staff_organization_required":
      return {
        title: "This staff account has no organization",
        message: "Placements are recorded in the staff member's own organization, so an account without one can't place customers. Ask a super admin to add this account to the RFPilot staff organization.",
        tone: "problem",
      };
    case "rate_limited":
      return {
        title: "Too many requests from this account",
        message: `This account has used its allowance for the current 15 minutes.${waitText(retryAfterSeconds)} Other open tabs on this screen count toward the same allowance.`,
        tone: "calm",
      };
    case "capacity_reached":
      return {
        title: "Another placement is running",
        message: "Placements and rollbacks run one at a time. Wait for the one in progress to finish, then try again; that is usually a minute or two. Nothing was started.",
        tone: "calm",
      };
    case "not_configured":
      return {
        title: "Placement is switched off on this server",
        message: "The server isn't set up to start placements, so nothing can be placed or rolled back from here. Tell the engineering team; runs that were already made can still be read.",
        tone: "problem",
      };
    case "misconfigured":
      return {
        title: "Placement is unavailable on this server",
        message: "The server's placement settings are wrong, so nothing can be placed or rolled back. Tell the engineering team.",
        tone: "problem",
      };
    case "start_failed":
      return {
        title: "The run could not be started",
        message: "The server accepted the request but could not start it. Nothing was moved. You can try again; if it keeps happening, tell the engineering team.",
        tone: "problem",
      };
    case "invalid_id":
      return { title: "This link doesn't point to a customer or a run", message: "The address is incomplete or mistyped. Open it from the Legacy customers list.", tone: "calm" };
    case "invalid_request":
      return { title: "The placement details weren't accepted", message: "Go back, check each field and review again. Nothing was sent to be moved.", tone: "problem" };
    case "customer_not_found":
      return { title: "Customer not found", message: "There is no customer account behind this link.", tone: "calm" };
    case "already_placed":
      return {
        title: "This customer isn't waiting to be placed",
        message: "They have already been placed in an organization, or a placement finished while this page was open. Nothing was moved by this request. Check the Legacy customers list.",
        tone: "calm",
      };
    case "placement_in_progress":
      return {
        title: "This customer is already being placed",
        message: "Another placement for this customer is running, perhaps started by a colleague or from another tab. Nothing was started by this request. Wait for that run to finish, then check the Legacy customers list.",
        tone: "calm",
      };
    case "organization_not_found":
      return { title: "Organization not found", message: "The organization you chose is no longer available as a target. Go back and choose again.", tone: "problem" };
    case "already_a_member":
      return {
        title: "Already a member of that organization",
        message: "This customer already has a membership in the organization you chose, so they can't be placed into it. Choose a different organization.",
        tone: "problem",
      };
    case "unknown_team":
      return { title: "That team is no longer available", message: "The team isn't an active team of the organization. Go back and choose another team, or no team.", tone: "problem" };
    case "idempotency_conflict":
      return {
        title: "This review is out of date",
        message: "The details changed after this review was opened. Go back, review again and confirm. Nothing was started.",
        tone: "problem",
      };
    case "run_not_found":
      return { title: "Run not found", message: "There is no placement run with this id. Check the link, or open the run again from where it was started.", tone: "calm" };
    case "run_still_running":
      return { title: "The placement is still running", message: "A run can be rolled back only after its own checks have finished. Wait for it to finish.", tone: "calm" };
    case "rollback_in_progress":
      return { title: "This run is already being rolled back", message: "A rollback of this run is in progress. Nothing new was started.", tone: "calm" };
    case "already_rolled_back":
      return { title: "This run was already rolled back", message: "The customer is back in the Legacy customers list.", tone: "calm" };
    case "nothing_to_roll_back":
      return { title: "Nothing to roll back", message: "This run failed before anything was moved.", tone: "calm" };
    case "organization_in_use":
      return {
        title: "The new organization is in use",
        message: "Other members have joined the organization this placement created, so it can't be rolled back. The placement stands.",
        tone: "problem",
      };
    case "user_is_owner":
      return {
        title: "The customer is now the Owner",
        message: "The customer has become the Owner of the organization since the placement. Ownership must be transferred before this run can be rolled back. The placement stands.",
        tone: "problem",
      };
    case "rollback_conflict":
      return {
        title: "The rollback was refused",
        message: "Records created in the organization since the placement depend on this customer's records, so the run can't be rolled back. The placement stands.",
        tone: "problem",
      };
    case "placement_failed":
      return { title: "The placement failed", message: "The server reported that the placement failed. Open the Legacy customers list to see whether the customer is still waiting, and tell the engineering team.", tone: "problem" };
    case "verification_failed":
      return { title: "The placement's checks failed", message: "The server reported that the checks after the move did not pass. Tell the engineering team before doing anything else with this customer.", tone: "problem" };
    case "not_available":
      return { title: "Not available yet", message: "The server doesn't have this feature yet.", tone: "calm" };
    case "unavailable":
      return { title: "Something went wrong", message: "The server couldn't be reached, or answered in a way this screen doesn't understand. Nothing is known to have changed.", tone: "problem" };
  }
};

export type PlacementResult<T> = { ok: true; data: T } | { ok: false; failure: PlacementFailure; retryAfterSeconds?: number; runId?: string };

/** A list of customers narrowed to those whose name, email or company holds the text. */
export const filterCustomers = (customers: LegacyCustomer[], search: string): LegacyCustomer[] => {
  const term = search.trim().toLowerCase();
  if (!term) return customers;
  return customers.filter((customer) => [customer.name, customer.email, customer.company].some((value) => value?.toLowerCase().includes(term)));
};

// ── The list, one page at a time ────────────────────────────────────────────────────────────
//
// The backend returns every unplaced customer in one answer, with no paging or search of its
// own. Names, emails and companies are personal data, so the whole answer stays on the Next
// server: it cuts one page (and narrows it to a search) and only those rows go to the browser.

/** The most customers one view sends to the browser. */
export const CUSTOMERS_PAGE_SIZE = 50;
export const CUSTOMER_SEARCH_MAX_LENGTH = 200;

export type CustomerPage = {
  /** The rows of this page only: never more than CUSTOMERS_PAGE_SIZE. */
  customers: LegacyCustomer[];
  /** Every customer waiting to be placed. */
  total: number;
  /** Those the search matches; the same as total without a search. */
  matching: number;
  page: number;
  pageCount: number;
  /** The search this page is narrowed to, or "". */
  search: string;
};

/** A page number from an address or a form: digits only, 1 for anything else. */
export const pageNumberOf = (value: unknown): number => {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= 999_999 ? value : 1;
  if (typeof value !== "string" || !/^[0-9]{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
};

/** The search text of the list's form: trimmed and bounded, "" for anything that is not text. */
export const customerSearchOf = (value: unknown): string => (typeof value === "string" ? value.trim().slice(0, CUSTOMER_SEARCH_MAX_LENGTH) : "");

/** One page of the list, narrowed to the search. A page past the end is the last page. */
export const customerPageOf = (customers: LegacyCustomer[], page: unknown, search: unknown = ""): CustomerPage => {
  const term = customerSearchOf(search);
  const matches = filterCustomers(customers, term);
  const pageCount = Math.max(1, Math.ceil(matches.length / CUSTOMERS_PAGE_SIZE));
  const number = Math.min(pageNumberOf(page), pageCount);
  const start = (number - 1) * CUSTOMERS_PAGE_SIZE;
  return { customers: matches.slice(start, start + CUSTOMERS_PAGE_SIZE), total: customers.length, matching: matches.length, page: number, pageCount, search: term };
};

/** The address of a page of the list. It carries a page number and nothing else. */
export const legacyCustomersPagePath = (page: number): string => {
  const number = pageNumberOf(page);
  return number <= 1 ? LEGACY_CUSTOMERS_PATH : `${LEGACY_CUSTOMERS_PATH}?page=${number}`;
};

/** "Showing 51 to 100 of 120 customers", "7 of 120 customers match", or "" when one page shows them all. */
export const customerPageSummary = (page: CustomerPage): string => {
  const first = (page.page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const last = first + page.customers.length - 1;
  const range = `${first.toLocaleString("en-US")} to ${last.toLocaleString("en-US")}`;
  if (page.search) {
    const found = `${page.matching.toLocaleString("en-US")} of ${countLabel(page.total, "customer")} ${page.matching === 1 ? "matches" : "match"}`;
    return page.pageCount > 1 ? `${found}. Showing ${range}.` : `${found}.`;
  }
  return page.pageCount > 1 ? `Showing ${range} of ${countLabel(page.total, "customer")}.` : "";
};

/** What the list on the page holds: a page of customers, or the refusal of the last search. */
export type CustomerListState = { ok: true; data: CustomerPage } | { ok: false; failure: PlacementFailure; retryAfterSeconds?: number; search?: string };

/** "Ada Lovelace (ada@example.com)", or whichever of the two is known. */
export const customerLabel = (customer: Pick<LegacyCustomer, "name" | "email">): string =>
  customer.name && customer.email ? `${customer.name} (${customer.email})` : (customer.name ?? customer.email ?? "A customer with no name or email on file");

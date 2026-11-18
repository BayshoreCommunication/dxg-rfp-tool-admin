// What the run page and the review step say, worked out from the run and the request in plain
// code (runView.test.ts). The instructions are the runbook's (backend
// docs/runbooks/ORG_TENANCY_CUTOVER.md, section 9, "A stuck or failed run").

import {
  customerLabel,
  placementFailureCopy,
  roleLabel,
  ORGANIZATION_TYPE_LABELS,
  type LegacyCustomer,
  type PlacementRequest,
  type PlacementRun,
} from "@/lib/legacyCustomers/placement";
import { countLabel } from "@/lib/plural";

export type RunTone = "working" | "good" | "warning" | "danger" | "neutral";

/* The backend rolls back a run whose journal state is done or failed, once no task is working on
   it. In the run it returns, that is exactly: status succeeded, or status failed with
   rollbackRequired. Not while queued or running, not after a rollback, and not a run that failed
   before anything moved. */
export const canRollBack = (run: PlacementRun): boolean => run.status === "succeeded" || (run.status === "failed" && run.rollbackRequired);

/** The link to the organization is for a customer who is placed there now. */
export const showsOrganizationLink = (run: PlacementRun): boolean => run.status === "succeeded" && run.targetOrganizationId !== null;

export const runHeadline = (run: PlacementRun): { title: string; detail: string; tone: RunTone } => {
  const rollback = run.operation === "rollback";
  switch (run.status) {
    case "queued":
      return {
        title: rollback ? "Rollback waiting to start" : "Placement waiting to start",
        detail: "The request is recorded and its task is starting. That normally takes about a minute. Nothing has moved yet.",
        tone: "working",
      };
    case "running":
      if (rollback) return { title: "Rollback running", detail: "The customer's records are being moved back. A large customer takes a few minutes.", tone: "working" };
      return run.state === "done"
        ? { title: "Placement running: checking the move", detail: "The records have moved. The task is now finishing the move, running its checks and writing the audit record. It can't be rolled back until that is done.", tone: "working" }
        : { title: "Placement running", detail: "The customer's records are being moved. A large customer takes a few minutes.", tone: "working" };
    case "succeeded":
      if (run.task?.operation === "rollback" && run.task.status === "failed") {
        return { title: "Placed. The rollback did not happen", detail: "A rollback of this run was asked for and failed, so the placement stands as it was.", tone: "warning" };
      }
      return run.task?.auditUnconfirmed
        ? { title: "Placed, audit record unconfirmed", detail: "The customer is placed and the checks passed, but the task did not confirm that it wrote its audit record.", tone: "warning" }
        : { title: "Placed", detail: "The customer is placed and the checks passed. They can sign in to the organization now.", tone: "good" };
    case "failed":
      return run.rollbackRequired
        ? { title: "Failed: this run must be rolled back", detail: "The customer's records are in the target organization, but the run did not finish cleanly.", tone: "danger" }
        : { title: "Failed: nothing was moved", detail: "The customer is still waiting in the Legacy customers list and can be placed again.", tone: "neutral" };
    case "rolled_back":
      return run.task?.needsOperatorCheck
        ? { title: "Rolled back, needs an engineering check", detail: "The rollback's first half finished, but its task did not report that it completed.", tone: "danger" }
        : { title: "Rolled back", detail: "The customer's records are back where they were and the customer is in the Legacy customers list again. They can't sign in until they are placed.", tone: "neutral" };
  }
};

/** What staff must do next, when the run asks for something. Shown prominently. */
export const runInstructions = (run: PlacementRun): string[] => {
  const lines: string[] = [];
  if (run.rollbackRequired) {
    lines.push(
      "Roll this run back before doing anything else with this customer. Their records are in the target organization unchecked, and they may be able to sign in to it.",
      "If the rollback is refused, fix what it names first (for example, transfer ownership if the customer has become the Owner), then roll back again.",
      "After the rollback, ask the engineering team to run the organization verification (verifyCustomerOrganizations) before placing this customer again.",
    );
  }
  if (run.task?.needsOperatorCheck) {
    lines.push(
      "Do not place or roll back this customer again yet. Ask the engineering team to run the organization verification (verifyCustomerOrganizations) and compare the customer's records with their holding area first.",
    );
  }
  if (run.status === "succeeded" && run.task?.auditUnconfirmed) {
    lines.push("The placement stands. Ask the engineering team to check that the placement's audit event exists for this customer; if it does not, record the placement in the change log by hand.");
  }
  if (run.status === "succeeded" && run.task?.operation === "rollback" && run.task.status === "failed") {
    lines.push("The placement still stands. If it should be undone, ask for the rollback again.");
  }
  if (run.task?.code === "PLACEMENT_REQUEST_INVALID") {
    lines.push("If nobody on staff made this request, treat it as a security incident and tell the engineering team at once.");
  }
  return lines;
};

const TASK_CODES: Record<string, string> = {
  PLACEMENT_TASK_NOT_STARTED: "The placement task did not start in time.",
  ROLLBACK_TASK_NOT_STARTED: "The rollback task did not start in time.",
  PLACEMENT_TASK_START_FAILED: "The placement task could not be started.",
  ROLLBACK_TASK_START_FAILED: "The rollback task could not be started.",
  PLACEMENT_TASK_LOST: "The placement task stopped reporting before it finished.",
  ROLLBACK_TASK_LOST: "The rollback task stopped reporting before it finished.",
  PLACEMENT_TASK_ERROR: "The placement task failed unexpectedly. The engineering team can find the reason in the task's log.",
  ROLLBACK_TASK_ERROR: "The rollback task failed unexpectedly. The engineering team can find the reason in the task's log.",
  PLACEMENT_FAILED: "The placement failed part way.",
  ROLLBACK_FAILED: "The rollback was given up on before it finished.",
  PLACEMENT_VERIFICATION_FAILED: "The checks after the move did not pass.",
  PLACEMENT_REQUEST_INVALID: "The task did not accept the request: the staff account that asked is no longer an active staff account, or the organizations in the request do not match the customer. Nothing was moved.",
  USER_NOT_FOUND: "The customer's account was not found when the task ran.",
  NOT_A_LEGACY_CUSTOMER: "The customer was no longer waiting to be placed when the task ran.",
  ORGANIZATION_NOT_FOUND: "The target organization was no longer available when the task ran.",
  ALREADY_A_MEMBER: "The customer was already a member of the target organization when the task ran.",
  UNKNOWN_TEAM: "The team was no longer an active team of the organization when the task ran.",
  ORGANIZATION_IN_USE: placementFailureCopy("organization_in_use").message,
  USER_IS_OWNER: placementFailureCopy("user_is_owner").message,
  ROLLBACK_CONFLICT: placementFailureCopy("rollback_conflict").message,
};

/** The failure a task reported, in this screen's words; the code itself is shown beside it. */
export const taskFailureText = (code: string | null): string | null =>
  code === null ? null : (TASK_CODES[code] ?? "The task reported a failure this screen has no description for. Give the code to the engineering team.");

export const verificationLines = (run: PlacementRun): { passed: boolean | null; lines: string[] } => {
  const checks = run.verification;
  if (!checks) {
    return { passed: null, lines: [run.status === "queued" || run.status === "running" ? "The checks run after the move. No result yet." : "This run has no check result."] };
  }
  if (checks.passed) return { passed: true, lines: ["Nothing was left behind, no proposal was lost and no proposal was left without an owner."] };
  const lines: string[] = [];
  if (checks.leftInHolding > 0) lines.push(`${countLabel(checks.leftInHolding, "record")} ${checks.leftInHolding === 1 ? "was" : "were"} left behind in the customer's holding area.`);
  if (checks.lostProposals > 0) lines.push(`${countLabel(checks.lostProposals, "proposal")} the customer owned ${checks.lostProposals === 1 ? "is" : "are"} no longer theirs in the organization.`);
  if (checks.orphanedProposalsInTarget > 0) lines.push(`${countLabel(checks.orphanedProposalsInTarget, "proposal")} in the organization ${checks.orphanedProposalsInTarget === 1 ? "has" : "have"} no owner.`);
  if (lines.length === 0) lines.push("The checks did not pass.");
  if (run.task?.rolledBack === true) lines.push("The task rolled the placement back itself.");
  if (run.task?.rolledBack === false) lines.push("The task's own rollback did not complete.");
  return { passed: false, lines };
};

/** What rollback does, said before it is asked for. */
export const rollbackEffects = (run: PlacementRun): string[] => [
  "Moves back exactly the records this placement moved, into the customer's own holding area. The organization's own records stay where they are.",
  "Puts the customer back in the Legacy customers list. They can't sign in again until they are placed.",
  run.createdOrganization
    ? "Deletes the organization this placement created. It is refused if anyone else has joined it."
    : "Removes the customer's membership and team membership in the organization. It is refused if they have become its Owner. Proposals given to them after the placement stay in the organization and need a new owner.",
  "Runs as its own task, one at a time with other placements, and is followed on this page.",
];

/** The review step: who, how much, where to and as what, in plain words. */
export const reviewLines = (
  customer: LegacyCustomer,
  request: PlacementRequest,
  names: { organizationName?: string | null; teamName?: string | null } = {},
): string[] => {
  const who = customerLabel(customer);
  const moves =
    customer.proposalCount === 0
      ? "They have no proposals, so only their account moves."
      : `${countLabel(customer.proposalCount, "proposal")} ${customer.proposalCount === 1 ? "moves" : "move"} with them, along with the rest of their records.`;
  if (request.target === "new") {
    const details = [
      request.organization.type ? `type ${ORGANIZATION_TYPE_LABELS[request.organization.type]}` : null,
      request.organization.industry ? `industry ${request.organization.industry}` : null,
      request.organization.country ? `country ${request.organization.country}` : null,
      request.organization.timeZone ? `time zone ${request.organization.timeZone}` : null,
      request.organization.eventsPerYear !== undefined ? `${countLabel(request.organization.eventsPerYear, "event")} a year` : null,
    ].filter((item): item is string => item !== null);
    return [
      `${who} will be placed into a new organization named "${request.organization.name}"${details.length ? ` (${details.join(", ")})` : ""}.`,
      "They become its Owner.",
      moves,
      "The new organization starts on the free trial plan. Change its plan from Organizations if this customer should keep full access.",
      "While the placement runs they can't sign in. When it has finished and its checks have passed, they sign in to the new organization.",
    ];
  }
  const organization = names.organizationName ? `"${names.organizationName}"` : "the organization you chose";
  return [
    `${who} will be placed into the existing organization ${organization}.`,
    `They join as ${roleLabel(request.role)}${request.teamId ? `, in ${names.teamName ? `the team "${names.teamName}"` : "the team you chose"}` : ", in no team"}.`,
    moves,
    "While the placement runs they can't sign in. When it has finished and its checks have passed, they sign in to that organization.",
  ];
};

/** "18 Nov 2026, 14:03:22", or a dash for a time that is not set. */
export const formatInstant = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

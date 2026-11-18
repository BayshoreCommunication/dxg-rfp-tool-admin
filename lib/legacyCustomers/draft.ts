// The place flow's unsent choices, kept in the tab's session storage so a refresh on the place
// page returns to the same step with the same values (draft.test.ts). It is read back as an
// allowlist of strings; the request itself is always rebuilt and checked from it
// (validatePlacementRequest), never trusted.

import { isIdempotencyKey, isPlacementId, type PlacementRequest, validatePlacementRequest, type FieldErrors } from "@/lib/legacyCustomers/placement";

export type PlacementDraft = {
  target: "new" | "existing" | "";
  name: string;
  type: string;
  industry: string;
  country: string;
  timeZone: string;
  eventsPerYear: string;
  organizationId: string;
  organizationName: string;
  /** Kept with the name so the review can tell two organizations of the same name apart. */
  organizationSlug: string;
  role: string;
  teamId: string;
  teamName: string;
  step: "form" | "review";
  /** Made when the review opens, and replaced whenever it opens again: one key per reviewed request. */
  idempotencyKey: string;
};

export const emptyDraft = (): PlacementDraft => ({
  target: "",
  name: "",
  type: "",
  industry: "",
  country: "",
  timeZone: "",
  eventsPerYear: "",
  organizationId: "",
  organizationName: "",
  organizationSlug: "",
  role: "",
  teamId: "",
  teamName: "",
  step: "form",
  idempotencyKey: "",
});

const DRAFT_KEY_PREFIX = "legacy-placement-draft:";
export const draftStorageKey = (userId: string) => `${DRAFT_KEY_PREFIX}${userId}`;

/* Removes every saved draft from a storage (the tab's session storage, on sign-out): the next
   person to sign in on this tab must not find the last one's unsent choices. Only this feature's
   keys are touched. Returns how many were removed; a storage that cannot be read removes none. */
export const clearPlacementDrafts = (storage: Pick<Storage, "length" | "key" | "removeItem"> | null | undefined): number => {
  try {
    if (!storage) return 0;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(DRAFT_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
};

const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

export const parseDraft = (stored: string | null | undefined): PlacementDraft | null => {
  if (!stored) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const draft: PlacementDraft = {
    target: item.target === "new" || item.target === "existing" ? item.target : "",
    name: str(item.name, 300),
    type: str(item.type, 40),
    industry: str(item.industry, 200),
    country: str(item.country, 10),
    timeZone: str(item.timeZone, 80),
    eventsPerYear: str(item.eventsPerYear, 10),
    organizationId: isPlacementId(item.organizationId) ? item.organizationId : "",
    organizationName: str(item.organizationName, 200),
    organizationSlug: str(item.organizationSlug, 80),
    role: str(item.role, 40),
    teamId: isPlacementId(item.teamId) ? item.teamId : "",
    teamName: str(item.teamName, 200),
    step: item.step === "review" ? "review" : "form",
    idempotencyKey: isIdempotencyKey(item.idempotencyKey) ? item.idempotencyKey : "",
  };
  // A review is only restored whole: with a request that still passes and the key it was opened with.
  if (draft.step === "review" && (!draft.idempotencyKey || !requestOfDraft(draft).ok)) return { ...draft, step: "form", idempotencyKey: "" };
  return draft;
};

/** The request the draft describes, checked. */
export const requestOfDraft = (draft: PlacementDraft): { ok: true; request: PlacementRequest } | { ok: false; errors: FieldErrors } =>
  validatePlacementRequest(
    draft.target === "new"
      ? { target: "new", organization: { name: draft.name, type: draft.type, industry: draft.industry, country: draft.country, timeZone: draft.timeZone, eventsPerYear: draft.eventsPerYear } }
      : draft.target === "existing"
        ? { target: "existing", organizationId: draft.organizationId, role: draft.role, teamId: draft.teamId }
        : {},
  );

/* The saved team against the organization's teams as they are now. A team that is no longer
   listed (archived or deleted since it was chosen) must leave the draft: the select would show
   "No team" while the request still sent the old team's id. `dropped` is the name to say so with. */
export const teamAfterListing = (
  draft: Pick<PlacementDraft, "teamId" | "teamName">,
  teams: ReadonlyArray<{ id: string; name: string }>,
): { change: Pick<PlacementDraft, "teamId" | "teamName"> | null; dropped: string | null } => {
  if (!draft.teamId) return { change: null, dropped: null };
  const listed = teams.find((team) => team.id === draft.teamId);
  if (!listed) return { change: { teamId: "", teamName: "" }, dropped: draft.teamName.trim() || "The team chosen earlier" };
  // Still there: the review shows its name as it is now.
  return { change: listed.name === draft.teamName ? null : { teamId: draft.teamId, teamName: listed.name }, dropped: null };
};

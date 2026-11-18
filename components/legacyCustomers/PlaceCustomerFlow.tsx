"use client";

import { listPlacementTeamsAction, placeLegacyCustomerAction, type PlacementTeam } from "@/app/actions/legacyCustomers";
import OrganizationPicker from "@/components/legacyCustomers/OrganizationPicker";
import { cardClass, FailureNote, inputClass, linkClass, primaryButton, secondaryButton } from "@/components/legacyCustomers/PlacementChrome";
import { focusRing } from "@/components/organizations/content/ContentChrome";
import { createConfirmedSubmit, type SubmitState } from "@/lib/legacyCustomers/confirmedSubmit";
import { draftStorageKey, emptyDraft, parseDraft, requestOfDraft, type PlacementDraft } from "@/lib/legacyCustomers/draft";
import {
  customerLabel,
  LEGACY_CUSTOMERS_PATH,
  ORGANIZATION_LIMITS,
  ORGANIZATION_TYPE_LABELS,
  ORGANIZATION_TYPES,
  placeCustomerPath,
  PLACEMENT_ROLE_LABELS,
  PLACEMENT_ROLES,
  placementRunPath,
  type FieldErrors,
  type LegacyCustomer,
  type PlacementFailure,
  type PlacementField,
  type PlacementRequest,
  type PlacementResult,
  type StartedRun,
} from "@/lib/legacyCustomers/placement";
import { reviewIdentities, reviewLines } from "@/lib/legacyCustomers/runView";
import { sessionRenewPath } from "@/lib/organizationContent/content";
import { countLabel } from "@/lib/plural";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/* Placing one legacy customer: choose the organization, review, confirm. It is a page of its own,
   and the choices made so far are kept in the tab's session storage, so a refresh returns to the
   same step. Nothing is sent to be moved before the review's confirmation is given. */

const readDraft = (userId: string): PlacementDraft => {
  try {
    return parseDraft(window.sessionStorage.getItem(draftStorageKey(userId))) ?? emptyDraft();
  } catch {
    return emptyDraft();
  }
};
const writeDraft = (userId: string, draft: PlacementDraft | null) => {
  try {
    if (draft) window.sessionStorage.setItem(draftStorageKey(userId), JSON.stringify(draft));
    else window.sessionStorage.removeItem(draftStorageKey(userId));
  } catch {
    // Without storage the flow still works; a refresh then starts it again.
  }
};

/** A key for one reviewed request. A UUID where the browser has one. */
const newIdempotencyKey = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const noSubscription = () => () => undefined;

export default function PlaceCustomerFlow({ customer }: { customer: LegacyCustomer }) {
  // The saved choices live in the browser, so the form is drawn there and not on the server.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return (
    <div className="space-y-5">
      <CustomerSummary customer={customer} />
      {inBrowser ? <Flow customer={customer} /> : <div className={`h-72 animate-pulse ${cardClass}`} role="status" aria-label="Loading the placement form" />}
    </div>
  );
}

const CustomerSummary = ({ customer }: { customer: LegacyCustomer }) => (
  <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-label="Customer being placed">
    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#007f86]">Place a legacy customer</p>
    <h1 className="mt-1 break-words text-2xl font-extrabold tracking-[-0.03em] text-[#12213a]">{customer.name ?? customer.email ?? "Customer with no name on file"}</h1>
    <p className="mt-1 break-all text-sm text-slate-600">
      {customer.name && customer.email ? `${customer.email} · ` : ""}
      {customer.company ? `${customer.company} · ` : ""}
      {countLabel(customer.proposalCount, "proposal")}
    </p>
  </section>
);

function Flow({ customer }: { customer: LegacyCustomer }) {
  const [draft, setDraftState] = useState<PlacementDraft>(() => readDraft(customer.userId));
  const [errors, setErrors] = useState<FieldErrors>({});
  const errorSummary = useRef<HTMLDivElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef<"errors" | "form" | null>(null);

  const setDraft = (change: Partial<PlacementDraft>) => {
    const next = { ...draft, ...change };
    writeDraft(customer.userId, next);
    setDraftState(next);
  };

  useEffect(() => {
    if (focusAfter.current === "errors") errorSummary.current?.focus();
    if (focusAfter.current === "form") formHeading.current?.focus();
    focusAfter.current = null;
  });

  const checked = useMemo(() => requestOfDraft(draft), [draft]);

  if (draft.step === "review" && checked.ok && draft.idempotencyKey) {
    return (
      <ReviewStep
        key={draft.idempotencyKey}
        customer={customer}
        request={checked.request}
        idempotencyKey={draft.idempotencyKey}
        names={{ organizationName: draft.organizationName, organizationSlug: draft.organizationSlug, teamName: draft.teamName }}
        onBack={() => {
          focusAfter.current = "form";
          setDraft({ step: "form", idempotencyKey: "" });
        }}
        onPlaced={() => writeDraft(customer.userId, null)}
      />
    );
  }

  const review = () => {
    if (!checked.ok) {
      setErrors(checked.errors);
      focusAfter.current = "errors";
      return;
    }
    setErrors({});
    // A new key for each review: the same key is sent again only for this same request.
    setDraft({ step: "review", idempotencyKey: newIdempotencyKey() });
  };
  const edit = (change: Partial<PlacementDraft>, field?: PlacementField) => {
    setDraft(change);
    if (field && errors[field]) {
      setErrors((current) => {
        const rest = { ...current };
        delete rest[field];
        return rest;
      });
    }
  };
  const errorList = Object.values(errors);

  return (
    <form
      noValidate
      className={`space-y-6 px-5 py-6 sm:px-6 ${cardClass}`}
      onSubmit={(event) => {
        event.preventDefault();
        review();
      }}
    >
      <h2 ref={formHeading} tabIndex={-1} className="text-lg font-bold text-[#12213a] outline-none">
        Where should this customer go?
      </h2>

      {errorList.length ? (
        <div ref={errorSummary} tabIndex={-1} role="alert" className={`rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 ${focusRing}`}>
          <p className="font-bold">Check {countLabel(errorList.length, "field")} before reviewing</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-bold text-[#20304b]">Place into</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["new", "New organization", "Creates an organization. The customer becomes its Owner."],
              ["existing", "Existing organization", "The customer joins an organization that is already there, with a role you choose."],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#00aeb5] ${
                draft.target === value ? "border-[#00aeb5] bg-[#eaf9f8]" : "border-slate-300 hover:border-[#00aeb5]"
              }`}
            >
              <input
                type="radio"
                name="target"
                value={value}
                checked={draft.target === value}
                onChange={() => edit({ target: value }, "target")}
                className="mt-1 h-4 w-4 accent-[#007f86]"
              />
              <span>
                <span className="block font-bold text-[#20304b]">{label}</span>
                <span className="block text-slate-600">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {draft.target === "new" ? <NewOrganizationFields draft={draft} errors={errors} edit={edit} /> : null}
      {draft.target === "existing" ? <ExistingOrganizationFields draft={draft} errors={errors} edit={edit} /> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" className={primaryButton}>
          Review placement
        </button>
        <p className="text-xs text-slate-600">Nothing is moved until you confirm on the next step.</p>
      </div>
    </form>
  );
}

type FieldsProps = { draft: PlacementDraft; errors: FieldErrors; edit: (change: Partial<PlacementDraft>, field?: PlacementField) => void };

const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (ids: { id: string; describedBy?: string; invalid?: true }) => ReactNode }) => {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-[#20304b]">
        {label}
      </label>
      {children({ id, describedBy, invalid: error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const timeZones = (): string[] => {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    return typeof supported === "function" ? supported("timeZone") : [];
  } catch {
    return [];
  }
};

const NewOrganizationFields = ({ draft, errors, edit }: FieldsProps) => {
  const zones = useMemo(() => timeZones(), []);
  const zonesId = useId();
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold text-[#20304b]">The new organization</legend>
      <Field label="Name" hint={`Required. Up to ${ORGANIZATION_LIMITS.name} characters.`} error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="text"
            required
            value={draft.name}
            maxLength={ORGANIZATION_LIMITS.name}
            autoComplete="off"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(event) => edit({ name: event.target.value }, "name")}
            className={inputClass}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type (optional)" error={errors.type}>
          {({ id, describedBy, invalid }) => (
            <select id={id} value={draft.type} aria-describedby={describedBy} aria-invalid={invalid} onChange={(event) => edit({ type: event.target.value }, "type")} className={inputClass}>
              <option value="">Not set</option>
              {ORGANIZATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ORGANIZATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Industry (optional)" hint={`Up to ${ORGANIZATION_LIMITS.industry} characters.`} error={errors.industry}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="text"
              value={draft.industry}
              maxLength={ORGANIZATION_LIMITS.industry}
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(event) => edit({ industry: event.target.value }, "industry")}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Country (optional)" hint="Two-letter code, for example US or GB." error={errors.country}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="text"
              value={draft.country}
              maxLength={2}
              autoComplete="off"
              autoCapitalize="characters"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(event) => edit({ country: event.target.value.toUpperCase() }, "country")}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Time zone (optional)" hint="A time zone name, for example America/New_York." error={errors.timeZone}>
          {({ id, describedBy, invalid }) => (
            <>
              <input
                id={id}
                type="text"
                list={zonesId}
                value={draft.timeZone}
                maxLength={64}
                autoComplete="off"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                onChange={(event) => edit({ timeZone: event.target.value }, "timeZone")}
                className={inputClass}
              />
              <datalist id={zonesId}>
                {zones.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Events per year (optional)" hint={`A whole number from 0 to ${ORGANIZATION_LIMITS.eventsPerYear.toLocaleString("en-US")}.`} error={errors.eventsPerYear}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="text"
              inputMode="numeric"
              value={draft.eventsPerYear}
              maxLength={6}
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(event) => edit({ eventsPerYear: event.target.value }, "eventsPerYear")}
              className={inputClass}
            />
          )}
        </Field>
      </div>
    </fieldset>
  );
};

type TeamsState = { phase: "idle" } | { phase: "loading" } | { phase: "ready"; teams: PlacementTeam[] } | { phase: "failed"; failure: PlacementFailure; retryAfterSeconds?: number };

const ExistingOrganizationFields = ({ draft, errors, edit }: FieldsProps) => {
  // A team saved with the draft is shown by name until the list is asked for again.
  const [teams, setTeams] = useState<TeamsState>({ phase: "idle" });
  const asked = useRef(0);
  const chosen = draft.organizationId ? { organizationId: draft.organizationId, name: draft.organizationName || "The organization you chose" } : null;

  const loadTeams = async () => {
    if (!draft.organizationId || teams.phase === "loading") return;
    const mine = ++asked.current;
    setTeams({ phase: "loading" });
    let result: PlacementResult<PlacementTeam[]>;
    try {
      result = await listPlacementTeamsAction(draft.organizationId);
    } catch {
      result = { ok: false, failure: "unavailable" };
    }
    // The organization was changed while the teams were on their way.
    if (mine !== asked.current) return;
    setTeams(result.ok ? { phase: "ready", teams: result.data } : { phase: "failed", failure: result.failure, retryAfterSeconds: result.retryAfterSeconds });
  };
  const forgetTeams = () => {
    asked.current += 1;
    setTeams({ phase: "idle" });
  };

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold text-[#20304b]">The existing organization</legend>
      <OrganizationPicker
        chosen={chosen}
        error={errors.organizationId}
        onChoose={(organization) => {
          forgetTeams();
          edit({ organizationId: organization.organizationId, organizationName: organization.name, organizationSlug: organization.slug ?? "", teamId: "", teamName: "" }, "organizationId");
        }}
        onClear={() => {
          forgetTeams();
          edit({ organizationId: "", organizationName: "", organizationSlug: "", teamId: "", teamName: "" });
        }}
      />
      <Field label="Role" hint="Owner and Viewer can't be given by a placement." error={errors.role}>
        {({ id, describedBy, invalid }) => (
          <select id={id} value={draft.role} aria-describedby={describedBy} aria-invalid={invalid} onChange={(event) => edit({ role: event.target.value }, "role")} className={inputClass}>
            <option value="">Choose a role</option>
            {PLACEMENT_ROLES.map((role) => (
              <option key={role} value={role}>
                {PLACEMENT_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-bold text-[#20304b]">Team (optional)</p>
        {!draft.organizationId ? (
          <p className="text-xs text-slate-600">Choose the organization first.</p>
        ) : teams.phase === "ready" ? (
          teams.teams.length === 0 ? (
            <p className="text-sm text-slate-600" role="status">
              This organization has no active team. The customer joins without one.
            </p>
          ) : (
            <Field label="Team" error={errors.teamId}>
              {({ id, describedBy, invalid }) => (
                <select
                  id={id}
                  value={teams.teams.some((team) => team.id === draft.teamId) ? draft.teamId : ""}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  onChange={(event) => edit({ teamId: event.target.value, teamName: teams.teams.find((team) => team.id === event.target.value)?.name ?? "" }, "teamId")}
                  className={inputClass}
                >
                  <option value="">No team</option>
                  {teams.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {draft.teamId ? `Team chosen: ${draft.teamName || "a team of this organization"}.` : "No team chosen: the customer joins without one."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={loadTeams} disabled={teams.phase === "loading"} className={secondaryButton}>
                {teams.phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {teams.phase === "loading" ? "Loading teams" : draft.teamId ? "Change team" : "Choose a team"}
              </button>
              {draft.teamId ? (
                <button type="button" onClick={() => edit({ teamId: "", teamName: "" }, "teamId")} className={secondaryButton}>
                  Remove team
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-600">Listing the teams opens this organization&apos;s team list, which is recorded on the RFPilot side like any other view of it.</p>
            {teams.phase === "failed" ? <FailureNote failure={teams.failure} retryAfterSeconds={teams.retryAfterSeconds} /> : null}
          </>
        )}
      </div>
    </fieldset>
  );
};

type PlaceResult = PlacementResult<StartedRun>;

function ReviewStep({
  customer,
  request,
  idempotencyKey,
  names,
  onBack,
  onPlaced,
}: {
  customer: LegacyCustomer;
  request: PlacementRequest;
  idempotencyKey: string;
  names: { organizationName: string; organizationSlug: string; teamName: string };
  onBack: () => void;
  onPlaced: () => void;
}) {
  const router = useRouter();
  const confirmId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [gateState, setGateState] = useState<SubmitState>({ confirmed: false, inFlight: false, done: false });
  const [refusal, setRefusal] = useState<Extract<PlaceResult, { ok: false }> | null>(null);
  // One gate for this review: nothing is sent before the confirmation, and a second submit while
  // the first is in flight sends nothing. The key is the one this review was opened with.
  const [gate] = useState(() =>
    createConfirmedSubmit<PlaceResult>({
      send: async () => {
        try {
          return await placeLegacyCustomerAction(customer.userId, request, idempotencyKey);
        } catch {
          return { ok: false, failure: "unavailable" };
        }
      },
      succeeded: (result) => result.ok,
      onChange: setGateState,
    }),
  );

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const place = async () => {
    setRefusal(null);
    const outcome = await gate.submit();
    if (!outcome.sent) return;
    if (!outcome.result.ok) {
      setRefusal(outcome.result);
      return;
    }
    onPlaced();
    router.push(placementRunPath(outcome.result.data.runId));
  };

  const busy = gateState.inFlight || gateState.done;
  const lines = reviewLines(customer, request, names);
  const identities = reviewIdentities(request, names);

  return (
    <form
      className={`space-y-5 px-5 py-6 sm:px-6 ${cardClass}`}
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void place();
      }}
    >
      <h2 ref={heading} tabIndex={-1} className="text-lg font-bold text-[#12213a] outline-none">
        Review this placement
      </h2>
      <ul className="space-y-2 text-sm leading-6 text-[#20304b]">
        {lines.map((line) => (
          <li key={line} className="break-words rounded-xl bg-slate-50 px-4 py-2.5">
            {line}
          </li>
        ))}
      </ul>
      {identities.length ? (
        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Exactly what this placement names">
          {identities.map((identity) => (
            <div key={identity.label} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
              <dt className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 sm:pt-0.5">{identity.label}</dt>
              <dd className="min-w-0 text-sm text-[#20304b]">
                <span className="block break-words font-bold">{identity.name}</span>
                {identity.details.map((detail) => (
                  <span key={detail.label} className="block break-all text-[13px] text-slate-600">
                    {detail.label}: <span className="font-mono">{detail.value}</span>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="text-sm text-slate-600">
        The placement runs as its own task, one at a time with other placements. You follow it on the next page, and it can be rolled back from there once it has finished.
      </p>

      <label
        htmlFor={confirmId}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-[#20304b] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#00aeb5]"
      >
        <input
          id={confirmId}
          type="checkbox"
          checked={gateState.confirmed}
          disabled={busy}
          onChange={(event) => gate.setConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#007f86]"
        />
        <span>
          I have checked the customer, the organization and the role above, and I want to move {customerLabel(customer)} now.
        </span>
      </label>

      {refusal ? (
        <FailureNote failure={refusal.failure} retryAfterSeconds={refusal.retryAfterSeconds}>
          {refusal.failure === "session_ended" ? (
            <Link href={sessionRenewPath(placeCustomerPath(customer.userId))} prefetch={false} className={linkClass}>
              Sign in
            </Link>
          ) : null}
          {refusal.runId ? (
            <Link href={placementRunPath(refusal.runId)} prefetch={false} className={linkClass}>
              Open the run that was recorded
            </Link>
          ) : null}
          {refusal.failure === "already_placed" || refusal.failure === "placement_in_progress" || refusal.failure === "customer_not_found" ? (
            <Link href={LEGACY_CUSTOMERS_PATH} prefetch={false} className={linkClass}>
              Back to Legacy customers
            </Link>
          ) : null}
        </FailureNote>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" disabled={!gateState.confirmed || busy} className={primaryButton}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {gateState.inFlight ? "Starting the placement" : gateState.done ? "Opening the run" : "Place customer"}
        </button>
        <button type="button" onClick={onBack} disabled={busy} className={secondaryButton}>
          Back to edit
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {gateState.inFlight ? "Starting the placement." : gateState.done ? "The placement was started. Opening its run page." : ""}
      </p>
    </form>
  );
}

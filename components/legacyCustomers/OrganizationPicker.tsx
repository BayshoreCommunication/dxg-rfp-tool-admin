"use client";

import { searchPlacementTargetsAction } from "@/app/actions/legacyCustomers";
import { focusRing } from "@/components/organizations/content/ContentChrome";
import { FailureNote, inputClass, secondaryButton } from "@/components/legacyCustomers/PlacementChrome";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, type TargetOrganization } from "@/lib/legacyCustomers/placement";
import { createTypeahead, type Typeahead, type TypeaheadState } from "@/lib/legacyCustomers/typeahead";
import { countLabel } from "@/lib/plural";
import { Building2, Loader2, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const IDLE: TypeaheadState = { phase: "idle", term: null, results: [], failure: null, retryAfterSeconds: null };
// The backend returns at most this many names for a search.
const RESULT_LIMIT = 50;

/* Chooses the existing organization a customer joins. The search waits 300 ms after the last
   keystroke, asks nothing below two characters and ignores the answer to a search that has been
   replaced (lib/legacyCustomers/typeahead.ts). Each result is a button; the chosen organization
   is shown with a way to change it. */
export default function OrganizationPicker({
  chosen,
  onChoose,
  onClear,
  error,
}: {
  chosen: { organizationId: string; name: string } | null;
  onChoose: (organization: TargetOrganization) => void;
  onClear: () => void;
  error?: string;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [state, setState] = useState<TypeaheadState>(IDLE);
  const typeahead = useRef<Typeahead | null>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Choosing or changing swaps the control under the keyboard: focus follows to the new one.
  const moveFocus = useRef(false);
  const chosenId = chosen?.organizationId ?? null;
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (chosenId ? changeRef.current : inputRef.current)?.focus();
  }, [chosenId]);

  useEffect(() => {
    const created = createTypeahead({ search: searchPlacementTargetsAction, onChange: setState });
    typeahead.current = created;
    return () => {
      created.dispose();
      typeahead.current = null;
    };
  }, []);

  const status =
    state.phase === "waiting" || state.phase === "loading"
      ? "Searching…"
      : state.phase === "ready"
        ? state.results.length === 0
          ? "No organization has that in its name."
          : `${countLabel(state.results.length, "organization")} found${state.results.length >= RESULT_LIMIT ? `. Only the first ${RESULT_LIMIT} are shown: type more of the name` : ""}.`
        : text.trim().length > 0 && text.trim().length < SEARCH_MIN_LENGTH
          ? `Type at least ${SEARCH_MIN_LENGTH} characters.`
          : "";

  if (chosen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#aee9e8] bg-[#eaf9f8] px-4 py-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-[#12213a]">
          <Building2 className="h-4 w-4 shrink-0 text-[#007f86]" aria-hidden="true" />
          <span className="min-w-0 break-words">
            <span className="sr-only">Chosen organization: </span>
            <span className="font-bold">{chosen.name}</span>
          </span>
        </p>
        <button
          ref={changeRef}
          type="button"
          className={secondaryButton}
          onClick={() => {
            moveFocus.current = true;
            onClear();
            setText("");
            typeahead.current?.input("");
          }}
        >
          Change organization
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-bold text-[#20304b]">
        Organization
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={text}
          maxLength={SEARCH_MAX_LENGTH}
          autoComplete="off"
          placeholder="Search organizations by name"
          aria-describedby={`${inputId}-status${error ? ` ${inputId}-error` : ""}`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setText(event.target.value);
            typeahead.current?.input(event.target.value);
          }}
          className={`${inputClass} pl-10`}
        />
        {state.phase === "loading" ? <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden="true" /> : null}
      </div>
      <p id={`${inputId}-status`} role="status" aria-live="polite" className="min-h-5 text-xs text-slate-600">
        {status}
      </p>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      {state.phase === "failed" && state.failure ? <FailureNote failure={state.failure} retryAfterSeconds={state.retryAfterSeconds} /> : null}
      {state.phase === "ready" && state.results.length > 0 ? (
        <ul aria-label="Matching organizations" className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {state.results.map((organization) => (
            <li key={organization.organizationId}>
              <button
                type="button"
                onClick={() => {
                  moveFocus.current = true;
                  onChoose(organization);
                }}
                aria-label={`Choose ${organization.name}`}
                className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-[#20304b] transition hover:bg-[#eaf9f8] ${focusRing} focus-visible:-outline-offset-2`}
              >
                <span className="min-w-0 break-words font-semibold">{organization.name}</span>
                {organization.slug ? <span className="shrink-0 break-all text-xs text-slate-500">{organization.slug}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

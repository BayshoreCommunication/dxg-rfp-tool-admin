"use client";

import { searchLegacyCustomersAction } from "@/app/actions/legacyCustomers";
import { focusRing } from "@/components/organizations/content/ContentChrome";
import { cardClass, FailureNote, inputClass, linkClass, secondaryButton } from "@/components/legacyCustomers/PlacementChrome";
import {
  CUSTOMER_SEARCH_MAX_LENGTH,
  customerLabel,
  customerPageSummary,
  LEGACY_CUSTOMERS_PATH,
  legacyCustomersPagePath,
  placeCustomerPath,
  type CustomerListState,
  type CustomerPage,
} from "@/lib/legacyCustomers/placement";
import { sessionRenewPath } from "@/lib/organizationContent/content";
import { countLabel } from "@/lib/plural";
import { CheckCircle2, Loader2, Search, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useTransition } from "react";

/* The legacy customers not yet placed, one page at a time. The API returns all of them in one
   answer with no paging and no search of its own, so both are done on the Next server and only
   the rows of the page being shown are sent here.

   - A page is an address: /legacy-customers?page=2. The address carries the number and nothing else.
   - A search is this form's action, sent by POST when the button is pressed or Enter is typed
     (not as each letter is typed). The text is a name or an email: it is never put in an address.
     The pages of a search are asked for the same way.
   - Each page view and each search is one read of the backend's list. */
export default function LegacyCustomersList({ initial }: { initial: CustomerPage }) {
  const [state, search, searching] = useActionState<CustomerListState, FormData>(searchLegacyCustomersAction, { ok: true, data: initial });
  const [turning, startTurning] = useTransition();
  const titleId = useId();
  const searchId = useId();
  const busy = searching || turning;
  const page = state.ok ? state.data : null;
  const applied = page ? page.search : (state.ok ? "" : (state.search ?? ""));

  if (page && page.total === 0) {
    return (
      <section className={`flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center ${cardClass}`} role="status">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-bold text-[#12213a]">Every legacy customer is placed</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">No customer account is waiting for an organization.</p>
      </section>
    );
  }

  /** A page of the search being shown: asked for by POST, with the search in the body. */
  const turnTo = (number: number) => {
    const body = new FormData();
    body.set("search", applied);
    body.set("page", String(number));
    startTurning(() => search(body));
  };
  const summary = page ? customerPageSummary(page) : "";

  return (
    <section className={`overflow-hidden ${cardClass}`} aria-labelledby={titleId} aria-busy={busy}>
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">
              Waiting to be placed
            </h2>
            {page ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{countLabel(page.total, "customer")}</span> : null}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">Most proposals first. A customer leaves this list when their placement has finished.</p>
        </div>
        <form action={search} className="flex w-full flex-wrap items-center gap-2 lg:w-auto" role="search" aria-label="Search the customers waiting to be placed">
          <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
            <label htmlFor={searchId} className="sr-only">
              Search customers by name, email or company
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id={searchId}
              name="search"
              type="search"
              defaultValue={applied}
              maxLength={CUSTOMER_SEARCH_MAX_LENGTH}
              autoComplete="off"
              placeholder="Name, email or company"
              className={`${inputClass} pl-10`}
            />
          </div>
          <button type="submit" disabled={busy} className={secondaryButton}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Search
          </button>
          {applied ? (
            <button type="submit" name="clear" value="1" disabled={busy} className={secondaryButton}>
              Clear search
            </button>
          ) : null}
        </form>
      </div>
      <p className={summary ? "border-b border-slate-100 px-5 py-2.5 text-sm text-slate-600 sm:px-6" : "sr-only"} role="status" aria-live="polite">
        {busy ? "Reading the list." : summary}
      </p>
      {!state.ok ? (
        <div className="px-5 py-5 sm:px-6">
          <FailureNote failure={state.failure} retryAfterSeconds={state.retryAfterSeconds}>
            {state.failure === "session_ended" ? (
              <Link href={sessionRenewPath(LEGACY_CUSTOMERS_PATH)} prefetch={false} className={linkClass}>
                Sign in
              </Link>
            ) : null}
          </FailureNote>
        </div>
      ) : state.data.customers.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center">
          <UserRoundSearch className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-[#20304b]">No customer matches</p>
          <p className="mt-1 text-sm text-slate-600">Nothing in this list has that name, email or company.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {state.data.customers.map((customer) => (
            <li key={customer.userId} className="grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-center md:gap-4">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-[#20304b]">{customer.name ?? "No name on file"}</p>
                <p className="break-all text-[13px] text-slate-600">{customer.email ?? "No email on file"}</p>
                {customer.company ? <p className="break-words text-xs text-slate-500">{customer.company}</p> : null}
              </div>
              <p className="text-sm tabular-nums text-slate-700">{countLabel(customer.proposalCount, "proposal")}</p>
              <Link
                href={placeCustomerPath(customer.userId)}
                prefetch={false}
                aria-label={`Place ${customerLabel(customer)}`}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#34445f] transition hover:border-[#00aeb5] hover:text-[#007f86] md:justify-self-end ${focusRing}`}
              >
                Place
              </Link>
            </li>
          ))}
        </ul>
      )}
      {page && page.pageCount > 1 ? (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6" aria-label="Pages of customers">
          <p className="text-sm text-slate-600">
            Page {page.page.toLocaleString("en-US")} of {page.pageCount.toLocaleString("en-US")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {page.search ? (
              // The pages of a search are asked for by POST, like the search: its text stays out of the address.
              <>
                <button type="button" onClick={() => turnTo(page.page - 1)} disabled={busy || page.page <= 1} className={secondaryButton}>
                  Previous
                </button>
                <button type="button" onClick={() => turnTo(page.page + 1)} disabled={busy || page.page >= page.pageCount} className={secondaryButton}>
                  Next
                </button>
              </>
            ) : (
              <>
                {page.page > 1 ? (
                  <Link href={legacyCustomersPagePath(page.page - 1)} prefetch={false} className={secondaryButton}>
                    Previous
                  </Link>
                ) : null}
                {page.page < page.pageCount ? (
                  <Link href={legacyCustomersPagePath(page.page + 1)} prefetch={false} className={secondaryButton}>
                    Next
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </nav>
      ) : null}
    </section>
  );
}

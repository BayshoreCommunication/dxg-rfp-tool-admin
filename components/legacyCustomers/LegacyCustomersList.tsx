"use client";

import { focusRing } from "@/components/organizations/content/ContentChrome";
import { cardClass, inputClass } from "@/components/legacyCustomers/PlacementChrome";
import { customerLabel, filterCustomers, placeCustomerPath, type LegacyCustomer } from "@/lib/legacyCustomers/placement";
import { countLabel } from "@/lib/plural";
import { CheckCircle2, Search, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

/* The legacy customers not yet placed. The API returns all of them in one answer, most proposals
   first, with no paging and no search of its own; the box here narrows the list already on the
   page and asks the backend nothing. */
export default function LegacyCustomersList({ customers }: { customers: LegacyCustomer[] }) {
  const [search, setSearch] = useState("");
  const searchId = useId();
  const shown = useMemo(() => filterCustomers(customers, search), [customers, search]);

  if (customers.length === 0) {
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

  return (
    <section className={`overflow-hidden ${cardClass}`} aria-labelledby={`${searchId}-title`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${searchId}-title`} className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">
              Waiting to be placed
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{countLabel(customers.length, "customer")}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-600">Most proposals first. A customer leaves this list when their placement has finished.</p>
        </div>
        <div className="relative w-full lg:w-80">
          <label htmlFor={searchId} className="sr-only">
            Filter customers by name, email or company
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="Filter by name, email or company"
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>
      <p className="sr-only" role="status">
        {search.trim() ? `${countLabel(shown.length, "customer")} shown` : ""}
      </p>
      {shown.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center">
          <UserRoundSearch className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-[#20304b]">No customer matches</p>
          <p className="mt-1 text-sm text-slate-600">Nothing in this list has that name, email or company.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((customer) => (
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
    </section>
  );
}

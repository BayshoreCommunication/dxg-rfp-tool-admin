import ClientSearchForm from "@/components/clients/ClientSearchForm";
import { countLabel } from "@/lib/plural";
import {
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  formatContentDate,
  organizationVendorsPath,
  pageRange,
  withQuery,
  type VendorsPage,
  type VendorsQuery,
} from "@/lib/organizationContent/content";
import { Store } from "lucide-react";
import { ContentBadge, ContentCard, EmptyState, FilterPills, Pager } from "./ContentChrome";

type Props = { organizationId: string; query: VendorsQuery; page: VendorsPage };

/** The organization's shared vendor list, by company. View only. */
export default function VendorsList({ organizationId, query, page }: Props) {
  const { vendors, pagination } = page;
  const range = pageRange(pagination, vendors.length);
  const filtered = Boolean(query.search) || query.status !== "all";
  const hrefFor = (change: Partial<VendorsQuery>) => {
    const next = { ...query, page: 1, ...change };
    return withQuery(organizationVendorsPath(organizationId), {
      search: next.search,
      status: next.status === "all" ? undefined : next.status,
      page: next.page,
    });
  };

  return (
    <ContentCard
      icon={Store}
      title="Vendors"
      count={`${pagination.total.toLocaleString("en-US")} ${filtered ? "matching" : "total"}`}
      description="The vendor companies and contacts this organization sends proposals to, by company."
      controls={
        <>
          <ClientSearchForm initialSearch={query.search} label="Search vendors" placeholder="Search vendors" />
          <FilterPills
            label="Vendor status"
            options={STATUS_FILTERS.map((value) => ({ value, label: STATUS_FILTER_LABELS[value] }))}
            active={query.status}
            hrefFor={(status) => hrefFor({ status })}
          />
        </>
      }
    >
      {vendors.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No vendors found"
          message={filtered ? "Try a different search or filter." : "This organization has not added a vendor yet."}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {vendors.map((vendor) => (
            <li key={vendor.id} className="grid gap-2 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1fr)] lg:items-center lg:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-bold text-[#20304b]">{vendor.company}</p>
                  {vendor.archived ? <ContentBadge tone="warning">Archived</ContentBadge> : null}
                </div>
                <p className="break-words text-xs text-slate-600">{vendor.category ?? "No category"}</p>
              </div>
              <div className="min-w-0 text-[13px] text-slate-600">
                <p className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">{countLabel(vendor.contacts.length, "contact")}</p>
                {vendor.contacts.length ? (
                  <ul>
                    {vendor.contacts.map((contact, index) => (
                      <li key={index} className="break-words">
                        {contact.name ?? "Unnamed contact"}
                        {contact.email ? <span className="break-all text-slate-500"> · {contact.email}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="text-xs text-slate-600">Added {formatContentDate(vendor.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <Pager
        pagination={pagination}
        summary={`Showing ${range.start.toLocaleString("en-US")}–${range.end.toLocaleString("en-US")} of ${countLabel(pagination.total, "vendor")}`}
        label="Vendor pagination"
        hrefFor={(next) => hrefFor({ page: next })}
      />
    </ContentCard>
  );
}

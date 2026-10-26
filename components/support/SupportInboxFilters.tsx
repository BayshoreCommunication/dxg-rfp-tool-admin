"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { SupportUserSummary } from "@/app/actions/supportDesk";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "./supportLabels";
import SupportSelect from "./SupportSelect";

type Props = {
  agents: SupportUserSummary[];
  values: { status: string; assignee: string; priority: string; category: string; search: string; sort: string };
};

export default function SupportInboxFilters({ agents, values }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The parent remounts this component (keyed on the URL search value) when
  // the query changes, so the draft never drifts from the applied filter.
  const [search, setSearch] = useState(values.search);
  const [isPending, startTransition] = useTransition();

  const apply = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    apply({ search: search.trim() });
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center" aria-busy={isPending}>
      <form onSubmit={submitSearch} className="relative flex-1 lg:min-w-[260px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search subject, #number, name, or email"
          aria-label="Search tickets"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-2 focus:ring-[#00aeb5]/20 dark:border-[#253746] dark:bg-[#0f2230] dark:text-slate-100"
        />
      </form>
      <SupportSelect
        wrapperClassName="w-full lg:w-56"
        aria-label="Status"
        value={values.status}
        onChange={(event) => apply({ status: event.target.value })}
      >
        <option value="">Active (open + waiting)</option>
        <option value="all">All statuses</option>
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SupportSelect>
      <SupportSelect
        wrapperClassName="w-full lg:w-56"
        aria-label="Assignee"
        value={values.assignee}
        onChange={(event) => apply({ assignee: event.target.value })}
      >
        <option value="">Any assignee</option>
        <option value="me">Assigned to me</option>
        <option value="unassigned">Unassigned</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </SupportSelect>
      <SupportSelect
        wrapperClassName="w-full lg:w-56"
        aria-label="Priority"
        value={values.priority}
        onChange={(event) => apply({ priority: event.target.value })}
      >
        <option value="">Any priority</option>
        {PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SupportSelect>
      <SupportSelect
        wrapperClassName="w-full lg:w-56"
        aria-label="Category"
        value={values.category}
        onChange={(event) => apply({ category: event.target.value })}
      >
        <option value="">Any category</option>
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SupportSelect>
      <SupportSelect
        wrapperClassName="w-full lg:w-48"
        aria-label="Sort"
        value={values.sort === "recent" ? "recent" : ""}
        onChange={(event) => apply({ sort: event.target.value })}
      >
        <option value="">Most urgent first</option>
        <option value="recent">Most recent first</option>
      </SupportSelect>
    </div>
  );
}

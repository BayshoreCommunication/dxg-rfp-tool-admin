"use client";

import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

type ClientSearchFormProps = {
  initialSearch?: string;
};

export default function ClientSearchForm({
  initialSearch = "",
}: ClientSearchFormProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();
  const clearRequestPending = useRef(false);
  const queryValue = useRef(initialSearch);

  useEffect(() => {
    const syncFrame = window.requestAnimationFrame(() => {
      if (
        clearRequestPending.current &&
        initialSearch === "" &&
        queryValue.current.trim() !== ""
      ) {
        clearRequestPending.current = false;
        return;
      }

      queryValue.current = initialSearch;
      setQuery(initialSearch);
      clearRequestPending.current = false;
    });

    return () => window.cancelAnimationFrame(syncFrame);
  }, [initialSearch]);

  useEffect(() => {
    if (
      query.trim() !== "" ||
      !searchParams.has("search") ||
      clearRequestPending.current
    ) {
      return;
    }

    const clearFrame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("search");
      params.delete("page");
      clearRequestPending.current = true;

      startTransition(() => {
        router.replace(
          params.size ? `${pathname}?${params.toString()}` : pathname,
          { scroll: false },
        );
      });
    });

    return () => window.cancelAnimationFrame(clearFrame);
  }, [pathname, query, router, searchParams]);

  const buildSearchUrl = (nextSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextSearch) {
      params.set("search", nextSearch);
    } else {
      params.delete("search");
    }
    params.delete("page");

    return params.size ? `${pathname}?${params.toString()}` : pathname;
  };

  const replaceSearch = (nextSearch: string) => {
    const currentSearch = searchParams.get("search")?.trim() || "";
    const hasPage = searchParams.has("page");

    if (nextSearch === currentSearch && !hasPage) return;

    startTransition(() => {
      router.replace(buildSearchUrl(nextSearch), { scroll: false });
    });
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;
    queryValue.current = nextQuery;
    setQuery(nextQuery);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    replaceSearch(query.trim());
  };

  return (
    <form
      className="flex w-full gap-2 lg:w-auto"
      role="search"
      onSubmit={handleSubmit}
    >
      <label className="relative min-w-0 flex-1 lg:w-72">
        <span className="sr-only">Search clients</span>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          name="search"
          value={query}
          onChange={handleChange}
          placeholder="Search name or email"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-[#20304b] outline-none transition placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 min-w-[84px] items-center justify-center gap-2 rounded-xl bg-[#00aeb5] px-4 text-sm font-bold text-white transition hover:bg-[#009ca4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? (
          <LoaderCircle
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        ) : null}
        {isPending ? "Searching" : "Search"}
      </button>
    </form>
  );
}

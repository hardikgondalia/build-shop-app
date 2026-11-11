"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type SortMode = "name" | "price-asc" | "price-desc";

export function SearchSort({ q, sort }: { q: string; sort: SortMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSort = useRef(sort);

  useEffect(() => {
    currentSort.current = sort;
    setSearch(q);
    if (timeout.current) clearTimeout(timeout.current);
  }, [q, sort]);

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  const urlFor = (query: string, order: SortMode) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (order !== "name") params.set("sort", order);
    const searchString = params.toString();
    return `${pathname}${searchString ? `?${searchString}` : ""}`;
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    if (timeout.current) clearTimeout(timeout.current);
    // One navigation per burst of typing = one useful browser Back step.
    timeout.current = setTimeout(() => {
      router.push(urlFor(value, currentSort.current), { scroll: false });
    }, 350);
  };

  return (
    <div className="panel bg-[#ffffff] p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6e655d]" htmlFor="catalog-search">
            Search
          </label>
          <div className="relative">
            <input
              id="catalog-search"
              type="search"
              placeholder="Search by product name..."
              className="field pl-3.5 pr-8"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => changeSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9c9388] hover:text-[#2c1a12]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6e655d]" htmlFor="catalog-sort">
            Sort
          </label>
          <select
            id="catalog-sort"
            className="field"
            value={sort}
            onChange={(event) => {
              if (timeout.current) clearTimeout(timeout.current);
              router.push(urlFor(search, event.target.value as SortMode), { scroll: false });
            }}
          >
            <option value="name">Name</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getCatalog } from "@/lib/store";
import { money, stockText } from "@/lib/catalog";
import { SearchSort, type SortMode } from "@/components/search-sort";

// URL-dependent rendering must not freeze one filtered HTML page at build time.
// The data read, however, is memoized by getCatalog until a staff payment.
export const dynamic = "force-dynamic";

type Query = { q?: string | string[]; sort?: string | string[] };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const sort: SortMode =
    params.sort === "price-asc" || params.sort === "price-desc" ? params.sort : "name";
  const catalog = await getCatalog();
  const filtered = catalog
    .filter((item) => item.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "price-asc") return a.priceCents - b.priceCents || a.name.localeCompare(b.name);
      if (sort === "price-desc") return b.priceCents - a.priceCents || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

  const getStockBadgeClass = (remaining: number | null) => {
    if (remaining === null) return "badge-unlimited";
    if (remaining === 0) return "badge-soldout";
    if (remaining <= 2) return "badge-lowstock";
    return "badge-instock";
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#eae4da] pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">Curated Inventory</span>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c1a12]">Catalogue</h1>
          </div>
          <p className="text-sm text-[#6e655d]">
            Showing <strong className="text-[#2c1a12]">{filtered.length}</strong> of {catalog.length} items
          </p>
        </div>
        <p className="mt-1.5 text-sm text-[#6e655d]">
          Browse handcrafted workshop goods, current inventory levels, and prices.
        </p>
      </div>

      <SearchSort q={q} sort={sort} />

      {filtered.length === 0 ? (
        <div className="panel border-dashed py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f3ede2] text-[#b45309]">
            🔍
          </div>
          <p role="status" className="text-base font-semibold text-[#2c1a12]">No items match.</p>
          <p className="mt-1 text-sm text-[#6e655d]">Try changing your search query or reset the filter.</p>
        </div>
      ) : (
        <ul aria-label="Catalogue items" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <li
              key={item.sku}
              className="panel group relative flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d8cfc2] hover:shadow-md"
            >
              <article className="flex h-full flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9c9388]">
                      SKU: {item.sku}
                    </span>
                    <span className={getStockBadgeClass(item.remaining)}>
                      {item.remaining === 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#b91c1c]" />}
                      {item.remaining !== null && item.remaining > 0 && item.remaining <= 2 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#b45309]" />
                      )}
                      {item.remaining !== null && item.remaining > 2 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#15803d]" />
                      )}
                      {stockText(item.remaining)}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold tracking-tight text-[#2c1a12]">
                    <Link
                      className="text-[#2c1a12] transition-colors hover:text-[#b45309] focus-visible:outline-hidden"
                      prefetch={false}
                      href={`/shop/${item.sku}`}
                    >
                      {item.name}
                    </Link>
                  </h2>

                  {item.extras.length > 0 && (
                    <p className="text-xs text-[#6e655d]">
                      Available extra: <span className="font-medium text-[#2c1a12]">{item.extras.map((e) => e.name).join(", ")}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[#f0eae1] pt-3.5">
                  <span className="text-2xl font-extrabold tracking-tight text-[#2c1a12]">
                    {money(item.priceCents)}
                  </span>
                  <Link
                    href={`/shop/${item.sku}`}
                    prefetch={false}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] transition-all hover:translate-x-0.5 hover:text-[#883d04]"
                  >
                    View details →
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

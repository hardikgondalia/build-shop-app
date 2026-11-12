import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/store";
import { INITIAL_CATALOG, money, stockText } from "@/lib/catalog";

export const dynamic = "force-dynamic";
// An unknown SKU must get an HTTP 404 before streaming starts. Enumerating
// the known route params is safe: only inventory, not the SKU list, changes.
export const dynamicParams = false;
export function generateStaticParams() {
  return INITIAL_CATALOG.map((item) => ({ sku: item.sku }));
}
type Props = { params: Promise<{ sku: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sku } = await params;
  const item = (await getCatalog()).find((entry) => entry.sku === sku);
  if (!item) return { title: "Item not found | Shop counter" };
  return {
    title: `${item.name} | Shop counter`,
    description: `Explore ${item.name} for ${money(item.priceCents)}. ${stockText(item.remaining)}.`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { sku } = await params;
  const item = (await getCatalog()).find((entry) => entry.sku === sku);
  if (!item) notFound();

  const getStockBadgeClass = (remaining: number | null) => {
    if (remaining === null) return "badge-unlimited";
    if (remaining === 0) return "badge-soldout";
    if (remaining <= 2) return "badge-lowstock";
    return "badge-instock";
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav aria-label="Breadcrumb">
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#b45309] transition-colors hover:text-[#883d04]"
        >
          ← Back to catalogue
        </Link>
      </nav>

      <article className="panel space-y-6 border-[#eae4da] bg-white p-7 sm:p-8">
        <div className="border-b border-[#f0eae1] pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#9c9388]">
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
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#2c1a12] sm:text-4xl">
            {item.name}
          </h1>
          <p className="mt-3 text-3xl font-extrabold text-[#2c1a12]">
            {money(item.priceCents)}
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6e655d]">
            Availability & Inventory
          </h2>
          <p className="text-base text-[#1f1b18]">{stockText(item.remaining)}</p>
          {item.remaining === 0 && (
            <p className="text-sm font-medium text-[#b91c1c]">
              This product is currently sold out and unavailable for order.
            </p>
          )}
        </div>

        <section aria-label="Extras" className="rounded-xl border border-[#f0eae1] bg-[#faf8f5] p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#2c1a12]">
            Extras
          </h2>
          {item.extras.length ? (
            <ul className="divide-y divide-[#eae4da] text-sm">
              {item.extras.map((extra) => (
                <li key={extra.code} className="flex items-center justify-between py-2">
                  <span className="font-medium text-[#2c1a12]">{extra.name}</span>
                  <span className="font-semibold text-[#b45309]">+ {money(extra.priceCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#6e655d]">None</p>
          )}
        </section>

        <div className="pt-2">
          <p className="text-xs text-[#9c9388]">
            Note: Purchases for Maple lamp and Cedar stool are recorded through the{" "}
            <Link href="/desk" className="font-semibold text-[#b45309] underline hover:text-[#883d04]">
              Staff desk
            </Link>
            .
          </p>
        </div>
      </article>
    </div>
  );
}

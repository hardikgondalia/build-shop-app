export type Extra = {
  code: string;
  name: string;
  priceCents: number;
};

export type CatalogItem = {
  sku: string;
  name: string;
  priceCents: number;
  remaining: number | null;
  extras: Extra[];
};

/** Definitions never change. Inventory counts are kept separately in the live process store. */
export const INITIAL_CATALOG: readonly CatalogItem[] = [
  { sku: "lamp", name: "Maple lamp", priceCents: 8000, remaining: 5, extras: [] },
  {
    sku: "stool",
    name: "Cedar stool",
    priceCents: 12000,
    remaining: 2,
    extras: [{ code: "cushion", name: "Cushion", priceCents: 2500 }],
  },
  { sku: "notebook", name: "Field notebook", priceCents: 1500, remaining: null, extras: [] },
  { sku: "pen", name: "Gel pen", priceCents: 400, remaining: null, extras: [] },
  { sku: "case", name: "Slip case", priceCents: 2200, remaining: null, extras: [] },
];

export const DESK_SKUS = ["lamp", "stool"] as const;
export const CHECKOUT_SKUS = ["notebook", "pen", "case"] as const;

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);

export const stockText = (remaining: number | null) =>
  remaining === null ? "Not stock-limited" : `${remaining} left`;

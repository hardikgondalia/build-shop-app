import { randomUUID } from "node:crypto";
import { CHECKOUT_SKUS, INITIAL_CATALOG, type CatalogItem } from "@/lib/catalog";
import type { NormalizedPayment } from "@/lib/payment-validation";

export type Payment = {
  email: string;
  sku: "lamp" | "stool";
  itemName: string;
  extraCode: "cushion" | null;
  externalChargeId: string;
  totalCents: number;
};

export type Preview = {
  email: string;
  sku: "lamp" | "stool";
  itemName: string;
  extraCode: "cushion" | null;
  extraName: string | null;
  totalCents: number;
  remainingAfter: number;
};

export type SnapshotLine = Readonly<{
  sku: string;
  name: string;
  unitPriceCents: number;
  qty: number;
}>;

export type Attempt = Readonly<{
  attemptId: string;
  lines: readonly SnapshotLine[];
  amountCents: number;
}>;

export type Order = Readonly<{
  orderId: string;
  attemptId: string;
  lines: readonly SnapshotLine[];
  amountCents: number;
}>;

type Store = {
  remaining: Record<string, number | null>;
  payments: Payment[];
  paymentsByChargeId: Map<string, Payment>;
  attempts: Map<string, Attempt>;
  ordersByAttemptId: Map<string, Order>;
  catalogCache: CatalogItem[] | null;
  catalogReads: number;
};

function state(): Store {
  // The Next.js route and page modules may be bundled separately; the global
  // slot ensures they use the same state within ONE Node.js process.
  const scope = globalThis as typeof globalThis & { __shopCounterStore?: Store };
  if (!scope.__shopCounterStore) {
    scope.__shopCounterStore = {
      remaining: Object.fromEntries(INITIAL_CATALOG.map((item) => [item.sku, item.remaining])),
      payments: [],
      paymentsByChargeId: new Map(),
      attempts: new Map(),
      ordersByAttemptId: new Map(),
      catalogCache: null,
      catalogReads: 0,
    };
  }
  return scope.__shopCounterStore;
}

/** Uncached live read: intentionally does NOT increment the debug counter. */
export function getLiveCatalog(): CatalogItem[] {
  const remaining = state().remaining;
  return INITIAL_CATALOG.map((item) => ({
    ...item,
    remaining: remaining[item.sku],
    extras: item.extras.map((extra) => ({ ...extra })),
  }));
}

/**
 * Process-local, explicit memoization. An actual cache miss increments the
 * counter once. Repeat renders can run without another catalogue read.
 * An inventory change clears this entry synchronously.
 */
export async function getCatalog(): Promise<CatalogItem[]> {
  const s = state();
  if (s.catalogCache === null) {
    s.catalogReads += 1;
    s.catalogCache = getLiveCatalog();
  }
  return s.catalogCache;
}

export function getCatalogReads(): number {
  return state().catalogReads;
}

export function getPayments(): Payment[] {
  return state().payments.map((payment) => ({ ...payment }));
}

function paymentDetails(input: NormalizedPayment) {
  const item = INITIAL_CATALOG.find((candidate) => candidate.sku === input.sku)!;
  const extra = item.extras.find((candidate) => candidate.code === input.extraCode);
  return {
    item,
    extra,
    totalCents: item.priceCents + (extra?.priceCents ?? 0),
  };
}

export function previewPayment(input: NormalizedPayment):
  | { ok: true; preview: Preview }
  | { ok: false; errors: { sku: "Sold out" } } {
  const remaining = state().remaining[input.sku];
  if (remaining === null || remaining <= 0) {
    return { ok: false, errors: { sku: "Sold out" } };
  }
  const { item, extra, totalCents } = paymentDetails(input);
  return {
    ok: true,
    preview: {
      email: input.email,
      sku: input.sku,
      itemName: item.name,
      extraCode: input.extraCode,
      extraName: extra?.name ?? null,
      totalCents,
      remainingAfter: remaining - 1,
    },
  };
}

export function recordPayment(input: NormalizedPayment):
  | { ok: true; replayed: boolean; payment: Payment }
  | { ok: false; errors: { sku: "Sold out" } } {
  const s = state();
  const previous = s.paymentsByChargeId.get(input.externalChargeId);
  if (previous) return { ok: true, replayed: true, payment: { ...previous } };

  const remaining = s.remaining[input.sku];
  if (remaining === null || remaining <= 0) {
    return { ok: false, errors: { sku: "Sold out" } };
  }
  const { item, totalCents } = paymentDetails(input);
  const payment: Payment = {
    email: input.email,
    sku: input.sku,
    itemName: item.name,
    extraCode: input.extraCode,
    externalChargeId: input.externalChargeId,
    totalCents,
  };

  // No await between the idempotency/stock checks and this mutation.
  s.remaining[input.sku] = remaining - 1;
  s.paymentsByChargeId.set(payment.externalChargeId, payment);
  s.payments.unshift(payment);
  s.catalogCache = null; // next /shop or /shop/[sku] fills fresh data
  return { ok: true, replayed: false, payment: { ...payment } };
}

export function beginCheckout(lines: { sku: string; qty: number }[]): Attempt | null {
  if (!lines.length) return null;
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (
      !CHECKOUT_SKUS.some((sku) => sku === line.sku) ||
      !Number.isSafeInteger(line.qty) ||
      line.qty < 1
    ) {
      return null;
    }
    const next = (quantities.get(line.sku) ?? 0) + line.qty;
    if (!Number.isSafeInteger(next)) return null;
    quantities.set(line.sku, next);
  }

  const snapshotLines = [...quantities.entries()].map(([sku, qty]) => {
    const product = INITIAL_CATALOG.find((item) => item.sku === sku)!;
    return Object.freeze({ sku, name: product.name, unitPriceCents: product.priceCents, qty });
  });
  const amountCents = snapshotLines.reduce(
    (total, item) => total + item.unitPriceCents * item.qty,
    0,
  );
  if (!Number.isSafeInteger(amountCents)) return null;

  const attempt: Attempt = Object.freeze({
    attemptId: randomUUID(),
    lines: Object.freeze(snapshotLines),
    amountCents,
  });
  state().attempts.set(attempt.attemptId, attempt);
  return attempt;
}

export function completeCheckout(attemptId: string): Order | null {
  const s = state();
  const existing = s.ordersByAttemptId.get(attemptId);
  if (existing) return existing;
  const attempt = s.attempts.get(attemptId);
  if (!attempt) return null;
  const order: Order = Object.freeze({
    orderId: randomUUID(),
    attemptId: attempt.attemptId,
    lines: attempt.lines,
    amountCents: attempt.amountCents,
  });
  s.ordersByAttemptId.set(attemptId, order);
  return order;
}

"use client";

import { useState } from "react";
import { money, type CatalogItem } from "@/lib/catalog";
import type { Attempt, Order, SnapshotLine } from "@/lib/store";

type CartLine = { sku: string; qty: number };

function sameSkuQuantities(a: CartLine[], b: readonly SnapshotLine[]): boolean {
  if (a.length !== b.length) return false;
  const quantities = new Map(a.map((line) => [line.sku, line.qty]));
  return b.every((line) => quantities.get(line.sku) === line.qty);
}

export function CheckoutClient({ products }: { products: CatalogItem[] }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const quantity = (sku: string) => cart.find((line) => line.sku === sku)?.qty ?? 0;
  const changeQuantity = (sku: string, delta: number) => {
    setCart((current) => {
      const existing = current.find((line) => line.sku === sku);
      if (!existing) return delta > 0 ? [...current, { sku, qty: 1 }] : current;
      return current
        .map((line) => (line.sku === sku ? { ...line, qty: line.qty + delta } : line))
        .filter((line) => line.qty > 0);
    });
  };
  const total = cart.reduce(
    (sum, line) =>
      sum + (products.find((product) => product.sku === line.sku)?.priceCents ?? 0) * line.qty,
    0,
  );
  const diverged = attempt !== null && !sameSkuQuantities(cart, attempt.lines);

  const pay = async () => {
    if (!cart.length) {
      setMessage("Add an item before paying");
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/checkout/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server ignores these unit prices, even if a client tampers with them.
        body: JSON.stringify({
          lines: cart.map((line) => ({
            ...line,
            unitPriceCents: products.find((product) => product.sku === line.sku)?.priceCents,
          })),
        }),
      });
      if (!response.ok) throw new Error("begin failed");
      setAttempt((await response.json()) as Attempt);
      setOrder(null);
    } catch {
      setMessage("Could not start the payment. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!attempt) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.attemptId }),
      });
      if (!response.ok) throw new Error("complete failed");
      setOrder((await response.json()) as Order);
    } catch {
      setMessage("Could not complete the payment. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const startNewOrder = () => {
    setCart([]);
    setAttempt(null);
    setOrder(null);
    setMessage("");
  };

  return (
    <div className="space-y-8">
      {/* Products list */}
      <section aria-label="Checkout products" className="space-y-4">
        <div className="border-b border-[#eae4da] pb-3">
          <h2 className="text-xl font-bold tracking-tight text-[#2c1a12]">Available Items</h2>
          <p className="text-xs text-[#6e655d]">Select items to build your shopping cart.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {products.map((product) => {
            const qty = quantity(product.sku);
            return (
              <li
                key={product.sku}
                className="panel flex flex-col justify-between space-y-4 border-[#eae4da] bg-white p-6 transition-all hover:border-[#d8cfc2]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9c9388]">
                      SKU: {product.sku}
                    </span>
                    <span className="badge-unlimited">Unlimited</span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-[#2c1a12]">{product.name}</h3>
                  <p className="mt-1 text-2xl font-extrabold text-[#2c1a12]">{money(product.priceCents)}</p>
                </div>

                <div className="border-t border-[#f0eae1] pt-3">
                  {qty === 0 ? (
                    <button
                      className="secondary w-full"
                      type="button"
                      onClick={() => changeQuantity(product.sku, 1)}
                    >
                      Add {product.name}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between rounded-lg border border-[#eae4da] bg-[#faf8f5] px-2.5 py-1">
                        <span className="text-xs font-semibold text-[#6e655d]">
                          Quantity: <strong className="text-[#2c1a12]">{qty}</strong>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d8cfc2] bg-white text-sm font-bold text-[#2c1a12] hover:bg-[#f3ede2]"
                            aria-label={`Decrease ${product.name}`}
                            onClick={() => changeQuantity(product.sku, -1)}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d8cfc2] bg-white text-sm font-bold text-[#2c1a12] hover:bg-[#f3ede2]"
                            aria-label={`Increase ${product.name}`}
                            onClick={() => changeQuantity(product.sku, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#b91c1c] underline hover:text-red-800"
                        aria-label={`Remove ${product.name}`}
                        onClick={() => setCart((current) => current.filter((line) => line.sku !== product.sku))}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Cart & Total */}
      <section aria-label="Cart" className="panel space-y-4 border-[#eae4da] bg-white p-7">
        <div className="flex items-center justify-between border-b border-[#f0eae1] pb-3">
          <h2 className="text-xl font-bold tracking-tight text-[#2c1a12]">Cart</h2>
          <span className="badge-unlimited">{cart.reduce((s, l) => s + l.qty, 0)} items</span>
        </div>

        {cart.length ? (
          <ul className="divide-y divide-[#f0eae1]">
            {cart.map((line) => {
              const item = products.find((product) => product.sku === line.sku)!;
              return (
                <li key={line.sku} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-[#2c1a12]">
                    {item.name} × {line.qty}
                  </span>
                  <span className="font-mono font-bold text-[#2c1a12]">
                    {money(line.qty * item.priceCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-6 text-center text-sm text-[#9c9388]">
            <p>Cart is empty.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0eae1] pt-4">
          <p className="text-base text-[#1f1b18]">
            <strong>Cart total:</strong>{" "}
            <span className="ml-1 text-2xl font-extrabold text-[#2c1a12]">{money(total)}</span>
          </p>
          <button type="button" className="primary" onClick={pay} disabled={busy}>
            Pay
          </button>
        </div>

        {message && (
          <p role="alert" className="error rounded-lg border border-red-200 bg-red-50 p-3">
            {message}
          </p>
        )}
      </section>

      {/* Payment in progress snapshot */}
      {attempt && !order && (
        <section
          className="panel space-y-4 border-2 border-[#b45309] bg-[#fffdfa] p-7 shadow-md"
          aria-label="Payment in progress"
        >
          <div className="flex items-center justify-between border-b border-[#fde68a] pb-3">
            <h2 className="text-xl font-bold text-[#2c1a12]">Payment in progress</h2>
            <span className="badge-lowstock">Snapshot Frozen</span>
          </div>

          <p className="text-xs text-[#6e655d]">
            This attempt snapshot is frozen on the server. You can freely edit your cart above without altering this locked total.
          </p>

          <ul className="divide-y divide-[#fde68a]/50 text-sm">
            {attempt.lines.map((line) => (
              <li key={line.sku} className="flex items-center justify-between py-2 text-[#2c1a12]">
                <span>
                  {line.name} × {line.qty}
                </span>
                <span className="font-mono font-bold">{money(line.unitPriceCents * line.qty)}</span>
              </li>
            ))}
          </ul>

          {diverged && (
            <div
              role="status"
              className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3.5 text-sm font-semibold text-[#92400e]"
            >
              Your cart changed after payment started. You will be charged the amount below.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#fde68a] pt-4">
            <p className="text-base text-[#1f1b18]">
              <strong>Amount due:</strong>{" "}
              <span className="ml-1 text-2xl font-extrabold text-[#b45309]">
                {money(attempt.amountCents)}
              </span>
            </p>
            <button type="button" className="primary" disabled={busy} onClick={complete}>
              Complete payment
            </button>
          </div>
        </section>
      )}

      {/* Order confirmation */}
      {order && (
        <section
          className="panel space-y-4 border-2 border-[#15803d] bg-[#f0fdf4]/50 p-8 shadow-md"
          aria-label="Order confirmation"
        >
          <div className="flex items-center justify-between border-b border-[#bbf7d0] pb-3">
            <h2 className="text-2xl font-extrabold text-[#15803d]">Order placed</h2>
            <span className="badge-instock">Confirmed</span>
          </div>

          <p className="text-xs text-[#6e655d]">Receipt generated from the server-locked payment snapshot.</p>

          <ul className="divide-y divide-[#bbf7d0] text-sm">
            {order.lines.map((line) => (
              <li key={line.sku} className="flex items-center justify-between py-2.5 text-[#1f1b18]">
                <span>
                  {line.name} × {line.qty}
                </span>
                <span className="font-mono font-bold">{money(line.unitPriceCents * line.qty)}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#bbf7d0] pt-4">
            <p className="text-base text-[#1f1b18]">
              <strong>Amount charged:</strong>{" "}
              <span className="ml-1 text-3xl font-extrabold text-[#15803d]">
                {money(order.amountCents)}
              </span>
            </p>
            <button type="button" className="secondary" onClick={startNewOrder}>
              Start new order
            </button>
          </div>

          <p className="break-all font-mono text-xs text-[#6e655d]">Order ID: {order.orderId}</p>
        </section>
      )}
    </div>
  );
}

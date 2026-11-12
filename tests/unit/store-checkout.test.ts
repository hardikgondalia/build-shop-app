import { describe, expect, it } from "vitest";
import { beginCheckout, completeCheckout } from "@/lib/store";

describe("store checkout and cart snapshot rules", () => {
  it("rejects an empty lines array", () => {
    const attempt = beginCheckout([]);
    expect(attempt).toBeNull();
  });

  it("rejects unknown SKUs", () => {
    const attempt = beginCheckout([{ sku: "unknown_furniture", qty: 1 }]);
    expect(attempt).toBeNull();
  });

  it("rejects non-positive and non-integer quantities", () => {
    expect(beginCheckout([{ sku: "notebook", qty: 0 }])).toBeNull();
    expect(beginCheckout([{ sku: "notebook", qty: -2 }])).toBeNull();
    expect(beginCheckout([{ sku: "notebook", qty: 1.5 }])).toBeNull();
  });

  it("prices lines authoritatively from the catalogue and creates frozen snapshot", () => {
    const attempt = beginCheckout([
      { sku: "notebook", qty: 2 },
      { sku: "pen", qty: 3 },
    ]);
    expect(attempt).not.toBeNull();
    if (!attempt) return;

    // Field notebook = 1500 cents * 2 = 3000
    // Gel pen = 400 cents * 3 = 1200
    // Total = 4200 cents ($42)
    expect(attempt.amountCents).toBe(4200);
    expect(attempt.lines).toHaveLength(2);
    expect(attempt.lines[0]).toMatchObject({ sku: "notebook", qty: 2, unitPriceCents: 1500 });
    expect(attempt.lines[1]).toMatchObject({ sku: "pen", qty: 3, unitPriceCents: 400 });
  });

  it("completes checkout and returns idempotent order on repeated complete calls", () => {
    const attempt = beginCheckout([{ sku: "case", qty: 1 }]);
    expect(attempt).not.toBeNull();
    if (!attempt) return;

    const firstOrder = completeCheckout(attempt.attemptId);
    expect(firstOrder).not.toBeNull();
    if (!firstOrder) return;
    expect(firstOrder.attemptId).toBe(attempt.attemptId);
    expect(firstOrder.amountCents).toBe(2200);

    const replayOrder = completeCheckout(attempt.attemptId);
    expect(replayOrder).toEqual(firstOrder);
  });

  it("returns null when attempting to complete a non-existent attemptId", () => {
    const order = completeCheckout("non-existent-attempt-id-xyz");
    expect(order).toBeNull();
  });
});


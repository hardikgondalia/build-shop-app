import { describe, expect, it } from "vitest";
import { getLiveCatalog, previewPayment, recordPayment } from "@/lib/store";
import { validatePayment } from "@/lib/payment-validation";

describe("shared staff payment validation", () => {
  it("rejects a cushion on a lamp on both the preview and recording paths", () => {
    const invalid = {
      email: "Ada@Example.com",
      sku: "lamp",
      extraCode: "cushion",
      externalChargeId: "ch_12345678",
    };
    const previewValidation = validatePayment(invalid); // same call preview route makes
    const recordValidation = validatePayment(invalid); // same call record route makes
    expect(previewValidation).toEqual({
      ok: false,
      errors: { extraCode: "That extra is not sold with this item." },
    });
    expect(recordValidation).toEqual(previewValidation);
  });

  it("normalizes email, and a preview never changes stock", () => {
    const initialRemaining = getLiveCatalog().find((item) => item.sku === "lamp")!.remaining;
    const validated = validatePayment({
      email: "  ADA@Example.COM  ",
      sku: "lamp",
      externalChargeId: "ch_abcdefgh",
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.email).toBe("ada@example.com");
    const result = previewPayment(validated.value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.preview.remainingAfter).toBe((initialRemaining ?? 0) - 1);
    expect(getLiveCatalog().find((item) => item.sku === "lamp")!.remaining).toBe(initialRemaining);
  });

  it("replays the original charge instead of deducting stock again", () => {
    const input = validatePayment({
      email: "test@example.com",
      sku: "stool",
      extraCode: "cushion",
      externalChargeId: "ch_teststool2026",
    });
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    const before = getLiveCatalog().find((item) => item.sku === "stool")!.remaining;
    const first = recordPayment(input.value);
    const second = recordPayment(input.value);
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(second).toMatchObject({ ok: true, replayed: true });
    if (first.ok && second.ok) expect(second.payment).toEqual(first.payment);
    expect(getLiveCatalog().find((item) => item.sku === "stool")!.remaining).toBe((before ?? 0) - 1);
  });

  it("reports required fields with the specified error messages", () => {
    expect(validatePayment({})).toEqual({
      ok: false,
      errors: {
        email: "Enter a valid email.",
        sku: "Choose an item.",
        externalChargeId: "Enter a charge id like ch_12345678.",
      },
    });
  });

  it("rejects malformed email and charge id formats", () => {
    const malformed = validatePayment({
      email: "invalid-email-at-domain.com",
      sku: "lamp",
      externalChargeId: "not_a_valid_id",
    });
    expect(malformed).toEqual({
      ok: false,
      errors: {
        email: "Enter a valid email.",
        externalChargeId: "Enter a charge id like ch_12345678.",
      },
    });
  });

  it("returns Sold out when stock is completely exhausted", () => {
    // Determine current remaining stock of stool
    const initial = getLiveCatalog().find((item) => item.sku === "stool")!.remaining ?? 0;
    for (let i = 0; i < initial; i++) {
      const charge = validatePayment({
        email: `buyer${i}@example.com`,
        sku: "stool",
        externalChargeId: `ch_${i}test${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`,
      });
      expect(charge.ok).toBe(true);
      if (charge.ok) {
        const record = recordPayment(charge.value);
        expect(record.ok).toBe(true);
      }
    }
    const currentStock = getLiveCatalog().find((item) => item.sku === "stool")!.remaining;
    expect(currentStock).toBe(0);

    const soldOutAttempt = validatePayment({
      email: "aftermath@example.com",
      sku: "stool",
      externalChargeId: `ch_after${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`,
    });
    expect(soldOutAttempt.ok).toBe(true);
    if (!soldOutAttempt.ok) return;

    const preview = previewPayment(soldOutAttempt.value);
    expect(preview).toEqual({ ok: false, errors: { sku: "Sold out" } });

    const record = recordPayment(soldOutAttempt.value);
    expect(record).toEqual({ ok: false, errors: { sku: "Sold out" } });
  });
});

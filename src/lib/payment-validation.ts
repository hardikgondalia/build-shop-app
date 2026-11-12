import { z } from "zod";

export type PaymentField = "email" | "sku" | "externalChargeId" | "extraCode";
export type PaymentErrors = Partial<Record<PaymentField, string>>;

const paymentSchema = z
  .object({
    email: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
      z.string().regex(/^[^@\s]+@[^@\s]+$/, "Enter a valid email."),
    ),
    sku: z.enum(["lamp", "stool"], { error: "Choose an item." }),
    externalChargeId: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().regex(/^ch_[A-Za-z0-9]{8,}$/, "Enter a charge id like ch_12345678."),
    ),
    extraCode: z.preprocess(
      (value) => (value === undefined || value === "" ? null : value),
      z.union([z.literal("cushion"), z.null()], {
        error: "That extra is not sold with this item.",
      }),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.extraCode === "cushion" && value.sku !== "stool") {
      ctx.addIssue({
        code: "custom",
        path: ["extraCode"],
        message: "That extra is not sold with this item.",
      });
    }
  });

export type NormalizedPayment = z.output<typeof paymentSchema>;
export type PaymentValidation =
  | { ok: true; value: NormalizedPayment }
  | { ok: false; errors: PaymentErrors };

/** Used without wrappers by BOTH /api/payments/preview and /api/payments. */
export function validatePayment(input: unknown): PaymentValidation {
  const result = paymentSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const errors: PaymentErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as PaymentField | undefined;
    if (field && (["email", "sku", "externalChargeId", "extraCode"] as string[]).includes(field) && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}

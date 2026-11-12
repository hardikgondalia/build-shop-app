import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { beginCheckout } from "@/lib/store";

const cartSchema = z.object({
  lines: z.array(
    z.object({
      sku: z.enum(["notebook", "pen", "case"]),
      qty: z.number().int().positive(),
      // Deliberately no unitPriceCents here: extra keys are stripped by Zod.
    }),
  ).min(1),
});

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = cartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_cart" }, { status: 400 });
  }
  const attempt = beginCheckout(parsed.data.lines);
  if (!attempt) return NextResponse.json({ error: "invalid_cart" }, { status: 400 });
  return NextResponse.json(attempt, { status: 201 });
}

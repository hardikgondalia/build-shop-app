import { NextResponse, type NextRequest } from "next/server";
import { validatePayment } from "@/lib/payment-validation";
import { previewPayment } from "@/lib/store";

export async function POST(request: NextRequest) {
  const input: unknown = await request.json().catch(() => null);
  const validation = validatePayment(input);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 400 });
  }
  const result = previewPayment(validation.value);
  if (!result.ok) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

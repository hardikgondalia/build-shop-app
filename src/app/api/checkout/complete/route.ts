import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completeCheckout } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = z.object({ attemptId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_attempt" }, { status: 400 });
  // Do not read body.lines or any client-submitted amount.
  const order = completeCheckout(parsed.data.attemptId);
  if (!order) return NextResponse.json({ error: "unknown_attempt" }, { status: 404 });
  return NextResponse.json(order);
}

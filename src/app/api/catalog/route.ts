import { NextResponse } from "next/server";
import { getLiveCatalog } from "@/lib/store";

export async function GET() {
  return NextResponse.json(getLiveCatalog(), { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { getCatalogReads } from "@/lib/store";

export async function GET() {
  return NextResponse.json(
    { catalogReads: getCatalogReads() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

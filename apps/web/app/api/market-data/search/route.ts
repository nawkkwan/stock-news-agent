import { NextResponse } from "next/server";
import { searchMarketSymbols } from "../../../../lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || "";
  const payload = await searchMarketSymbols(keywords);
  return NextResponse.json(payload, { status: payload.configured ? 200 : 503 });
}

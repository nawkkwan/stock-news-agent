import { NextResponse } from "next/server";
import { getMarketQuote } from "../../../../lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "";
  const payload = await getMarketQuote(symbol);
  return NextResponse.json(payload, { status: payload.configured ? 200 : 503 });
}

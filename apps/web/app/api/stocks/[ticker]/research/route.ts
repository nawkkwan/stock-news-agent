import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";

export async function POST(request: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await context.params;
  const ticker = rawTicker.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,20}$/.test(ticker)) return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  const body = await request.json().catch(() => ({})) as { question?: string };
  const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!apiBaseUrl) return NextResponse.json({ error: "ยังไม่ได้ตั้ง API_BASE_URL" }, { status: 503 });

  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: userData, error: userError }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    const accessToken = sessionData.session?.access_token;
    if (userError || !userData.user || !accessToken) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

    const response = await fetch(`${apiBaseUrl}/v1/user/stocks/${encodeURIComponent(ticker)}/research`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ question: String(body.question || "").slice(0, 1200) }),
      signal: AbortSignal.timeout(75_000),
    });
    const payload = await response.json().catch(() => null) as { run_id?: string; detail?: string } | null;
    if (!response.ok) return NextResponse.json({ error: payload?.detail || "Agent ตอบกลับผิดพลาด" }, { status: response.status });
    if (response.status === 202 && payload?.run_id) {
      return NextResponse.json({ status: "running", runId: payload.run_id }, { status: 202 });
    }
    return NextResponse.json({ status: "completed" });
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อ Azure Agent ไม่สำเร็จ" }, { status: 502 });
  }
}

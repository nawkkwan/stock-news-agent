import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";

type AgentResult = {
  summary?: string;
  facts?: string[];
  inferences?: string[];
  risks?: string[];
  candidates?: string[];
  next_action?: string;
};

function formatAgentResult(result: AgentResult | string | null | undefined) {
  if (typeof result === "string") return result || "Hermes ทำงานเสร็จแล้ว แต่ไม่มีข้อความตอบกลับ";
  if (!result) return "";
  const sections: string[] = [];
  if (result.summary) sections.push(result.summary);
  if (result.facts?.length) sections.push(`ข้อเท็จจริง\n${result.facts.map((item) => `• ${item}`).join("\n")}`);
  if (result.inferences?.length) sections.push(`ข้อสังเกต\n${result.inferences.map((item) => `• ${item}`).join("\n")}`);
  if (result.risks?.length) sections.push(`ความเสี่ยง\n${result.risks.map((item) => `• ${item}`).join("\n")}`);
  if (result.candidates?.length) sections.push(`รายการที่ควรศึกษาเพิ่ม\n${result.candidates.map((item) => `• ${item}`).join("\n")}`);
  if (result.next_action) sections.push(`ขั้นต่อไป: ${result.next_action}`);
  return sections.join("\n\n") || "Hermes ทำงานเสร็จแล้ว แต่ไม่มีข้อความตอบกลับ";
}

export async function GET() {
  const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!apiBaseUrl) return NextResponse.json({ error: "ยังไม่ได้ตั้ง API_BASE_URL" }, { status: 503 });

  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: userData, error: userError }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    const accessToken = sessionData.session?.access_token;
    if (userError || !userData.user || !accessToken) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน Agent" }, { status: 401 });
    }
    const response = await fetch(`${apiBaseUrl}/v1/user/agent/history`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const payload = (await response.json().catch(() => null)) as {
      runs?: Array<{ id: string; request?: { agent?: string; question?: string }; response?: AgentResult | string | null; status?: string; error?: string; created_at?: string }>;
      detail?: string;
    } | null;
    if (!response.ok) return NextResponse.json({ error: payload?.detail || "อ่านประวัติ Hermes ไม่สำเร็จ" }, { status: response.status });
    const runs = (payload?.runs || []).map((run) => ({
      id: run.id,
      agent: run.request?.agent || "analyst",
      question: run.request?.question || "",
      answer: run.status === "failed" ? "" : formatAgentResult(run.response),
      status: run.status || "running",
      error: run.error || "",
      createdAt: run.created_at || "",
    })).reverse();
    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ error: "เชื่อมต่อ Azure Agent ไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";

type AgentResult = {
  summary?: string;
  facts?: string[];
  inferences?: string[];
  risks?: string[];
  candidates?: string[];
  next_action?: string;
};

function formatAgentResult(result: AgentResult) {
  const sections: string[] = [];
  if (result.summary) sections.push(result.summary);
  if (result.facts?.length) sections.push(`ข้อเท็จจริง\n${result.facts.map((item) => `• ${item}`).join("\n")}`);
  if (result.inferences?.length) sections.push(`ข้อสังเกต\n${result.inferences.map((item) => `• ${item}`).join("\n")}`);
  if (result.risks?.length) sections.push(`ความเสี่ยง\n${result.risks.map((item) => `• ${item}`).join("\n")}`);
  if (result.candidates?.length) sections.push(`รายการที่ควรศึกษาเพิ่ม\n${result.candidates.map((item) => `• ${item}`).join("\n")}`);
  if (result.next_action) sections.push(`ขั้นต่อไป: ${result.next_action}`);
  return sections.join("\n\n") || "Hermes ทำงานเสร็จแล้ว แต่ไม่มีข้อความตอบกลับ";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    return NextResponse.json({ error: "Invalid run id." }, { status: 400 });
  }

  const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้ง API_BASE_URL สำหรับเชื่อม Azure Agent" }, { status: 503 });
  }

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

    const response = await fetch(`${apiBaseUrl}/v1/user/agent/runs/${runId}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { status?: "running" | "succeeded" | "failed"; result?: AgentResult; error?: string; detail?: string }
      | null;

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.detail || "ตรวจสถานะ Hermes ไม่สำเร็จ" },
        { status: response.status }
      );
    }
    if (payload?.status === "succeeded") {
      return NextResponse.json({ status: "succeeded", answer: formatAgentResult(payload.result || {}) });
    }
    if (payload?.status === "failed") {
      return NextResponse.json({ status: "failed", error: payload.error || "Hermes ทำงานไม่สำเร็จ" });
    }
    return NextResponse.json({ status: "running" });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "ตรวจสถานะ Hermes ใช้เวลานานเกินไป"
      : "เชื่อมต่อ Azure Agent ไม่สำเร็จ กรุณาลองอีกครั้ง";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

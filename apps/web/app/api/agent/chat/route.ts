import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";

const allowedAgents = new Set(["scout", "analyst", "ranger"]);

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
  return sections.join("\n\n") || "ไม่พบคำตอบจาก Agent";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { agent?: string; question?: string; history?: unknown } | null;
  const agent = String(body?.agent || "").toLowerCase();
  const question = String(body?.question || "").trim();

  if (!allowedAgents.has(agent) || !question || question.length > 1200) {
    return NextResponse.json({ error: "Invalid agent or question." }, { status: 400 });
  }
  const history = Array.isArray(body?.history) ? body.history.slice(-5) : [];
  if (history.some((turn) => !turn || typeof turn.question !== "string" || typeof turn.answer !== "string" || turn.question.length > 1200 || turn.answer.length > 4000)) {
    return NextResponse.json({ error: "Invalid conversation history." }, { status: 400 });
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

    const response = await fetch(`${apiBaseUrl}/v1/user/agent/chat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agent, question, history }),
      signal: AbortSignal.timeout(75_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { mode?: "hermes" | "gemini"; status?: string; run_id?: string; result?: AgentResult; detail?: string }
      | null;

    if (!response.ok) {
      const message = response.status === 401
        ? "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่"
        : payload?.detail || "Azure Agent ตอบกลับผิดพลาด กรุณาลองอีกครั้ง";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    if (response.status === 202 && payload?.mode === "hermes" && payload.run_id) {
      return NextResponse.json(
        { mode: "hermes", status: "running", runId: payload.run_id },
        { status: 202 }
      );
    }

    return NextResponse.json({
      mode: "gemini",
      status: "completed",
      answer: formatAgentResult(payload?.result || {}),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Agent ใช้เวลานานเกินไป กรุณาลองอีกครั้ง"
      : "เชื่อมต่อ Azure Agent ไม่สำเร็จ กรุณาลองอีกครั้ง";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

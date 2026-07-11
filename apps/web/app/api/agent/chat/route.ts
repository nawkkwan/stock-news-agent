import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getInvestmentData } from "../../../../lib/investment-data";

const allowedAgents = new Set(["scout", "analyst", "ranger"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { agent?: string; question?: string } | null;
  const agent = String(body?.agent || "").toLowerCase();
  const question = String(body?.question || "").trim();

  if (!allowedAgents.has(agent) || !question || question.length > 1200) {
    return NextResponse.json({ error: "Invalid agent or question." }, { status: 400 });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!geminiApiKey && !openAiApiKey) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้ง GEMINI_API_KEY หรือ OPENAI_API_KEY สำหรับเว็บ จึงยังคุยกับ Agent ไม่ได้" },
      { status: 503 }
    );
  }

  const [reportText, data] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "data", "latest-report.json"), "utf8").catch(() => "{}"),
    getInvestmentData(),
  ]);
  const report = JSON.parse(reportText) as Record<string, unknown>;
  const safeContext = {
    report,
    portfolio: {
      selectedPortfolio: data.selectedPortfolio?.name || null,
      holdings: data.portfolioHoldings.map((item) => ({ ticker: item.ticker, weight: item.portfolio_weight, latest_price: item.latest_price })),
      watchlist: data.watchlist.map((item) => ({ ticker: item.ticker, status: item.status, reason: item.reason })),
      thesis: data.thesisNotes.map((item) => ({ ticker: item.ticker, bull_case: item.bull_case, bear_case: item.bear_case, key_risks: item.key_risks, growth_drivers: item.growth_drivers, confidence_score: item.confidence_score })),
    },
  };

  const roleFocus = {
    scout: "Focus on news relevance, source quality, duplicate/noisy coverage, and what deserves verification.",
    analyst: "Focus on portfolio impact, thesis implications, concentration, risk, and evidence gaps.",
    ranger: "Focus on watchlist research readiness, thesis completeness, price context if available, and what to review next. Never issue buy/sell instructions.",
  }[agent];

  const systemInstruction = `You are the ${agent} inside a private portfolio research room. ${roleFocus} Answer in Thai, concise but useful. Separate facts from inference. Use only the supplied context, admit missing data, and never place trades, provide price targets, or tell the user to buy, sell, hold, trim, or add. You are read-only and cannot modify portfolio data.`;
  const userPrompt = `Question: ${question}\n\nPortfolio context:\n${JSON.stringify(safeContext)}`;

  if (geminiApiKey) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": geminiApiKey, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Gemini ตอบกลับผิดพลาด กรุณาตรวจสอบ API key, model และโควตาการใช้งาน" },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    return NextResponse.json({ answer: answer || "ไม่พบคำตอบจาก Agent" });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${openAiApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Agent provider returned an error. Check the server API key and model." }, { status: 502 });
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return NextResponse.json({ answer: payload.choices?.[0]?.message?.content || "ไม่พบคำตอบจาก Agent" });
}

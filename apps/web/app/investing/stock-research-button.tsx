"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function StockResearchButton({ ticker, isHermesOwner }: { ticker: string; isHermesOwner: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState<string | null>(null);

  async function poll(activeRunId: string, attempts = 120) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await wait(2_000);
      const response = await fetch(`/api/agent/runs/${activeRunId}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { status?: string; error?: string } | null;
      if (!response.ok && [401, 403, 404].includes(response.status)) throw new Error(payload?.error || "อ่านผลงานวิจัยไม่ได้");
      if (payload?.status === "succeeded") {
        setState("done");
        setMessage("วิเคราะห์เสร็จแล้ว กำลังอัปเดตข้อมูลบนหน้านี้");
        setRunId(null);
        router.refresh();
        return;
      }
      if (payload?.status === "failed") throw new Error(payload.error || "Agent ทำงานไม่สำเร็จ");
    }
    setState("running");
    setMessage("งานยังทำต่ออยู่ กดตรวจผลอีกครั้งได้โดยไม่สร้างงานซ้ำ");
  }

  async function startResearch() {
    setState("running");
    setMessage(isHermesOwner ? "Hermes กำลังแบ่งงานและตรวจหลักฐาน..." : "Gemini กำลังตรวจราคา ข่าว และพอร์ต...");
    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/research`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null) as { runId?: string; status?: string; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "เริ่มวิเคราะห์ไม่ได้");
      if (response.status === 202 && payload?.runId) {
        setRunId(payload.runId);
        await poll(payload.runId);
        return;
      }
      setState("done");
      setMessage("วิเคราะห์เสร็จแล้ว กำลังอัปเดตข้อมูลบนหน้านี้");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "เชื่อมต่อ Agent ไม่สำเร็จ");
    }
  }

  return (
    <div className="stock-research-action">
      <button className="button" disabled={state === "running"} onClick={() => void startResearch()} type="button">
        {state === "running" ? "กำลังวิเคราะห์..." : isHermesOwner ? "วิเคราะห์เชิงลึกด้วย Hermes" : "วิเคราะห์ด้วย Gemini"}
      </button>
      {runId ? <button className="button secondary" onClick={() => void poll(runId)} type="button">ตรวจผลอีกครั้ง</button> : null}
      {message ? <p className={`research-status ${state}`}>{message}</p> : null}
    </div>
  );
}

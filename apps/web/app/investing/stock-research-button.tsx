"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StockResearchButtonProps = {
  ticker: string;
  question?: string;
  label?: string;
};

export function StockResearchButton({
  ticker,
  question = "",
  label = "วิเคราะห์ด้วย Gemini",
}: StockResearchButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  async function startResearch() {
    setState("running");
    setMessage("Gemini กำลังตรวจราคา ข่าว และพอร์ต...");
    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/research`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = await response.json().catch(() => null) as { status?: string; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "เริ่มวิเคราะห์ไม่ได้");
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
        {state === "running" ? "กำลังวิเคราะห์..." : label}
      </button>
      {message ? <p className={`research-status ${state}`}>{message}</p> : null}
    </div>
  );
}

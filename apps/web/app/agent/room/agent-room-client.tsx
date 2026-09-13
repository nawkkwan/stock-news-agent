"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type AgentId = "scout" | "analyst" | "ranger";

type AgentRoomClientProps = {
  isHermesOwner: boolean;
  metrics: {
    articles: number;
    signals: number;
    holdings: number;
    risks: number;
    watchlist: number;
    ready: number;
  };
  statuses: Record<AgentId, boolean>;
};

const agents: Record<AgentId, { name: string; role: string; greeting: string }> = {
  scout: {
    name: "Scout",
    role: "News filtering",
    greeting: "ผมดูข่าวและสัญญาณที่เข้ามา ถามได้เลยว่าวันนี้มีข่าวอะไรเด่นหรือข่าวไหนควรตรวจแหล่งเพิ่ม",
  },
  analyst: {
    name: "Analyst",
    role: "Portfolio context",
    greeting: "ผมเชื่อมข่าวกับพอร์ตและความเสี่ยง ถามภาพรวม น้ำหนักพอร์ต หรือผลกระทบที่เป็นไปได้ได้ครับ",
  },
  ranger: {
    name: "Ranger",
    role: "Watchlist monitoring",
    greeting: "ผมเฝ้า Watchlist และความพร้อมของ Thesis ถามได้ว่าตัวไหนควรกลับไปทบทวน แต่ผมจะไม่สั่งซื้อขายครับ",
  },
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function AgentRoomClient({ isHermesOwner, metrics, statuses }: AgentRoomClientProps) {
  const [selected, setSelected] = useState<AgentId>("analyst");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(
    isHermesOwner
      ? "Hermes Lead พร้อมมอบหมายงานผ่านโต๊ะ Analyst ให้ sub-agent ที่เหมาะสมครับ"
      : agents.analyst.greeting
  );
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  function selectAgent(agent: AgentId) {
    if (loading) return;
    setSelected(agent);
    setAnswer(isHermesOwner
      ? `Hermes Lead พร้อมมอบหมายงานผ่านโต๊ะ ${agents[agent].name} ให้ sub-agent ที่เหมาะสมครับ`
      : agents[agent].greeting);
    setRunId(null);
    setTimedOut(false);
  }

  async function pollHermesRun(activeRunId: string, maxAttempts = 120) {
    setLoading(true);
    setTimedOut(false);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) await wait(2_000);
      const response = await fetch(`/api/agent/runs/${activeRunId}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { status?: "running" | "succeeded" | "failed"; answer?: string; error?: string }
        | null;
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) {
          throw new Error(payload?.error || "ไม่สามารถอ่านงาน Hermes นี้ได้");
        }
        setAnswer("Hermes ยังทำงานอยู่ แต่การตรวจสถานะสะดุดชั่วคราว ระบบจะลองใหม่...");
        continue;
      }
      if (payload?.status === "succeeded") {
        setAnswer(payload.answer || "Hermes ทำงานเสร็จแล้ว");
        setQuestion("");
        setRunId(null);
        setLoading(false);
        return;
      }
      if (payload?.status === "failed") {
        setAnswer(payload.error || "Hermes ทำงานไม่สำเร็จ กรุณาลองอีกครั้ง");
        setRunId(null);
        setLoading(false);
        return;
      }
    }
    setAnswer("Hermes ยังทำงานต่ออยู่ คุณสามารถกด “ตรวจผลอีกครั้ง” ได้โดยไม่สร้างงานซ้ำ");
    setTimedOut(true);
    setLoading(false);
  }

  async function askAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setAnswer("กำลังเปิดแฟ้มข้อมูลและตรวจหลักฐาน...");
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: selected, question: trimmed }),
      });
      const payload = (await response.json()) as {
        mode?: "hermes" | "gemini";
        status?: string;
        runId?: string;
        answer?: string;
        error?: string;
      };
      if (response.status === 202 && payload.mode === "hermes" && payload.runId) {
        setRunId(payload.runId);
        setAnswer("Hermes กำลังแบ่งงานให้ sub-agent และรวบรวมคำตอบ...");
        await pollHermesRun(payload.runId);
        return;
      }
      setAnswer(payload.answer || payload.error || "Agent ยังตอบไม่ได้ในตอนนี้");
      if (response.ok) setQuestion("");
    } catch {
      setAnswer("เชื่อมต่อ Agent ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="interactive-room-layout">
      <section className="pixel-room interactive" aria-label="Interactive pixel art agent operations room">
        <Image
          className="pixel-room-image"
          src="/agent/pixel-agent-office-working.png"
          alt="Isometric pixel art office with agents working at their desks"
          width={1347}
          height={1168}
          priority
        />
        <div className="room-scanline" />

        <span className={`agent-screen scout-screen ${statuses.scout ? "working" : "idle"}`} aria-hidden="true" />
        <span className={`agent-screen analyst-screen ${statuses.analyst ? "working" : "idle"}`} aria-hidden="true" />
        <span className={`agent-screen ranger-screen ${statuses.ranger ? "working" : "idle"}`} aria-hidden="true" />

        <button className={`agent-hotspot scout-seat ${selected === "scout" ? "selected" : ""}`} onClick={() => selectAgent("scout")} aria-label="Talk to Scout" aria-pressed={selected === "scout"}>
          <span className="agent-seat-label"><i className={statuses.scout ? "working" : "idle"} />Scout · {statuses.scout ? "กำลังทำงาน" : "ว่าง"}</span>
        </button>
        <button className={`agent-hotspot analyst-seat ${selected === "analyst" ? "selected" : ""}`} onClick={() => selectAgent("analyst")} aria-label="Talk to Analyst" aria-pressed={selected === "analyst"}>
          <span className="agent-seat-label"><i className={statuses.analyst ? "working" : "idle"} />Analyst · {statuses.analyst ? "กำลังทำงาน" : "ว่าง"}</span>
        </button>
        <button className={`agent-hotspot ranger-seat ${selected === "ranger" ? "selected" : ""}`} onClick={() => selectAgent("ranger")} aria-label="Talk to Ranger" aria-pressed={selected === "ranger"}>
          <span className="agent-seat-label"><i className={statuses.ranger ? "working" : "idle"} />Ranger · {statuses.ranger ? "กำลังทำงาน" : "ว่าง"}</span>
        </button>

        <div className="room-live-strip">
          <span>Scout · {metrics.articles} news</span>
          <span>Analyst · {metrics.holdings} holdings</span>
          <span>Ranger · {metrics.watchlist} watched</span>
        </div>
      </section>

      <aside className="agent-chat-panel">
        <div className="agent-chat-head">
          <div><p className="eyebrow">Now talking</p><h3>{isHermesOwner ? "Hermes Lead" : agents[selected].name}</h3></div>
          <span>{isHermesOwner ? `Route · ${agents[selected].name}` : agents[selected].role}</span>
        </div>
        <div className="agent-chat-message">
          <span className="agent-chat-avatar">{agents[selected].name.slice(0, 1)}</span>
          <p>{answer}</p>
        </div>
        <div className="agent-chat-suggestions">
          {selected === "scout" ? <button onClick={() => setQuestion("วันนี้ข่าวอะไรสำคัญที่สุด และเพราะอะไร")}>ข่าวสำคัญที่สุด</button> : null}
          {selected === "analyst" ? <button onClick={() => setQuestion("สรุปความเสี่ยงสำคัญของพอร์ตวันนี้")}>ความเสี่ยงพอร์ต</button> : null}
          {selected === "ranger" ? <button onClick={() => setQuestion("Watchlist ตอนนี้มีตัวไหนพร้อมกลับไปทบทวนบ้าง")}>ตรวจ Watchlist</button> : null}
        </div>
        {timedOut && runId ? (
          <button className="agent-run-retry" type="button" onClick={() => void pollHermesRun(runId)} disabled={loading}>
            ตรวจผลอีกครั้ง
          </button>
        ) : null}
        <form className="agent-chat-form" onSubmit={askAgent}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`ถาม ${agents[selected].name}...`} rows={3} maxLength={1200} />
          <button type="submit" disabled={loading || !question.trim()}>{loading ? (isHermesOwner ? "Hermes working..." : "Researching...") : "Send question"}</button>
        </form>
        <p className="agent-chat-boundary">Read-only · ไม่แก้ Overview, Holdings หรือ Thesis โดยอัตโนมัติ</p>
      </aside>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

type AgentId = "scout" | "analyst" | "ranger";

type AgentRoomClientProps = {
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

const agents: Record<AgentId, { name: string; role: string; greeting: string; action: string }> = {
  scout: {
    name: "Scout",
    role: "News filtering",
    greeting: "ผมดูข่าวและสัญญาณที่เข้ามา ถามได้เลยว่าวันนี้มีข่าวอะไรเด่นหรือข่าวไหนควรตรวจแหล่งเพิ่ม",
    action: "มอบหมายให้คัดข่าว",
  },
  analyst: {
    name: "Analyst",
    role: "Portfolio context",
    greeting: "ผมเชื่อมข่าวกับพอร์ตและความเสี่ยง ถามภาพรวม น้ำหนักพอร์ต หรือผลกระทบที่เป็นไปได้ได้ครับ",
    action: "มอบหมายให้วิเคราะห์",
  },
  ranger: {
    name: "Ranger",
    role: "Watchlist monitoring",
    greeting: "ผมเฝ้า Watchlist และความพร้อมของ Thesis ถามได้ว่าตัวไหนควรกลับไปทบทวน แต่ผมจะไม่สั่งซื้อขายครับ",
    action: "มอบหมายให้ตรวจรายการ",
  },
};

export default function AgentRoomClient({ metrics, statuses }: AgentRoomClientProps) {
  const [selected, setSelected] = useState<AgentId>("analyst");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(agents.analyst.greeting);
  const [loading, setLoading] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [savedTicker, setSavedTicker] = useState<string | null>(null);

  function selectAgent(agent: AgentId) {
    if (loading) return;
    setSelected(agent);
    setAnswer(agents[agent].greeting);
    setActiveQuestion(null);
    setHistory([]);
    setSavedTicker(null);
  }

  async function askAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setAnswer("กำลังเปิดแฟ้มข้อมูลและตรวจหลักฐาน...");
    setActiveQuestion(trimmed);
    setSavedTicker(null);
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: selected, question: trimmed, history }),
      });
      const payload = (await response.json()) as {
        mode?: "gemini";
        status?: string;
        answer?: string;
        error?: string;
        savedTicker?: string;
      };
      setAnswer(payload.answer || payload.error || "Agent ยังตอบไม่ได้ในตอนนี้");
      if (response.ok) {
        if (payload.answer) setHistory((previous) => [...previous, { question: trimmed, answer: payload.answer!.slice(0, 4000) }].slice(-5));
        setSavedTicker(payload.savedTicker || null);
        setQuestion("");
      }
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

      <aside className="agent-mission-panel">
        <div className="agent-mission-head">
          <div><p className="eyebrow">Mission console</p><h3>{agents[selected].name}</h3></div>
          <span>Gemini · {agents[selected].role}</span>
        </div>
        <div className="agent-mission-brief">
          <span className="agent-mission-number">0{selected === "scout" ? "1" : selected === "analyst" ? "2" : "3"}</span>
          <div><strong>{agents[selected].role}</strong><p>{agents[selected].greeting}</p></div>
        </div>
        <div className="agent-mission-suggestions">
          {selected === "scout" ? <button onClick={() => setQuestion("วันนี้ข่าวอะไรสำคัญที่สุด และเพราะอะไร")}>ข่าวสำคัญที่สุด</button> : null}
          {selected === "analyst" ? <button onClick={() => setQuestion("สรุปความเสี่ยงสำคัญของพอร์ตวันนี้")}>ความเสี่ยงพอร์ต</button> : null}
          {selected === "ranger" ? <button onClick={() => setQuestion("Watchlist ตอนนี้มีตัวไหนพร้อมกลับไปทบทวนบ้าง")}>ตรวจ Watchlist</button> : null}
        </div>
        <form className="agent-mission-form" onSubmit={askAgent}>
          <label>
            <span>มอบหมายงาน</span>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`ระบุสิ่งที่ต้องการให้ ${agents[selected].name} ตรวจ...`} rows={4} maxLength={1200} />
          </label>
          <button type="submit" disabled={loading || !question.trim()}>{loading ? "กำลังทำ Mission..." : agents[selected].action}</button>
        </form>
        <section className={`agent-mission-result ${loading ? "working" : ""}`} aria-live="polite">
          <div><span>{loading ? "MISSION IN PROGRESS" : activeQuestion ? "LATEST MISSION" : "DESK STATUS"}</span><i /></div>
          {activeQuestion ? <strong>{activeQuestion}</strong> : null}
          <p>{answer}</p>
          {savedTicker ? <Link href={`/investing/companies/${encodeURIComponent(savedTicker)}`}>เปิด Agent thesis ของ {savedTicker} ↗</Link> : null}
        </section>
        <p className="agent-mission-boundary">ผลลัพธ์เป็นหลักฐานประกอบ · Gemini ไม่เขียนทับ Thesis และไม่ส่งคำสั่งซื้อขาย</p>
      </aside>
    </div>
  );
}

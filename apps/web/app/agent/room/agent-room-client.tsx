"use client";

import Image from "next/image";
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

export default function AgentRoomClient({ metrics }: AgentRoomClientProps) {
  const [selected, setSelected] = useState<AgentId>("analyst");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(agents.analyst.greeting);
  const [loading, setLoading] = useState(false);

  function selectAgent(agent: AgentId) {
    setSelected(agent);
    setAnswer(agents[agent].greeting);
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
      const payload = (await response.json()) as { answer?: string; error?: string };
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
          src="/agent/pixel-agent-room-topdown.png"
          alt="Bird's-eye view pixel art research operations room"
          width={1536}
          height={1024}
          priority
        />
        <div className="room-scanline" />

        <button className={`walking-agent scout-walk ${selected === "scout" ? "selected" : ""}`} onClick={() => selectAgent("scout")} aria-label="Talk to Scout">
          <Image src="/agent/agent-scout.png" alt="Scout walking" width={512} height={768} />
          <span>Scout</span>
        </button>
        <button className={`walking-agent analyst-walk ${selected === "analyst" ? "selected" : ""}`} onClick={() => selectAgent("analyst")} aria-label="Talk to Analyst">
          <Image src="/agent/agent-analyst.png" alt="Analyst walking" width={512} height={768} />
          <span>Analyst</span>
        </button>
        <button className={`walking-agent ranger-walk ${selected === "ranger" ? "selected" : ""}`} onClick={() => selectAgent("ranger")} aria-label="Talk to Ranger">
          <Image src="/agent/agent-ranger.png" alt="Ranger walking" width={512} height={768} />
          <span>Ranger</span>
        </button>

        <div className="room-live-strip">
          <span>Scout · {metrics.articles} news</span>
          <span>Analyst · {metrics.holdings} holdings</span>
          <span>Ranger · {metrics.watchlist} watched</span>
        </div>
      </section>

      <aside className="agent-chat-panel">
        <div className="agent-chat-head">
          <div><p className="eyebrow">Now talking</p><h3>{agents[selected].name}</h3></div>
          <span>{agents[selected].role}</span>
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
        <form className="agent-chat-form" onSubmit={askAgent}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`ถาม ${agents[selected].name}...`} rows={3} maxLength={1200} />
          <button type="submit" disabled={loading || !question.trim()}>{loading ? "Researching..." : "Send question"}</button>
        </form>
        <p className="agent-chat-boundary">Read-only · ไม่แก้ Overview, Holdings หรือ Thesis โดยอัตโนมัติ</p>
      </aside>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import type { ThesisNote } from "../../lib/investment-types";
import { upsertThesis, type ThesisSaveState } from "./actions";

const initialState: ThesisSaveState = { status: "idle", message: "" };

const sections = [
  ["ภาพรวมธุรกิจ", "business_overview"],
  ["เหตุผลที่สนใจ", "growth_drivers"],
  ["Bull case", "bull_case"],
  ["Bear case", "bear_case"],
  ["Moat", "moat"],
  ["ความเสี่ยงสำคัญ", "key_risks"],
  ["เงื่อนไขที่ทำให้ Thesis ผิด", "sell_conditions"],
] as const;

export function ThesisForm({ thesis, ticker }: { thesis?: ThesisNote | null; ticker: string }) {
  const [state, action, pending] = useActionState(upsertThesis, initialState);
  return (
    <form action={action} className="form-grid thesis-form">
      <input type="hidden" name="ticker" value={ticker} />
      <label className="span-2 thesis-title-field">
        <span>ชื่อหัวข้อ Thesis ของคุณ</span>
        <input name="title" type="text" maxLength={160} required placeholder={`เช่น ${ticker} — เหตุผลที่ฉันติดตาม`} defaultValue={thesis?.title || ""} />
      </label>
      {sections.map(([label, name]) => (
        <label className="span-2" key={name}>
          <span>{label}</span>
          <textarea name={name} rows={3} defaultValue={thesis?.[name] || ""} />
        </label>
      ))}
      <label>
        <span>ความมั่นใจของคุณ (0–100)</span>
        <input name="confidence_score" type="number" min={0} max={100} step="any" defaultValue={thesis?.confidence_score ?? ""} />
      </label>
      <div className="thesis-form-footer span-2">
        <button className="button" type="submit" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก Thesis ของฉัน"}</button>
        <p className={`thesis-save-message ${state.status}`} role="status" aria-live="polite">{state.message}</p>
      </div>
    </form>
  );
}

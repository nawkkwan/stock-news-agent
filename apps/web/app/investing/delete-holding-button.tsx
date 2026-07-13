"use client";

import { deleteHolding } from "./actions";

export function DeleteHoldingButton({ id, ticker }: { id: string; ticker: string }) {
  return (
    <form
      action={deleteHolding}
      className="delete-holding-form"
      onSubmit={(event) => {
        if (!window.confirm(`ลบ ${ticker} ออกจากพอร์ตนี้ใช่ไหม? ประวัติธุรกรรมจะยังถูกเก็บไว้`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="delete-holding-button" type="submit" aria-label={`ลบ ${ticker} ออกจากพอร์ต`}>
        ลบออกจากพอร์ต
      </button>
    </form>
  );
}

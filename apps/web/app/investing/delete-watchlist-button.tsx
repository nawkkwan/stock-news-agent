"use client";

import { deleteWatchlistItem } from "./actions";

export function DeleteWatchlistButton({ id, ticker }: { id: string; ticker: string }) {
  return (
    <form
      action={deleteWatchlistItem}
      onSubmit={(event) => {
        if (!window.confirm(`ลบ ${ticker} ออกจาก Watchlist? ประวัติข่าวและงานวิจัยจะยังอยู่`)) event.preventDefault();
      }}
    >
      <input name="id" type="hidden" value={id} />
      <button className="watchlist-delete" type="submit">ลบ</button>
    </form>
  );
}

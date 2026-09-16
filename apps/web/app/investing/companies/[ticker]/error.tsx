"use client";

import Link from "next/link";

export default function CompanyError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-shell stock-detail-page">
      <section className="panel company-error-card" role="alert">
        <p className="eyebrow">Stock workspace</p>
        <h1>เปิดหน้าหุ้นนี้ไม่สำเร็จ</h1>
        <p>ข้อมูลที่คุณพิมพ์ยังไม่ได้รับการยืนยันว่าบันทึกแล้ว กรุณาลองโหลดหน้าอีกครั้ง หากยังพบปัญหาให้กลับไปหน้าพอร์ตและลองใหม่</p>
        <div>
          <button className="button" type="button" onClick={reset}>ลองอีกครั้ง</button>
          <Link className="button secondary" href="/investing">กลับไป My Portfolio</Link>
        </div>
      </section>
    </main>
  );
}

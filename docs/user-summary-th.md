# สรุปสถานะโปรเจกต์สำหรับคุณขวัญ

อัปเดตล่าสุด: 2026-07-08

ไฟล์นี้เป็นภาษาไทยสำหรับคุณอ่านภาพรวม ส่วนไฟล์ `docs/codex-handoff.md` เป็นภาษาอังกฤษสำหรับให้ Codex รอบหน้าอ่านก่อนทำงานต่อ

## ตอนนี้ระบบทำอะไรได้แล้ว

- มีหน้า Overview เป็น dashboard หลักของพอร์ต
- UI เปลี่ยนเป็นโทน dark dashboard แล้ว
- มี donut chart แสดงสัดส่วนหุ้นในพอร์ต
- มีตาราง/ลิสต์ holdings แสดงหุ้นที่ถือ มูลค่า สัดส่วน และกำไร/ขาดทุน
- มีส่วน News by Holding ดึงข่าวจาก Daily News มาแสดงเฉพาะหุ้นที่ถือ
- มี Portfolio Activity รวมรายการซื้อ/ขาย/ฝาก/ถอน พร้อมเหตุผล
- มี Watchlist สำหรับหุ้นที่สนใจในอนาคต
- มี Notes สำหรับบันทึกเหตุผล/แนวคิดการลงทุน
- มี placeholder สำหรับ AI Agent / Trading Bot ในอนาคต แต่ยังไม่ต่อ broker และยังไม่ส่งคำสั่งซื้อขายจริง

## พอร์ตของคุณที่ใส่ไว้แล้ว

ตอนนี้ใส่พอร์ตจากรูปที่คุณส่งไว้ในข้อมูลล่าสุดแล้ว:

- VOO: 8,460.73 บาท, 45.56%, กำไร +826.45 บาท
- GOOGL: 4,233.47 บาท, 22.80%, กำไร +369.68 บาท
- VXUS: 2,099.28 บาท, 11.30%, กำไร +44.43 บาท
- XLV: 1,949.59 บาท, 10.50%, กำไร +86.67 บาท
- MSFT: 1,488.03 บาท, 8.01%, ขาดทุน -50.35 บาท
- PLTR: 339.94 บาท, 1.83%, กำไร +4.08 บาท

มูลค่ารวมประมาณ 18,571.04 บาท

## เรื่อง Supabase

เว็บตอนนี้ตั้งใจให้เป็น portfolio-first แล้ว คือเลือกพอร์ตหนึ่งก่อน แล้ว asset/cash/activity/news ด้านล่างจะอิงพอร์ตนั้น

สิ่งที่เพิ่มเข้าไป:

- ปุ่ม `Import Daily notes portfolio`
- ถ้ากดปุ่มนี้ ระบบจะเอาหุ้นจาก Daily News/latest report เข้า Supabase
- ถ้ายังไม่มีพอร์ต ระบบจะสร้างพอร์ตชื่อ `My Ports`
- หลัง import แล้ว donut chart และ holdings จะใช้ข้อมูลจาก Supabase จริง
- หน้า Overview จะไม่เอา Daily notes มาเป็น asset หลักแล้ว Daily notes เป็นแค่ตัวช่วย import/seed ข้อมูล
- ถ้า Supabase ยังไม่มี holdings หน้า Overview จะยังโชว์ `My Ports` จากรูปที่คุณส่ง เพื่อให้เห็น asset, %, donut chart ทันที ไม่หายไป

พูดง่ายๆ คือ Daily notes ที่เคยเป็นข้อมูล fallback สามารถกด import ให้กลายเป็นพอร์ตจริงได้แล้ว

## เรื่อง search หุ้นทั่วโลกและราคา

เพิ่ม layer สำหรับ market data แล้ว:

- ค้นหุ้นผ่าน API ฝั่ง server
- ดึง latest quote ผ่าน API ฝั่ง server
- key ไม่ถูกส่งเข้า browser

ตอนนี้ใช้ EODHD เป็นตัวหลัก และ Alpha Vantage เป็น fallback:

```text
EODHD_API_KEY=...
ALPHA_VANTAGE_API_KEY=...
```

ถ้ายังไม่ใส่ key ระบบพอร์ตยังใช้ได้ แต่ช่อง search/quote จะแจ้งว่ายังไม่ได้ตั้งค่า

## ถ้าเพิ่มหุ้นใหม่ ข่าวจะขึ้นไหม

ตอนนี้ทำให้ worker ข่าวสามารถอ่านหุ้นจาก Supabase ได้แล้ว แต่ต้องตั้งค่า env สำหรับ worker ก่อน เช่น:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:SUPABASE_USER_ID="..."
$env:SUPABASE_PORTFOLIO_NAME="My Ports"
```

ถ้าตั้งค่าตรงนี้แล้ว รอบ daily worker ถัดไปจะอ่านหุ้นจากพอร์ตใน Supabase

ถ้ายังไม่ตั้งค่า ระบบจะยัง fallback ไปอ่านไฟล์:

```text
data/portfolio.json
```

## วิธีเปิดเทส local

เปิดจาก repo root:

```powershell
npm.cmd --prefix apps/web run dev
```

แล้วเข้า:

```text
http://127.0.0.1:3000/investing
```

ถ้าจะ build เช็ก:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run web:build
```

## สิ่งที่เช็กผ่านแล้ว

- build เว็บผ่านแล้ว
- Python worker compile ผ่านแล้ว
- worker fallback อ่านหุ้น VOO, GOOGL, XLV, VXUS, PLTR, MSFT ได้
- local `/investing` เคยตอบ 200 ตอนเช็ก

## สิ่งที่ยังควรทำต่อ

- คุณลองกด `Import Daily notes portfolio` ในหน้า Overview
- เช็กว่าพอร์ต `My Ports` ขึ้นใน Supabase และ donut chart แสดงจากข้อมูลจริง
- ปรับ UX ฟอร์มเพิ่มหุ้น/เพิ่ม transaction ให้ใช้ง่ายกว่านี้
- ตั้งค่า worker บนเครื่องหรือ GitHub Actions ให้ใช้ Supabase เป็น source จริง
- ภายหลังค่อยทำ AI Agent/Trading Bot แต่ตอนนี้ยังไม่ควรต่อซื้อขายจริง

## Milestone / Phase ของโปรเจกต์

### Phase 0 - กู้ repo และทำ handoff

สถานะ: เกือบเสร็จแล้ว

ทำแล้ว:

- แก้ merge conflict แล้ว
- latest report ไปถึงวันที่ 2026-07-08
- build ผ่านแล้ว
- ทำเอกสาร handoff สำหรับ Codex รอบหน้า
- ทำเอกสารภาษาไทยสำหรับคุณอ่าน

เหลือ:

- ถ้าคุณโอเคแล้วค่อย commit ชุดนี้

### Phase 1 - Dark Portfolio Dashboard

สถานะ: ทำแล้ว รอคุณดู UI

ทำแล้ว:

- หน้า Overview เปลี่ยนเป็น dashboard สีดำ
- มี snapshot มูลค่าพอร์ต
- มี donut chart
- มี holdings list
- มีข่าวตามหุ้นที่ถือ
- มี activity timeline
- มี watchlist preview
- มี placeholder AI Agent / Trading Bot

เหลือ:

- คุณลองดูบนจอจริงและมือถือ
- ปรับ spacing/ฟอนต์/ความอ่านง่ายตาม feedback
- ภายหลังค่อยเพิ่ม logo หุ้นให้สวยกว่านี้

### Phase 2 - Supabase เป็นแหล่งข้อมูลหลักของพอร์ต

สถานะ: วาง foundation แล้ว และปรับเป็น portfolio-first แล้ว ต้องลองกดจริง

ทำแล้ว:

- เว็บอ่านข้อมูลจาก Supabase
- เพิ่มปุ่ม `Import Daily notes portfolio`
- ถ้าไม่มีพอร์ต ระบบสร้าง `My Ports`
- holdings ที่มีมูลค่าใน Supabase แสดง donut/table ได้เลย
- เพิ่มฟอร์ม add/update holding ใน Overview
- หน้า Overview ใช้ selected portfolio เป็นหลัก
- Daily notes เป็นแค่ import preview ไม่ใช่ asset หลัก
- ถ้า Supabase ยังว่าง จะมี `My Ports` seed ให้เห็นก่อน
- เพิ่มช่อง search หุ้นทั่วโลก/ดึง latest quote เพื่อเพิ่ม asset เข้าพอร์ต

เหลือ:

- คุณ sign in แล้วกด `Import Daily notes portfolio`
- เช็กว่า Supabase มีข้อมูลใน `portfolios`, `companies`, `holdings`
- เช็กว่า donut/table ใช้ข้อมูลจาก Supabase จริง
- ปรับ UX ฟอร์มเพิ่มหุ้น/เพิ่มพอร์ตให้ง่ายขึ้น
- ใส่ `EODHD_API_KEY` เพื่อให้ search/quote ใช้งานจริง

### Phase 3 - ซื้อขายแล้วพอร์ตเปลี่ยนตามจริง

สถานะ: ทำบางส่วนแล้ว

ทำแล้ว:

- buy/sell transaction มีผลต่อ holdings
- ขายจนเหลือ 0 แล้วหุ้นจะหายจาก open holdings
- ถ้ายังไม่มี latest price ระบบ fallback จาก cost/current value ได้
- activity timeline แสดงเหตุผลตอนซื้อขาย

เหลือ:

- เพิ่มแก้ไข/ลบ transaction ถ้าคุณต้องการ
- เพิ่ม realized gain/loss
- จัดการเรื่องค่าเงิน THB/USD ให้ชัดขึ้น
- ต่อแหล่งราคาหุ้นถ้าต้องการให้มูลค่า update อัตโนมัติ

### Phase 4 - Daily News อ่านพอร์ตจาก Supabase

สถานะ: โค้ดทำแล้ว แต่ config/deploy ยังต้องตั้งค่า

ทำแล้ว:

- worker ข่าวอ่าน tickers จาก Supabase ได้
- export latest report ใช้ portfolio loader ตัวเดียวกัน
- ถ้ายังไม่ตั้ง Supabase env จะ fallback ไป `data/portfolio.json`

เหลือ:

- ตั้ง env:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_USER_ID`
  - `SUPABASE_PORTFOLIO_NAME` หรือ `SUPABASE_PORTFOLIO_ID`
- ทดลองรัน daily worker กับ Supabase จริง
- เช็กว่าถ้าเพิ่มหุ้นใน Supabase ข่าวรอบถัดไปมีหุ้นนั้น

### Phase 5 - ปรับ UX ให้ใช้งานง่าย

สถานะ: ยังไม่ได้เริ่มจริง

สิ่งที่จะทำ:

- ฟอร์มเพิ่มพอร์ตให้ง่ายขึ้น
- ฟอร์มเพิ่มหุ้นให้ง่ายขึ้น
- ลดความรกใน Overview
- อาจทำ modal หรือ compact panel
- เช็ก responsive/mobile
- เพิ่ม sort/filter พอร์ต

### Phase 6 - AI Agent / Trading Bot

สถานะ: ยังเป็น placeholder เท่านั้น

ตอนนี้ยังไม่ทำ:

- ไม่ต่อ broker
- ไม่ส่ง order จริง
- ไม่ทำ real trading

อนาคตค่อยทำ:

- paper trading
- risk guardrails
- strategy journal
- backtest
- ระบบให้คนกดยืนยันก่อนเสมอ

## ไฟล์สำคัญที่แก้

- `apps/web/app/investing/page.tsx` หน้า Overview
- `apps/web/app/investing/components.tsx` component ของ dashboard
- `apps/web/app/investing/portfolio-asset-search.tsx` ช่อง search/add asset เข้าพอร์ต
- `apps/web/app/investing/actions.ts` action import/เพิ่มข้อมูล Supabase
- `apps/web/app/api/market-data/search/route.ts` API search หุ้น
- `apps/web/app/api/market-data/quote/route.ts` API latest quote
- `apps/web/lib/market-data.ts` logic ต่อ market data provider
- `apps/web/lib/portfolio-calculations.ts` logic คำนวณ holdings/donut
- `apps/web/lib/investment-data.ts` logic อ่านข้อมูลจาก Supabase
- `apps/worker/news/fetch_news.py` worker ข่าวอ่าน Supabase ได้
- `apps/worker/jobs/export_site_data.py` export latest report ใช้ source เดียวกับ worker
- `data/portfolio.json` ข้อมูลพอร์ต fallback
- `apps/web/data/latest-report.json` ข้อมูล Daily News ล่าสุด

## จำง่ายๆ

ตอนนี้ระบบเริ่มเป็น “Portfolio dashboard ที่ใช้ Supabase จริง” แล้ว

แต่ขั้นที่ต้องทำต่อคือ:

1. import พอร์ตคุณเข้า Supabase
2. ตั้ง daily worker ให้อ่าน Supabase
3. ปรับ UX ให้เพิ่มหุ้น/ซื้อขายง่ายขึ้น

# แผนพัฒนา Investment Agent ด้วย MongoDB และ Evaluation Loop

## 1. เป้าหมาย

พัฒนาโปรเจกต์จากระบบสรุปข่าวหุ้น ไปเป็น Investment Operating System ที่สามารถ:

- แสดงภาพรวมเศรษฐกิจและภาวะตลาด
- เชื่อมเหตุการณ์ระดับมหภาคเข้ากับพอร์ต
- วิเคราะห์หุ้นและ ETF ที่ถือเป็นรายตัว
- รับคำสั่งจากผู้ใช้เป็นงาน (Task)
- เฝ้าติดตามเงื่อนไขที่กำหนด (Monitor)
- บันทึกคำประเมินก่อนรู้ผลลัพธ์ในอนาคต
- ย้อนกลับมาวัดความถูกต้องและปรับปรุง Agent อย่างเป็นระบบ

ระบบนี้มีหน้าที่ช่วยรวบรวมหลักฐาน วิเคราะห์ และรักษาวินัยในการตัดสินใจ ไม่ใช่ระบบส่งคำสั่งซื้อขายจริง และไม่ควรตัดสินใจแทนผู้ใช้โดยอัตโนมัติ

## 2. สถาปัตยกรรมข้อมูลที่เสนอ

### Supabase/Postgres

ใช้เป็นฐานข้อมูลหลักของแอปพลิเคชันและข้อมูลที่ต้องการความถูกต้องเชิงธุรกรรม:

- Users และ Authentication
- Portfolios
- Holdings
- Transactions
- Cash ledger
- Watchlist
- Investment thesis
- Investment journal
- การตั้งค่าของผู้ใช้

### MongoDB

ใช้แทน TiDB ในบทบาท Research Warehouse, Agent Memory และ Agent Evaluation Store:

- ข่าวและเหตุการณ์ดิบ
- ภาพรวมตลาดตามช่วงเวลา
- ราคาและปริมาณซื้อขายย้อนหลัง
- งบการเงินและตัวชี้วัดพื้นฐาน
- ผลการวิเคราะห์ของ Agent
- ประวัติการเรียกใช้เครื่องมือ
- คำประเมินที่บันทึกก่อนรู้ผล
- ผลลัพธ์จริงหลังผ่านช่วงเวลาที่กำหนด
- คะแนนและข้อผิดพลาดของ Agent
- เอกสารสำหรับ Retrieval/RAG

หลักการสำคัญคือ Supabase เป็นแหล่งข้อมูลจริงของพอร์ต ส่วน MongoDB เป็นคลังข้อมูลวิจัยและประสบการณ์ของ Agent ไม่ควรเก็บข้อมูล Holdings หรือ Transactions ซ้ำเป็นแหล่งข้อมูลหลักสองแห่ง

## 3. Collections ที่ควรมีใน MongoDB

### `news_events`

เก็บข่าวและเหตุการณ์ดิบ โดยไม่เขียนทับเนื้อหาเดิม

ข้อมูลสำคัญ:

- `_id`
- `schema_version`
- `title`
- `url`
- `source`
- `published_at`
- `ingested_at`
- `tickers`
- `raw_text`
- `content_hash`

### `market_snapshots`

เก็บบริบทตลาด ณ เวลาหนึ่ง เช่น:

- ดัชนีหุ้นหลัก
- Bond yield
- Dollar index
- น้ำมันและทองคำ
- Volatility
- Market breadth
- Market regime
- Economic events ที่กำลังจะเกิดขึ้น

### `price_bars`

เก็บข้อมูลราคาแบบรายวันหรือช่วงเวลาอื่น:

- `symbol`
- `timestamp`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `source`

### `fundamental_snapshots`

เก็บข้อมูลงบและตัวชี้วัดพื้นฐานตามวันที่ประกาศ เพื่อป้องกันการนำข้อมูลในอนาคตไปใช้กับการวิเคราะห์ในอดีต

### `agent_runs`

เก็บประวัติการทำงานของ Agent:

- คำสั่งจากผู้ใช้หรือ Trigger
- Agent ที่รับผิดชอบ
- แผนการทำงาน
- เครื่องมือที่เรียกใช้
- Input และ Output
- เวลาเริ่มและจบ
- สถานะสำเร็จ ล้มเหลว รอข้อมูล หรือถูกยกเลิก
- Error และ Retry
- Model และ Prompt version

### `agent_assessments`

เก็บคำประเมินของ Agent ก่อนรู้ผลลัพธ์ในอนาคต โดยต้องแก้ไขย้อนหลังไม่ได้ หากต้องการเปลี่ยนให้สร้างเวอร์ชันใหม่

### `assessment_outcomes`

เก็บผลจริงของคำประเมินเมื่อครบกำหนด เช่น 1, 5, 20 และ 60 วัน

### `agent_evaluations`

เก็บคะแนนการประเมิน Agent เช่น:

- Direction accuracy
- ผลตอบแทนเทียบ Benchmark
- Maximum adverse excursion
- Maximum favorable excursion
- Calibration ของ Confidence
- ความถูกต้องของ Catalyst และ Risk
- คุณภาพและความครบถ้วนของหลักฐาน
- Feedback จากผู้ใช้

### `research_documents`

เก็บเอกสาร รายงาน Transcript และข้อมูลสำหรับ Retrieval/RAG พร้อม Metadata, Chunk version และแหล่งที่มา

## 4. กติกาของ JSON และ Data Contract

ไม่จำเป็นต้องออกแบบทุก Schema ให้สมบูรณ์ก่อนเริ่ม แต่ข้อมูลหลักต้องมีกติกาต่อไปนี้:

1. ทุก Record มี ID ที่ไม่ซ้ำ
2. มีเวลาที่ข้อมูลเกิดขึ้น เช่น `published_at` หรือ `observed_at`
3. มีเวลาที่ระบบได้รับข้อมูล เช่น `ingested_at`
4. มี `source` และ URL หรือ Source ID ที่ย้อนตรวจสอบได้
5. มี `schema_version`
6. ผลจาก AI ต้องมี `model_version` และ `prompt_version`
7. แยกข้อมูลดิบ ข้อมูลที่คำนวณ และความเห็นของ Agent ออกจากกัน
8. ผลวิเคราะห์ต้องอ้างกลับไปยัง Evidence ID
9. ไม่แก้ข้อมูลดิบย้อนหลัง หากข้อมูลเปลี่ยนให้สร้าง Record หรือ Version ใหม่
10. ใช้ UTC สำหรับเวลาที่จัดเก็บ และแปลงเป็น Asia/Bangkok ตอนแสดงผล
11. ป้องกัน Record ซ้ำด้วย `content_hash` หรือ Natural key
12. Validate ข้อมูลก่อนบันทึกทุกครั้ง

ตัวอย่างข่าวดิบ:

```json
{
  "_id": "news_123",
  "schema_version": 1,
  "tickers": ["MSFT"],
  "published_at": "2026-07-18T01:30:00Z",
  "ingested_at": "2026-07-18T01:35:00Z",
  "source": "company_ir",
  "title": "Microsoft announces...",
  "url": "https://example.com/article",
  "raw_text": "...",
  "content_hash": "..."
}
```

ตัวอย่างผลวิเคราะห์ข่าว:

```json
{
  "_id": "analysis_456",
  "schema_version": 1,
  "source_event_id": "news_123",
  "agent": "company_researcher",
  "model_version": "company-agent-v0.2",
  "prompt_version": "company-news-v3",
  "created_at": "2026-07-18T01:40:00Z",
  "impact": "negative_short_term",
  "confidence": 0.74,
  "reasoning_summary": "...",
  "affected_thesis_ids": ["thesis_msft_01"],
  "evidence_ids": ["news_123"]
}
```

## 5. รูปแบบคำประเมินของ Agent

ไม่ควรใช้เพียง Label `BUY`, `SELL` หรือ `น่าซื้อ/ไม่น่าซื้อ` เพราะไม่ระบุระยะเวลา ราคา ความเสี่ยง และบริบทตลาด

Agent ควรประเมินเป็นหลายมิติ:

```json
{
  "ticker": "MSFT",
  "as_of": "2026-07-18T01:00:00Z",
  "market_regime": "risk_off",
  "fundamental_quality": 84,
  "valuation_attractiveness": 55,
  "technical_condition": 48,
  "catalyst_strength": 72,
  "downside_risk": 66,
  "expected_horizon": "3-12 months",
  "stance": "watch",
  "confidence": 0.71,
  "thesis": [
    "Cloud growth remains strong",
    "AI spending could pressure margins",
    "Higher bond yields pressure valuation"
  ],
  "invalidations": [
    "Cloud growth falls below the defined threshold",
    "Free-cash-flow margin deteriorates for two quarters"
  ],
  "evidence_ids": [
    "news_123",
    "fundamental_456",
    "market_snapshot_789"
  ],
  "model_version": "portfolio-agent-v0.2",
  "prompt_version": "portfolio-assessment-v1"
}
```

คำประเมินต้องระบุอย่างน้อย:

- เวลาที่ประเมิน
- ราคาที่ทราบ ณ ตอนประเมิน
- Benchmark
- ระยะเวลาที่คาดหวัง
- Thesis
- Risk
- Catalyst
- เงื่อนไขที่ทำให้ Thesis ใช้ไม่ได้
- Confidence
- Evidence
- Model/Prompt version

## 6. Agent Loop

วงจรหลักของ Agent:

1. **Observe** — อ่านตลาด ข่าว พอร์ต Thesis และ Assessment เดิม
2. **Detect** — ตรวจหาการเปลี่ยนแปลงหรือความผิดปกติ
3. **Investigate** — ค้นหลักฐานเพิ่มเติมจากแหล่งที่เชื่อถือได้
4. **Connect** — เชื่อมเหตุการณ์กับ Exposure และ Thesis ของพอร์ต
5. **Assess** — สร้างคำประเมินพร้อม Confidence และเงื่อนไขล้มเหลว
6. **Report** — รายงานเฉพาะสิ่งที่เปลี่ยนและเกี่ยวข้องกับผู้ใช้
7. **Remember** — บันทึก Task, Evidence, Assessment และสิ่งที่ต้องติดตาม
8. **Evaluate** — เมื่อครบกำหนดให้เทียบคำประเมินกับผลจริง
9. **Improve** — นำข้อผิดพลาดไปปรับ Prompt, Rule, Tool หรือ Data pipeline

## 7. รูปแบบการสั่งงาน Agent

หน้า Agent Room ควรมีสามโหมด:

### Ask

ถามและตอบทันที เช่น “ทำไมพอร์ตวันนี้ลงแรงกว่าตลาด”

### Task

มอบหมายงานที่มีจุดสิ้นสุด เช่น “วิเคราะห์ผลของ Bond yield ต่อหุ้นทุกตัวในพอร์ต พร้อมหลักฐาน”

### Monitor

เฝ้าติดตามเงื่อนไข เช่น “ถ้า US 10Y เพิ่มมากกว่า 0.15% ภายในหนึ่งวัน ให้ประเมิน Growth exposure ของพอร์ตใหม่”

Agent ต้องแสดงสถานะงาน แหล่งข้อมูล เวลาอัปเดต และเหตุผลที่หยุดหรือรอข้อมูล ผู้ใช้ต้องสามารถยกเลิกงานได้

## 8. บทบาทของ Agent ในอนาคต

เริ่มจาก Agent เดียวให้ทำงานถูกต้องก่อน แล้วจึงพิจารณาแยกบทบาท:

- **Macro Scout** — เศรษฐกิจ ดอกเบี้ย เงินเฟ้อ สภาพคล่อง และ Market regime
- **Portfolio Analyst** — Exposure, Concentration และผลกระทบต่อพอร์ต
- **Company Researcher** — ข่าว งบ Valuation, Catalyst และ Thesis รายบริษัท
- **Risk Ranger** — Thesis break, Drawdown และความเสี่ยงใหม่
- **Chief Agent** — รวมผลและคัดเฉพาะสิ่งสำคัญให้ผู้ใช้

ไม่ควรเริ่ม Multi-agent ก่อนที่ Agent เดียวจะมี Tools, Memory, Evaluation, Stop condition และผลลัพธ์ที่ตรวจสอบได้

## 9. ระบบประเมินผล

เมื่อ Agent สร้าง Assessment แล้ว ระบบต้องบันทึกไว้ก่อนรู้ผล และสร้าง Outcome ตามช่วงเวลาที่กำหนด:

- 1 วัน: ผลกระทบระยะสั้น
- 5 วัน: ปฏิกิริยาหลังตลาดย่อยข้อมูล
- 20 วัน: ผลประมาณหนึ่งเดือนซื้อขาย
- 60 วัน: ผลระยะกลาง

ทุกช่วงเวลาควรตรวจ:

- Absolute return
- Excess return เทียบ Benchmark
- Maximum drawdown ระหว่างทาง
- Maximum favorable movement
- Direction ของ Assessment ถูกหรือไม่
- Thesis และ Catalyst เกิดขึ้นจริงหรือไม่
- Risk ที่เตือนไว้เกิดขึ้นหรือไม่
- Confidence สอดคล้องกับอัตราความถูกต้องหรือไม่

ห้ามใช้ข้อมูลที่เกิดหลังเวลา Assessment ในการสร้าง Assessment ย้อนหลัง เพราะจะทำให้เกิด Look-ahead bias

## 10. วิธีพัฒนา Agent โดยไม่ Fine-tune ทุกวัน

### งานประจำวัน

- นำเข้าข้อมูลใหม่
- Deduplicate และ Validate
- สร้าง Market snapshot
- ให้ Agent วิเคราะห์การเปลี่ยนแปลง
- บันทึก Assessment ก่อนรู้ผล
- ตรวจ Assessment เก่าที่ครบกำหนด
- อัปเดต Evaluation dashboard

### งานรายสัปดาห์หรือรายเดือน

- วิเคราะห์ข้อผิดพลาดของ Agent
- ตรวจคำตอบที่ Confidence สูงแต่ผิด
- ตรวจ Tool calls ที่ไม่จำเป็นหรือล้มเหลว
- ปรับ Prompt, Rule และ Tool selection
- ทดสอบ Agent รุ่นใหม่ด้วย Dataset เดิม
- เปรียบเทียบรุ่นใหม่กับ Baseline ก่อนนำไปใช้

### Fine-tuning ในอนาคต

ทำเมื่อมีตัวอย่างคุณภาพสูงที่มนุษย์ตรวจแล้วจำนวนเพียงพอ โดย:

- แยก Training, Validation และ Test ตามช่วงเวลา
- ไม่ให้ข่าวหรือผลลัพธ์อนาคตรั่วเข้า Training sample
- Fine-tune งานที่มีรูปแบบชัด เช่น Classification หรือ Extraction
- ไม่ใช้ Fine-tuning แทน Retrieval ของข้อมูลตลาดล่าสุด
- เก็บ Model version และสามารถย้อนกลับรุ่นเดิมได้

## 11. Human Approval และข้อจำกัด

Agent สามารถทำงานอ่าน ค้นหา วิเคราะห์ และสร้าง Draft ได้อัตโนมัติ แต่ควรขออนุมัติก่อน:

- แก้ไข Investment thesis หลัก
- เปลี่ยนข้อมูล Portfolio หรือ Transaction
- ส่งข้อความหรือเผยแพร่รายงานไปภายนอก
- เปลี่ยน Monitor rule ที่มีผลต่อผู้ใช้
- ลบข้อมูลหรือแก้ Assessment เดิม
- ดำเนินการใดที่เกี่ยวกับการซื้อขายจริง

ระบบไม่ควรเก็บ API key, Password, Access token หรือข้อมูลลับไว้ใน Agent prompt, Agent memory หรือ Tool-call log

## 12. ลำดับการลงมือทำ

### Phase 1 — Data Foundation

- ตัดสินใจใช้ MongoDB แทน TiDB อย่างเป็นทางการ
- บันทึก Architecture Decision
- กำหนด Data ownership ระหว่าง Supabase และ MongoDB
- สร้าง JSON Schema และ Versioning
- สร้าง Collections และ Indexes ขั้นต้น
- ทำ Ingestion สำหรับข่าว ราคา และ Market snapshot
- ทำ Deduplication และ Data validation

### Phase 2 — Single Agent Task System

- เพิ่ม Task model และ Task status
- ให้ Agent อ่านข้อมูลพอร์ตจาก Supabase
- ให้ Agent อ่านข้อมูลวิจัยจาก MongoDB
- เพิ่ม Tools สำหรับข่าว ราคา Macro และ Thesis
- บันทึก Agent run และ Tool calls
- แสดง Sources, Confidence และ Model version
- เพิ่ม Cancel, Retry, Timeout และ Stop condition

### Phase 3 — Assessment and Outcome

- กำหนด Assessment schema
- บันทึก Assessment แบบแก้ย้อนหลังไม่ได้
- สร้าง Outcome worker สำหรับ 1/5/20/60 วัน
- เลือก Benchmark ที่เหมาะกับสินทรัพย์
- คำนวณ Return, Excess return และ Drawdown
- สร้าง Evaluation dashboard

### Phase 4 — Monitor Loop

- เพิ่ม Scheduled tasks
- เพิ่ม Event-based triggers
- แจ้งเตือนเฉพาะเหตุการณ์ที่มีนัยสำคัญต่อพอร์ต
- เชื่อมผลกับ Thesis และ Exposure
- ป้องกัน Alert ซ้ำและ Alert fatigue

### Phase 5 — Continuous Improvement

- สร้างชุดทดสอบจากงานจริง
- เปรียบเทียบ Prompt/Agent version
- เพิ่ม Human feedback
- ทำ Error taxonomy
- จูน Prompt, Rules และ Tools เป็นรอบ
- พิจารณา Fine-tuning เฉพาะเมื่อมี Dataset ที่พร้อม

### Phase 6 — Multi-agent

- แยก Agent ตามบทบาทเมื่อ Single Agent มีความเสถียร
- ให้ Chief Agent รวมผลและจัดลำดับความสำคัญ
- จำกัดขอบเขต เครื่องมือ งบประมาณ และเวลาของแต่ละ Agent
- ประเมินทั้งผลราย Agent และผลรวมของระบบ

## 13. เกณฑ์ว่า Foundation พร้อมแล้ว

เริ่มพัฒนา Agent Loop ขั้นจริงจังได้เมื่อ:

- ข้อมูลทุกประเภทมี Source และ Timestamp
- ข่าวซ้ำถูกจัดการได้
- Schema มี Version
- สามารถสร้าง Market snapshot ที่เวลาใดเวลาหนึ่งได้
- สามารถดึงข้อมูลที่ Agent เห็น ณ เวลาประเมินกลับมาได้
- Assessment อ้าง Evidence ได้ครบ
- Agent run ตรวจสอบย้อนหลังได้
- Outcome worker ทำงานแบบ Idempotent
- มี Baseline สำหรับเปรียบเทียบ
- มี Test set ที่ไม่ปนกับข้อมูลที่ใช้จูน

## 14. หลักการตัดสินใจสำคัญ

1. Data quality มาก่อนจำนวน Agent
2. Retrieval ของข้อมูลล่าสุดมาก่อน Fine-tuning
3. บันทึกคำประเมินก่อนรู้ผลเสมอ
4. วัดผลหลายระยะเวลา ไม่ใช้เพียงราคาวันถัดไป
5. วัดเทียบ Benchmark ไม่ดูเฉพาะหุ้นขึ้นหรือลง
6. แยกข้อเท็จจริงออกจากความเห็นของ AI
7. ทุกข้อสรุปสำคัญต้องย้อนกลับไปยังหลักฐานได้
8. Agent ต้องรู้จักหยุดและรายงานว่าไม่มีข้อมูลเพียงพอ
9. รุ่นใหม่ต้องผ่าน Evaluation ก่อนแทนรุ่นเดิม
10. ผู้ใช้เป็นผู้อนุมัติการเปลี่ยนแปลงสำคัญเสมอ

## 15. ผลลัพธ์ปลายทาง

เมื่อระบบครบวงจร ผู้ใช้ควรสามารถเปิด Dashboard แล้วเห็น:

- ภาวะเศรษฐกิจและ Market regime ปัจจุบัน
- ผลกระทบต่อพอร์ตและ Exposure สำคัญ
- หุ้นหรือ ETF ที่ต้องให้ความสนใจ
- Thesis, Catalyst และ Risk ของหุ้นแต่ละตัว
- งานที่ Agent กำลังทำ
- สิ่งที่เปลี่ยนจากการวิเคราะห์ครั้งก่อน
- ประวัติความแม่นยำของ Agent
- เหตุผลว่าทำไม Agent จึงให้คำประเมินนั้น

เป้าหมายไม่ใช่การสร้าง Agent ที่บอกให้ซื้อหรือขายได้บ่อยที่สุด แต่เป็น Agent ที่ใช้ข้อมูลถูกเวลา อ้างหลักฐานได้ รู้ข้อจำกัดของตัวเอง และช่วยให้ผู้ใช้ตัดสินใจอย่างมีระบบมากขึ้น

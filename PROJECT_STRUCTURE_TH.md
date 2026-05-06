# 📋 Project Structure Guide
## โปรเจค: Stock News Agent

---

## 🎯 ภาพรวมโปรเจค

โปรเจคนี้เป็น **ตัวแทนดึงข่าวหุ้น** ที่มีความสามารถ:
- 📊 อ่านพอร์ตโฟลิโอหุ้นที่คุณถือ
- 🔍 ดึงข่าวหุ้นจาก Google News RSS
- 🎯 ตรวจสอบข่าวซ้ำและรวบรวม
- 📈 วิเคราะห์ข้อมูลเทคนิคัลของหุ้น
- 📝 สร้างรายงานข่าวและวิเคราะห์โดย AI
- 📄 ส่งรายงานไปยัง Google Docs โดยอัตโนมัติ

---

## 📁 โครงสร้างโปรเจค - คำอธิบายรายละเอียด

```
stock-news-agent/
├── 📁 data/                              # 📦 ข้อมูลพอร์ตโฟลิโอ
│   └── portfolio.json                    # รายชื่อหุ้นที่ถือ
│
├── 📁 scripts/                           # 🔧 สคริปต์หลักของโปรเจค
│   ├── run_daily_report.py               # ✅ สคริปต์หลัก - รันรายงานรายวัน
│   ├── fetch_news.py                     # 📰 ดึงข่าวจาก RSS
│   ├── deduplicate_news.py               # 🔄 กรองข่าวซ้ำออก
│   ├── summarize_portfolio.py            # 📊 สรุปข้อมูลพอร์ตโฟลิโอ
│   ├── analyze_technicals.py             # 📈 วิเคราะห์เทคนิคัล (EMA, RSI, MACD)
│   ├── publish_google_doc.py             # 📤 ส่งรายงานไปยัง Google Docs
│   └── path_utils.py                     # 🛠️ ตัวช่วย - จัดการเส้นทางไฟล์
│
├── 📁 prompts/                           # 💬 Prompt สำหรับ AI
│   └── portfolio_news_prompt.md          # Prompt สำหรับสร้างรายงาน
│
├── 📁 reports/                           # 📋 ไฟล์รายงานที่สร้างขึ้น
│   ├── *-raw-news.json                   # ข่าวดิบทั้งหมด (ยังไม่ประมวลผล)
│   ├── *-deduped-news.json               # ข่าวที่ตรวจสอบแล้ว (ไม่ซ้ำ)
│   ├── *-portfolio-news-report.md        # รายงานข่าวหลัก (Markdown)
│   ├── *-analysis.json                   # ข้อมูลการวิเคราะห์ AI
│   └── *-technicals.json                 # ข้อมูลเทคนิคัล (EMA, RSI, MACD, Support/Resistance)
│
├── 📁 site/                              # 🌐 เว็บไซต์แสดงผล
│   ├── index.html                        # หน้าแรก
│   ├── app.js                            # JavaScript สำหรับใช้งาน
│   ├── styles.css                        # ดีไซน์เว็บ
│   ├── vercel.json                       # ตั้งค่า Vercel (hosting)
│   └── 📁 data/                          # ข้อมูลสำหรับเว็บ
│       ├── latest-report.json            # รายงานล่าสุด
│       └── 📁 reports/                   # ประวัติรายงาน
│           └── *.json                    # รายงานในแต่ละวัน
│
├── 📁 credentials/                       # 🔑 ข้อมูลรับรอง
│   └── credentials.json                  # Google API credentials
│
├── .env.example                          # 📝 ตัวอย่าง Environment Variables
├── requirements.txt                      # 📚 ไลบรารี Python ที่ต้องใช้
├── token.json                            # 🔐 Google API refresh token
├── README.md                             # 📖 คำอธิบายภาษาอังกฤษ
└── PROJECT_STRUCTURE_TH.md               # 📄 ไฟล์นี้
```

---

## 🔄 ขั้นตอนการทำงาน (Workflow)

### 1️⃣ **ดึงข่าว** (fetch_news.py)
- อ่าน portfolio.json เพื่อหาหุ้นทั้งหมด
- ค้นหาข่าวจาก Google News RSS สำหรับแต่ละหุ้น
- บันทึกข่าว raw ลงใน `*-raw-news.json`

### 2️⃣ **ตรวจสอบข่าวซ้ำ** (deduplicate_news.py)
- เปรียบเทียบข่าวจากแหล่งต่าง ๆ
- ลบข่าวที่ซ้ำกัน (ตรวจ Title และ URL)
- บันทึกข่าวที่ไม่ซ้ำ ลงใน `*-deduped-news.json`

### 3️⃣ **วิเคราะห์เทคนิคัล** (analyze_technicals.py)
- ดึงข้อมูลราคาหุ้นย้อนหลัง
- คำนวณ: EMA, RSI, MACD
- หาจุด Support / Resistance
- บันทึกลงใน `*-technicals.json`

### 4️⃣ **สรุปพอร์ตโฟลิโอ** (summarize_portfolio.py)
- รวบรวมข้อมูลพอร์ตโฟลิโอ
- เตรียมข้อมูลสำหรับรายงาน

### 5️⃣ **สร้างรายงาน** (OpenAI API)
- ใช้ AI เพื่ออ่านข่าว + ข้อมูลเทคนิคัล
- สร้างรายงานเป็น Markdown
- บันทึกเป็น `*-portfolio-news-report.md`

### 6️⃣ **ส่งไป Google Docs** (publish_google_doc.py)
- นำรายงาน Markdown ส่งไปยัง Google Doc
- อัปเดตลิงก์ไฟล์

### 7️⃣ **อัปเดตเว็บ** (site/)
- อัปเดตไฟล์ JSON ในโฟลเดอร์ `site/data/`
- เว็บไซต์อ่านข้อมูลและแสดงผล

---

## 📊 ไฟล์ข้อมูลสำคัญ

### **portfolio.json** (ที่ต้องสร้าง)
```json
[
  {
    "ticker": "MSFT",           // หุ้น US
    "company": "Microsoft"
  },
  {
    "ticker": "ADVANC.BK",      // หุ้น SET Thailand
    "company": "Advanced Info"
  }
]
```

### **credentials.json** (Google API)
- ดาวน์โหลดจาก Google Cloud Console
- ใช้เพื่ออนุญาตให้แพร่กายข่าวไป Google Docs

### **.env** (ตัวแปรสภาพแวดล้อม)
```
OPENAI_API_KEY=sk-...              # OpenAI API key สำหรับ AI
GOOGLE_APPLICATION_CREDENTIALS=... # เส้นทางไปยัง credentials.json
```

---

## 🚀 วิธีการใช้งาน

### **ติดตั้ง**
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### **รันรายงานรายวัน**
```powershell
python scripts/run_daily_report.py
```

---

## 🔧 ไลบรารี Python ที่ใช้

| ไลบรารี | ประโยชน์ |
|--------|---------|
| `requests` | ดึงข้อมูลจากอินเทอร์เนต |
| `feedparser` | อ่าน RSS feeds |
| `openai` | เรียก OpenAI API |
| `google-api-python-client` | ส่งข้อมูลไป Google Docs |
| `python-dotenv` | อ่าน .env |
| `pandas` | จัดการข้อมูล DataFrame |

---

## 📌 ข้อสำคัญ

✅ **โปรเจคนี้ไม่ได้:**
- ทำการซื้อขายหุ้น
- ให้คำแนะนำการลงทุน
- บอกให้ซื้อ/ขายหุ้น

✅ **โปรเจคนี้ทำ:**
- รวบรวมข่าว + วิเคราะห์ปกติ
- ช่วยติดตามข้อมูลหุ้นของคุณ
- แสดงผลรายงานในรูปแบบสวยงาม

---

## 🎯 สรุปอย่างรวบรัด

| ขั้นตอน | ไฟล์ | ผลลัพธ์ |
|--------|-----|---------|
| 🔍 ดึงข่าว | `fetch_news.py` | `*-raw-news.json` |
| 🔄 ตรวจซ้ำ | `deduplicate_news.py` | `*-deduped-news.json` |
| 📈 วิเคราะห์ | `analyze_technicals.py` | `*-technicals.json` |
| 🤖 สร้างรายงาน | OpenAI API | `*-portfolio-news-report.md` |
| 📤 ส่ง Google Docs | `publish_google_doc.py` | Google Doc URL |
| 🌐 แสดงเว็บ | `site/` | เว็บไซต์สดใจ |

---

**✨ ตอนนี้คุณเข้าใจโปรเจคแล้ว! มี คำถามเพิ่มเติมหรือต้องการสร้างส่วนใหม่ไหม?**

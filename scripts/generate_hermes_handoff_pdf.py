from __future__ import annotations

import argparse
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "hermes-system-handoff-th.pdf"
W, H = A4

NAVY = HexColor("#0B1728")
PANEL = HexColor("#13263E")
TEAL = HexColor("#38D7C4")
GOLD = HexColor("#F6C453")
BLUE = HexColor("#6AB7FF")
MUTED = HexColor("#9FB2C8")
INK = HexColor("#EAF2FA")
RED = HexColor("#FF7B72")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Thai", r"C:\Windows\Fonts\LeelawUI.ttf"))
    pdfmetrics.registerFont(TTFont("ThaiBold", r"C:\Windows\Fonts\LeelaUIb.ttf"))


def wrap(c: canvas.Canvas, text: str, width: float, font: str = "Thai", size: float = 10) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if c.stringWidth(candidate, font, size) <= width:
            line = candidate
        elif line:
            lines.append(line)
            line = word
        else:
            lines.append(word)
            line = ""
    if line:
        lines.append(line)
    return lines or [""]


def text(c: canvas.Canvas, value: str, x: float, y: float, width: float, *, size: float = 10,
         color=INK, font: str = "Thai", leading: float | None = None) -> float:
    leading = leading or size * 1.45
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap(c, value, width, font, size):
        c.drawString(x, y, line)
        y -= leading
    return y


def bullet(c: canvas.Canvas, value: str, x: float, y: float, width: float, *, color=INK) -> float:
    c.setFillColor(TEAL)
    c.circle(x + 3, y + 3, 2.2, fill=1, stroke=0)
    return text(c, value, x + 13, y + 8, width - 13, size=9.2, color=color, leading=13.5) - 4


def rounded(c: canvas.Canvas, x: float, y: float, w: float, h: float, *, fill=PANEL, stroke=None, radius=12) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def tag(c: canvas.Canvas, value: str, x: float, y: float, color=TEAL) -> None:
    width = c.stringWidth(value, "ThaiBold", 8) + 18
    rounded(c, x, y - 3, width, 19, fill=HexColor("#17344A"), stroke=color, radius=9)
    c.setFillColor(color)
    c.setFont("ThaiBold", 8)
    c.drawString(x + 9, y + 2, value)


def header(c: canvas.Canvas, number: str, title: str, subtitle: str) -> None:
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.setFont("ThaiBold", 9)
    c.drawString(42, H - 44, f"HERMES SYSTEM HANDOFF  /  {number}")
    c.setFillColor(INK)
    c.setFont("ThaiBold", 24)
    c.drawString(42, H - 112, title)
    text(c, subtitle, 42, H - 138, W - 84, size=9.5, color=MUTED)
    c.setStrokeColor(HexColor("#29425E"))
    c.line(42, H - 158, W - 42, H - 158)


def footer(c: canvas.Canvas, page: int) -> None:
    c.setFillColor(MUTED)
    c.setFont("Thai", 7.5)
    c.drawString(42, 24, "ข้อมูล ณ 4 ตุลาคม 2026  |  ไม่มี secret value ในเอกสาร")
    c.drawRightString(W - 42, 24, f"{page} / 8")


def node(c: canvas.Canvas, x: float, y: float, w: float, title: str, detail: str, color=TEAL) -> None:
    rounded(c, x, y, w, 62, fill=PANEL, stroke=color, radius=10)
    c.setFillColor(color)
    c.setFont("ThaiBold", 10)
    c.drawString(x + 12, y + 40, title)
    text(c, detail, x + 12, y + 24, w - 24, size=7.8, color=MUTED, leading=10)


def arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color=BLUE) -> None:
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.8)
    c.line(x1, y1, x2, y2)
    c.line(x2, y2, x2 - 6, y2 + 3)
    c.line(x2, y2, x2 - 6, y2 - 3)


def build(args: argparse.Namespace) -> None:
    register_fonts()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4)
    c.setTitle("สรุประบบ Hermes และการย้ายจาก Azure ไป Render")
    c.setAuthor("Investment OS handoff")

    # 1 - Cover
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.rect(42, H - 72, 58, 6, fill=1, stroke=0)
    c.setFont("ThaiBold", 12)
    c.drawString(42, H - 102, "INVESTMENT OS  /  TECHNICAL HANDOFF")
    c.setFillColor(INK)
    c.setFont("ThaiBold", 36)
    c.drawString(42, H - 170, "สรุประบบ Hermes")
    c.drawString(42, H - 215, "และแผนหยุด Azure")
    text(c, "บันทึกสิ่งที่สร้าง การเชื่อมต่อ ต้นทุน บทเรียน และสถาปัตยกรรมใหม่ที่ใช้ Render Free + Gemini โดยคง Supabase และข้อมูลเดิมทั้งหมด", 42, H - 255, 470, size=13, color=MUTED, leading=20)
    rounded(c, 42, 315, 511, 168, fill=PANEL, stroke=HexColor("#29425E"))
    tag(c, "DECISION", 62, 448, GOLD)
    text(c, "หยุด Hermes, Discord automation และ Daily Worker ชั่วคราว", 62, 414, 460, size=18, font="ThaiBold", color=INK, leading=24)
    y = bullet(c, "ย้าย FastAPI ไป Render Free และให้เว็บเรียก Gemini โดยตรง", 62, 365, 455)
    y = bullet(c, "เก็บ Supabase, Cloudflare, Portfolio, Journal, Thesis และประวัติเดิม", 62, y, 455)
    bullet(c, "ลบ Azure resource group เดิมหลังตรวจ Render และเว็บผ่าน", 62, y, 455)
    rounded(c, 42, 116, 245, 150, fill=HexColor("#102D3A"), stroke=TEAL)
    c.setFillColor(TEAL); c.setFont("ThaiBold", 11); c.drawString(60, 238, "AZURE STUDENT CREDIT")
    c.setFillColor(INK); c.setFont("ThaiBold", 30); c.drawString(60, 190, "$77 / $100")
    text(c, "ภาพหน้าจอ ณ วันที่บันทึก: ใช้ไปประมาณ $23 และ October cost $1.80", 60, 160, 200, size=8.5, color=MUTED)
    rounded(c, 308, 116, 245, 150, fill=HexColor("#2D2617"), stroke=GOLD)
    c.setFillColor(GOLD); c.setFont("ThaiBold", 11); c.drawString(326, 238, "WHY STOP NOW")
    text(c, "Hermes มี min replica = 1 จึงมีค่าใช้จ่ายต่อเนื่อง แม้เป็นโปรเจกต์ทดลอง การลดส่วน always-on ช่วยเก็บเครดิตไว้เรียนรู้โปรเจกต์อื่น", 326, 202, 200, size=10, color=INK, leading=15)
    footer(c, 1); c.showPage()

    # 2 - Current architecture
    header(c, "02", "สถาปัตยกรรมเดิม", "เส้นทางเว็บและ Discord เป็นคนละทาง แต่ใช้ FastAPI และ Supabase ร่วมกัน")
    node(c, 42, 620, 120, "Cloudflare Web", "Next.js + Supabase Auth")
    node(c, 224, 620, 145, "Azure FastAPI", "ตรวจ user token และอ่านข้อมูลพอร์ต")
    node(c, 431, 620, 122, "Hermes", "Azure Container App / min 1")
    arrow(c, 163, 650, 218, 650); arrow(c, 370, 650, 425, 650)
    node(c, 224, 505, 145, "Supabase", "Auth + Postgres + RLS + history", GOLD)
    arrow(c, 296, 618, 296, 570, GOLD)
    node(c, 431, 505, 122, "Gemini API", "LLM provider ที่ Hermes เรียก", BLUE)
    arrow(c, 492, 618, 492, 570, BLUE)
    rounded(c, 42, 320, 511, 140, fill=PANEL, stroke=HexColor("#29425E"))
    c.setFillColor(INK); c.setFont("ThaiBold", 14); c.drawString(60, 426, "สิ่งที่ตรวจพบจริง")
    y = bullet(c, "เว็บของบัญชีเจ้าของ: FastAPI สร้าง Hermes run แล้วเว็บ polling ผลทุก 2 วินาที", 60, 392, 470)
    y = bullet(c, "ผู้ใช้อื่น: FastAPI เรียก Gemini โดยตรงและตอบกลับทันที", 60, y, 470)
    y = bullet(c, "Hermes cloud ไม่มี DISCORD_BOT_TOKEN จึงไม่ได้เปิด Discord gateway อยู่จริง", 60, y, 470)
    bullet(c, "Daily Worker ส่ง Discord digest ผ่าน webhook แยกจาก Hermes bot", 60, y, 470)
    rounded(c, 42, 145, 511, 125, fill=HexColor("#211D2A"), stroke=RED)
    c.setFillColor(RED); c.setFont("ThaiBold", 12); c.drawString(60, 238, "จุดที่ทำให้สิ้นเปลือง")
    text(c, "Hermes ต้องเปิดค้างหนึ่ง replica และลากทรัพยากรประกอบหลายชิ้น ได้แก่ managed environment, registry, storage และ Log Analytics ขณะที่งานหลักสุดท้ายยังเรียก Gemini อยู่ดี", 60, 207, 470, size=11, color=INK, leading=17)
    footer(c, 2); c.showPage()

    # 3 - Flows
    header(c, "03", "คำขอไหลอย่างไร", "แยก 3 เส้นทางเพื่อไม่สับสนว่าอะไรเป็น API, bot หรือ webhook")
    flows = [
        ("A", "เว็บ - Owner", "Cloudflare -> FastAPI -> Hermes async -> Gemini -> polling -> Supabase", RED),
        ("B", "เว็บ - ผู้ใช้อื่น", "Cloudflare -> FastAPI -> Gemini sync -> Supabase", TEAL),
        ("C", "Discord", "Hermes bot -> FastAPI (ถ้ามี token) / Worker -> Discord webhook", GOLD),
    ]
    y = 610
    for letter, title_, path, color in flows:
        rounded(c, 42, y, 511, 112, fill=PANEL, stroke=color)
        rounded(c, 58, y + 30, 52, 52, fill=color, stroke=color, radius=26)
        c.setFillColor(NAVY); c.setFont("ThaiBold", 20); c.drawCentredString(84, y + 47, letter)
        c.setFillColor(color); c.setFont("ThaiBold", 13); c.drawString(128, y + 74, title_)
        text(c, path, 128, y + 48, 400, size=10, color=INK, leading=14)
        y -= 138
    rounded(c, 42, 144, 511, 76, fill=HexColor("#102D3A"), stroke=TEAL)
    text(c, "ข้อสรุป: สำหรับการศึกษาระบบส่วนตัว เส้นทาง B เพียงพอที่สุด จึงนำมาใช้กับเจ้าของด้วย และตัดการ polling ออกจากหน้าจอ", 60, 190, 470, size=12, font="ThaiBold", color=INK, leading=18)
    footer(c, 3); c.showPage()

    # 4 - Components/security
    header(c, "04", "ส่วนประกอบและขอบเขตความปลอดภัย", "ข้อมูลลับอยู่ฝั่งเซิร์ฟเวอร์ และแต่ละผู้ใช้ยังถูกแยกด้วย user_id/portfolio_id")
    cards = [
        (42, 525, "Cloudflare Web", ["เก็บเฉพาะ publishable key", "ส่ง Supabase access token", "ไม่ถือ service-role key"], TEAL),
        (308, 525, "FastAPI", ["ตรวจ token ของผู้ใช้", "ใช้ service-role เฉพาะ backend", "เรียก Gemini/EODHD"], BLUE),
        (42, 330, "Supabase", ["ฐานข้อมูลหลัก", "Auth + RLS", "เก็บ snapshots และ agent_runs"], GOLD),
        (308, 330, "Hermes archive", ["source code ยังเก็บไว้", "memory 3 ไฟล์ถูกสำรอง", ".env/auth ไม่ถูกดาวน์โหลด"], RED),
    ]
    for x, y, title_, items, color in cards:
        rounded(c, x, y, 245, 160, fill=PANEL, stroke=color)
        c.setFillColor(color); c.setFont("ThaiBold", 13); c.drawString(x + 18, y + 128, title_)
        yy = y + 98
        for item in items:
            yy = bullet(c, item, x + 18, yy, 208)
    rounded(c, 42, 158, 511, 118, fill=HexColor("#1E2634"), stroke=HexColor("#536C8A"))
    c.setFillColor(INK); c.setFont("ThaiBold", 12); c.drawString(60, 244, "สิ่งที่คงไว้โดยตั้งใจ")
    y = bullet(c, "ตาราง `hermes_thesis_notes` ไม่ถูกเปลี่ยนชื่อ เพื่อลดความเสี่ยงจาก migration", 60, 214, 470)
    y = bullet(c, "หน้าเว็บเรียกว่า Agent thesis; ของใหม่ระบุ source_kind เป็น gemini_*", 60, y, 470)
    bullet(c, "ประวัติ Hermes เดิมยังอ่านได้และไม่ถูกเขียนทับ", 60, y, 470)
    footer(c, 4); c.showPage()

    # 5 - Azure inventory
    header(c, "05", "Azure ที่เคยเปิดอยู่", "ตรวจพบ 11 resources ใน resource group เดียว: investment-os-eastasia-rg")
    rows = [
        ("Compute", "investment-research-api-jp", "Container App / min 0 max 3"),
        ("Compute", "investment-hermes", "Container App / min 1 max 1"),
        ("Schedule", "investment-daily-worker-jp", "Job / 18:00 เวลาไทย"),
        ("Platform", "investment-os-japanwest-env", "Managed environment"),
        ("Images", "stockagentkwan2549", "Container Registry"),
        ("State", "stockagentkwan2549data", "Storage + hermes-data share"),
        ("Logs", "5 workspaces", "East Asia 3 / Japan West 2"),
    ]
    y = 650
    for kind, name, detail in rows:
        c.setFillColor(HexColor("#101F33") if int((650 - y) / 46) % 2 == 0 else PANEL)
        c.roundRect(42, y - 12, 511, 40, 6, fill=1, stroke=0)
        c.setFillColor(TEAL); c.setFont("ThaiBold", 8); c.drawString(56, y + 4, kind.upper())
        c.setFillColor(INK); c.setFont("ThaiBold", 9); c.drawString(132, y + 4, name)
        c.setFillColor(MUTED); c.setFont("Thai", 8.5); c.drawRightString(537, y + 4, detail)
        y -= 46
    rounded(c, 42, 210, 511, 92, fill=HexColor("#2D2617"), stroke=GOLD)
    c.setFillColor(GOLD); c.setFont("ThaiBold", 12); c.drawString(60, 269, "ภาพรวมต้นทุน")
    text(c, "Credit คงเหลือ $77 จาก $100, October cost $1.80 ณ ภาพที่ได้รับ ตัวเลขนี้เป็น snapshot ไม่ใช่ใบแจ้งหนี้ สิ่งที่ควรหยุดก่อนคือ Hermes min replica = 1", 60, 241, 470, size=10, color=INK, leading=15)
    rounded(c, 42, 130, 511, 54, fill=PANEL, stroke=TEAL)
    text(c, "Image revision ก่อนปิด: 1a17c6c1c7fcc81ae49b84f7cdb1cd7fd93f6f2f", 60, 159, 470, size=9, color=MUTED)
    footer(c, 5); c.showPage()

    # 6 - Lessons
    header(c, "06", "บทเรียนที่ได้จากการทำ Hermes", "สิ่งที่ควรนำไปใช้ต่อ แม้จะหยุด runtime เดิม")
    lessons = [
        ("01", "แยก orchestration กับ model provider", "Hermes คือชั้นจัดงาน ส่วน Gemini คือผู้สร้างคำตอบ จึงสามารถตัด Hermes ออกโดยไม่ย้ายฐานข้อมูล"),
        ("02", "Scale-to-zero ไม่เท่ากับทั้งระบบฟรี", "API min 0 ช่วยได้ แต่ Hermes min 1, logs, registry และ storage ยังมีต้นทุนประกอบ"),
        ("03", "Discord มีสองแบบ", "Bot gateway กับ webhook digest ไม่ใช่ระบบเดียวกัน ต้องหยุดทั้ง runtime และ schedule แยกกัน"),
        ("04", "State ต้องสำรองแบบเลือกไฟล์", "ควรเก็บ memory ที่ใช้ส่งต่อ แต่ไม่คัดลอก .env, auth.json หรือ secret ออกมาโดยไม่จำเป็น"),
        ("05", "เก็บข้อมูลเดิมก่อนเปลี่ยนชื่อ", "ใช้ source_kind แยก Gemini/Hermes ได้ โดยไม่เสี่ยง migration ตารางที่มีข้อมูลจริง"),
    ]
    y = 650
    for num, title_, detail in lessons:
        rounded(c, 42, y - 26, 511, 82, fill=PANEL, stroke=HexColor("#29425E"))
        c.setFillColor(TEAL); c.setFont("ThaiBold", 18); c.drawString(58, y + 12, num)
        c.setFillColor(INK); c.setFont("ThaiBold", 11); c.drawString(112, y + 22, title_)
        text(c, detail, 112, y + 2, 415, size=8.7, color=MUTED, leading=12)
        y -= 96
    footer(c, 6); c.showPage()

    # 7 - Target
    header(c, "07", "สถาปัตยกรรมใหม่: Render Free", "เส้นทางสั้นลง ลดส่วน always-on และคงระบบข้อมูลเดิม")
    node(c, 42, 610, 112, "Browser", "เข้าสู่ระบบ Supabase")
    node(c, 194, 610, 130, "Cloudflare", "Next.js web proxy")
    node(c, 364, 610, 130, "Render Free", "FastAPI / Python")
    arrow(c, 155, 640, 188, 640); arrow(c, 325, 640, 358, 640)
    node(c, 236, 480, 132, "Supabase", "Auth + data + history", GOLD)
    node(c, 406, 480, 132, "Gemini", "Direct provider call", BLUE)
    arrow(c, 430, 608, 330, 544, GOLD); arrow(c, 466, 608, 472, 544, BLUE)
    rounded(c, 42, 300, 511, 120, fill=PANEL, stroke=TEAL)
    c.setFillColor(TEAL); c.setFont("ThaiBold", 12); c.drawString(60, 389, "Render configuration")
    y = bullet(c, "Native Python runtime, Singapore, plan free, health check /health", 60, 358, 470)
    y = bullet(c, "Build: pip install -r requirements-api.txt", 60, y, 470)
    y = bullet(c, "Start: uvicorn apps.api.app.main:app --host 0.0.0.0 --port $PORT", 60, y, 470)
    bullet(c, "Secrets ตั้งใน Render dashboard; ไม่มี Hermes/Discord variables", 60, y, 470)
    rounded(c, 42, 145, 511, 110, fill=HexColor("#2D2617"), stroke=GOLD)
    c.setFillColor(GOLD); c.setFont("ThaiBold", 12); c.drawString(60, 223, "ข้อจำกัด Free tier")
    text(c, "บริการอาจ sleep หลังไม่มี traffic และ cold start ใช้เวลาประมาณหนึ่งนาที เว็บจึงตั้ง timeout 150 วินาที ไม่มี cron ฟรี และไม่ควรยิง keep-alive เพื่อฝืนข้อจำกัด", 60, 193, 470, size=10.5, color=INK, leading=16)
    footer(c, 7); c.showPage()

    # 8 - Status / checklist
    header(c, "08", "บันทึกการส่งต่อและปิดระบบ", "สถานะจริง ณ เวลาสร้างเอกสาร พร้อมสิ่งที่ต้องรู้เมื่อต้องกลับมาเปิดใหม่")
    status_items = [
        ("โค้ด Gemini direct + Render", "พร้อม", TEAL),
        ("สำรอง Hermes memory", "เสร็จแล้ว", TEAL),
        ("Render deployment", args.render_status, TEAL if args.render_status == "ใช้งานแล้ว" else GOLD),
        ("Cloudflare API_BASE_URL", args.cloudflare_status, TEAL if args.cloudflare_status == "อัปเดตแล้ว" else GOLD),
        ("Azure resource group", args.azure_status, TEAL if args.azure_status == "ลบแล้ว" else GOLD),
        ("Daily Worker / Discord", "พักทั้งหมด", TEAL),
    ]
    y = 650
    for label, value, color in status_items:
        rounded(c, 42, y - 10, 511, 44, fill=PANEL, stroke=HexColor("#29425E"))
        c.setFillColor(INK); c.setFont("ThaiBold", 9.5); c.drawString(58, y + 5, label)
        c.setFillColor(color); c.setFont("ThaiBold", 9.5); c.drawRightString(537, y + 5, value)
        y -= 52
    rounded(c, 42, 235, 511, 90, fill=HexColor("#102D3A"), stroke=TEAL)
    c.setFillColor(TEAL); c.setFont("ThaiBold", 11); c.drawString(60, 294, "ไฟล์สำรอง")
    text(c, "output/archive/azure-hermes-retirement-2026-10-04/ เก็บ SOUL.md, MEMORY.md, USER.md และ manifest SHA-256 โดยไม่มี secret", 60, 267, 470, size=9.5, color=INK, leading=14)
    rounded(c, 42, 140, 511, 70, fill=HexColor("#1E2634"), stroke=HexColor("#536C8A"))
    text(c, f"Render URL: {args.render_url or 'รอ URL หลัง deploy'}", 60, 180, 470, size=9, color=MUTED)
    text(c, "หากกลับมาใช้ Discord ให้สร้างเป็นโปรเจกต์แยกและกำหนดงบ/รอบทำงานก่อนเปิด bot แบบต่อเนื่อง", 60, 159, 470, size=9, color=MUTED)
    footer(c, 8); c.save()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-status", default="รอ deploy")
    parser.add_argument("--cloudflare-status", default="รออัปเดต")
    parser.add_argument("--azure-status", default="รอยืนยันหลังย้าย")
    parser.add_argument("--render-url", default="")
    build(parser.parse_args())
    print("output/pdf/hermes-system-handoff-th.pdf")

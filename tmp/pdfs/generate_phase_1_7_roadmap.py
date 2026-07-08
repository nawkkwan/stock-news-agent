from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = "output/pdf/investment-research-engine-phases-1-7.pdf"


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111827"),
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#4B5563"),
            spaceAfter=16,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=20,
            textColor=colors.HexColor("#111827"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=6,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#1F2937"),
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10.5,
            textColor=colors.HexColor("#374151"),
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
        ),
        "table": ParagraphStyle(
            "Table",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.4,
            leading=9.8,
            textColor=colors.HexColor("#111827"),
        ),
    }


def p(text, style):
    return Paragraph(text, style)


def bullets(items, s):
    return ListFlowable(
        [ListItem(p(item, s["body"]), leftIndent=8) for item in items],
        bulletType="bullet",
        leftIndent=12,
        bulletFontName="Helvetica",
        bulletFontSize=6,
        bulletColor=colors.HexColor("#D9A600"),
        spaceAfter=6,
    )


def make_table(rows, widths, s):
    rendered = []
    for i, row in enumerate(rows):
        style = s["table_head"] if i == 0 else s["table"]
        rendered.append([p(cell, style) for cell in row])
    table = Table(rendered, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]
        )
    )
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(16 * mm, 11 * mm, "Investment Research Engine Roadmap")
    canvas.drawRightString(194 * mm, 11 * mm, f"Page {doc.page}")
    canvas.restoreState()


def add_phase(story, s, title, goal, deliverables, data, outcome):
    story.append(p(title, s["h1"]))
    story.append(p(f"<b>Goal:</b> {goal}", s["body"]))
    story.append(p("<b>Core deliverables</b>", s["h2"]))
    story.append(bullets(deliverables, s))
    story.append(p("<b>Data / tables</b>", s["h2"]))
    story.append(bullets(data, s))
    story.append(p(f"<b>Expected outcome:</b> {outcome}", s["body"]))


def build():
    s = styles()
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Investment Research Engine Phases 1-7",
        author="Codex",
    )

    story = [
        p("Investment Research Engine Roadmap", s["title"]),
        p("Phases 1-7: from portfolio tracking to a theme-based research engine", s["subtitle"]),
        p("System Overview", s["h1"]),
        p(
            "The project is a private investment operating system. It starts with portfolio tracking and journaling, then grows into market data ingestion, research datasets, NotebookLM exports, and a theme-based scoring engine. It is decision support only and does not place trades.",
            s["body"],
        ),
        make_table(
            [
                ["Layer", "Role"],
                ["Next.js Web", "Portfolio dashboard, holdings, journal, news, themes, and user workflows."],
                ["Supabase", "Primary app database for auth, RLS, portfolios, holdings, transactions, journal, and news records."],
                ["FastAPI / Python", "API foundation for indicators, research processing, jobs, and future backtests."],
                ["Python Worker", "Scheduled ingestion, daily reports, technical snapshots, and future alerts."],
                ["TiDB", "Planned research warehouse for historical prices, news archives, sentiment, theme history, and future backtests."],
                ["NotebookLM", "Research reader using exported Markdown, PDF, or Google Docs sources."],
            ],
            [38 * mm, 134 * mm],
            s,
        ),
        Spacer(1, 8),
        p("Roadmap Summary", s["h1"]),
        make_table(
            [
                ["Phase", "Name", "Main Purpose"],
                ["1", "Portfolio Foundation", "Separate portfolios, holdings, transactions, cash, P/L, watchlist, thesis, and journal."],
                ["2", "Market Data + Technical Snapshot", "Daily prices, RSI, EMA, support/resistance, and trend status."],
                ["3", "Daily Data Pipeline", "Automated ingestion, snapshots, reports, and job logs."],
                ["4", "News + Research Dataset", "Turn news into structured events for research and future bots."],
                ["5", "Journal + Decision Review", "Capture decisions, confidence, risks, mistakes, and reviews."],
                ["6", "NotebookLM / Knowledge Export", "Export research briefs into readable sources for NotebookLM."],
                ["7", "Theme Engine v1", "Score themes like Uranium, AI Electricity, Energy, Defense, and Bitcoin."],
            ],
            [18 * mm, 48 * mm, 106 * mm],
            s,
        ),
    ]

    story.append(PageBreak())
    add_phase(
        story,
        s,
        "Phase 1: Portfolio Foundation",
        "Build a real portfolio workspace that can separate main, experimental, theme, paper, and future bot portfolios.",
        [
            "Supabase Auth with Row Level Security for user-owned data.",
            "Multi-portfolio support through the `portfolios` table.",
            "Holdings and transactions linked by `portfolio_id`.",
            "Basic dashboard with portfolio value, holdings count, cash balance, unrealized P/L, and target allocation.",
            "Watchlist, thesis notes, investment journal, and news items as supporting workflows.",
        ],
        [
            "`portfolios`: account/strategy containers.",
            "`holdings`: current holding settings per portfolio.",
            "`portfolio_transactions`: deposits, withdrawals, buys, sells, dividends, and fees.",
            "`investment_journal`, `watchlist`, `thesis_notes`, `news_items`: decision context.",
        ],
        "The system can track separate portfolios without mixing cash ledgers, positions, or journal context. Current status: foundation implemented.",
    )

    add_phase(
        story,
        s,
        "Phase 2: Market Data + Technical Snapshot",
        "Make the app understand the daily technical condition of every holding.",
        [
            "Choose one price provider first: Financial Modeling Prep, Twelve Data, Polygon, or Finnhub.",
            "Ingest daily OHLCV prices for holdings and watchlist symbols.",
            "Calculate EMA20, EMA50, EMA200, RSI14, volume state, and simple support/resistance.",
            "Show technical fields in the holdings dashboard.",
            "Classify each ticker as strong, neutral, weak, or warning.",
        ],
        [
            "`market_prices`: ticker, date, open, high, low, close, volume, source.",
            "`technical_snapshots`: ticker, date, close, EMA values, RSI, support, resistance, trend status.",
        ],
        "The dashboard can answer: price, P/L, RSI, EMA trend, support/resistance, and whether a holding is technically healthy.",
    )

    story.append(PageBreak())
    add_phase(
        story,
        s,
        "Phase 3: Daily Data Pipeline",
        "Automate daily data collection so the database becomes a long-term personal research asset.",
        [
            "Python worker reads holdings and watchlist symbols.",
            "Fetch prices after market close or in the morning Thailand time.",
            "Save raw market data and calculate technical snapshots.",
            "Update portfolio snapshots and generated report JSON.",
            "Log job status, duration, record counts, and errors.",
            "Prepare the pipeline for future LINE alerts.",
        ],
        [
            "`market_prices` and `technical_snapshots` from Phase 2.",
            "`portfolio_snapshots`: daily portfolio value, cash, P/L, exposure.",
            "`job_runs`: job name, started, finished, status, errors, records processed.",
        ],
        "The system starts collecting daily evidence automatically, which later supports Theme Engine, backtests, and alerts.",
    )

    add_phase(
        story,
        s,
        "Phase 4: News + Research Dataset",
        "Convert news from something to read into structured event data for research and future model training.",
        [
            "Fetch news for current holdings, watchlist symbols, and themes.",
            "Normalize articles, deduplicate repeated stories, and map articles to tickers and themes.",
            "Generate Thai/English summaries, sentiment score, impact score, and event type.",
            "Classify events such as earnings, guidance, macro, regulation, analyst upgrades/downgrades, risks, and sector news.",
            "Link events to price reactions after 1 day, 5 days, and 20 days.",
        ],
        [
            "`news_articles`, `article_entities`, `article_ticker_links`, `article_theme_links`.",
            "`sentiment_snapshots`, `event_tags`, `price_reactions`, `earnings_events`, `filings`.",
        ],
        "News becomes a machine-readable research dataset that can power Theme Score, Decision Score, and future backtests.",
    )

    story.append(PageBreak())
    add_phase(
        story,
        s,
        "Phase 5: Journal + Decision Review",
        "Turn the investor's reasoning into structured data that can be reviewed and improved.",
        [
            "Record buy, sell, hold, trim, add, research, and rebalance decisions.",
            "Capture thesis, confidence, risk, and what would make the decision wrong.",
            "Link journal entries to portfolio, ticker, theme, and relevant news events.",
            "Add 7-day, 30-day, 90-day, and 180-day review workflows.",
            "Tag mistakes such as FOMO, bought too late, ignored valuation, sold too early, or position too large.",
        ],
        [
            "`investment_journal`: decision entries.",
            "`journal_reviews`: thesis review and outcome review.",
            "`journal_tags`: mistake/process tags.",
            "`journal_attachments`: charts, screenshots, and supporting files.",
        ],
        "The app can answer why a trade or research action happened, whether the thesis worked, and what process patterns repeat.",
    )

    add_phase(
        story,
        s,
        "Phase 6: NotebookLM / Knowledge Export",
        "Create readable research sources that can be imported into NotebookLM for question-answering and review.",
        [
            "Export daily, weekly, portfolio, and theme reports as Markdown, PDF, or Google Docs.",
            "Daily briefs include portfolio summary, P/L, technical alerts, important news, journal notes, risks, and research questions.",
            "Weekly reports include portfolio review, best/worst holdings, theme changes, important events, and lessons.",
            "Theme reports include thesis, tickers, macro indicators, events, risks, score history, and open questions.",
        ],
        [
            "`knowledge/daily/YYYY-MM-DD.md`.",
            "`knowledge/weekly/YYYY-Www.md`.",
            "`knowledge/themes/<theme>/YYYY-MM-DD.md`.",
            "`knowledge/portfolio/daily-brief.md`.",
        ],
        "NotebookLM becomes a research reader over the investor's own curated sources, while Supabase/TiDB remain the databases.",
    )

    story.append(PageBreak())
    add_phase(
        story,
        s,
        "Phase 7: Theme Engine v1",
        "Build a theme-based research engine instead of a single-purpose trading bot.",
        [
            "Create themes such as Uranium, AI Electricity Demand, Energy, Defense, Bitcoin, Robotics, Healthcare, Space, Semiconductor, and Nuclear Power.",
            "Link tickers, macro indicators, news keywords, research sources, and score weights to each theme.",
            "Calculate daily explainable Theme Scores.",
            "Show score components such as Technical, Macro, News, Earnings, and Valuation.",
            "Explain why a theme is bullish, neutral, bearish, or watchlist-only.",
        ],
        [
            "`themes`, `theme_tickers`, `theme_indicators`, `theme_sources`.",
            "`theme_scores`, `theme_score_components`, `theme_events`, `theme_daily_snapshots`.",
        ],
        "The system can answer which themes are improving, what changed, which holdings are exposed, and why a score moved.",
    )

    story.append(p("After Phase 7", s["h1"]))
    story.append(
        make_table(
            [
                ["Next Phase", "Purpose"],
                ["Phase 8: LINE Alert", "Notify about technical breaks, major news, RSI extremes, EMA200 breakdowns, and theme score changes."],
                ["Phase 9: Backtest", "Test strategies using prices, technical indicators, news, sentiment, and theme data."],
                ["Phase 10: Paper Trading", "Run simulated trades without real money."],
                ["Phase 11: Bot Trading", "Only after risk limits, manual approval, kill switch, audit logs, and broker safety are designed."],
            ],
            [50 * mm, 122 * mm],
            s,
        )
    )
    story.append(Spacer(1, 8))
    story.append(p("<b>Current project status:</b> late Phase 1, ready to begin Phase 2.", s["body"]))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build()

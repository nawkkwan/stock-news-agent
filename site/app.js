const DATA_URL = "/data/latest-report.json";

function text(value, fallback = "-") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function setText(id, value) {
  document.getElementById(id).textContent = text(value);
}

function createCell(content) {
  const cell = document.createElement("td");
  cell.textContent = text(content);
  return cell;
}

function renderImpactTable(stocks) {
  const body = document.getElementById("impactRows");
  body.innerHTML = "";

  stocks.forEach((stock) => {
    const row = document.createElement("tr");
    const ticker = createCell(stock.ticker);
    ticker.className = "ticker";
    row.append(
      ticker,
      createCell(stock.company),
      createCell(stock.key_takeaway || stock.key_news),
      createCell(stock.possible_impact || stock.impact),
      createCell(stock.valuation_context),
      createCell(stock.confidence)
    );
    body.appendChild(row);
  });
}

function renderStockCards(stocks) {
  const grid = document.getElementById("stockCards");
  grid.innerHTML = "";

  stocks.forEach((stock) => {
    const card = document.createElement("article");
    card.className = "stock-card";

    const header = document.createElement("div");
    header.className = "stock-card-head";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = stock.ticker;
    const company = document.createElement("p");
    company.textContent = stock.company;
    titleWrap.append(title, company);
    const close = document.createElement("strong");
    close.textContent = text(stock.technical?.last_close);
    header.append(titleWrap, close);

    const impact = document.createElement("p");
    impact.className = "takeaway";
    impact.textContent = stock.key_takeaway || stock.key_news;

    const metrics = document.createElement("div");
    metrics.className = "metric-grid";
    metrics.innerHTML = `
      <div><span>Trend</span><strong>${text(stock.technical?.trend)}</strong></div>
      <div><span>RSI</span><strong>${text(stock.technical?.rsi14)}</strong></div>
      <div><span>EMA50</span><strong>${text(stock.technical?.ema50)}</strong></div>
      <div><span>EMA200</span><strong>${text(stock.technical?.ema200)}</strong></div>
      <div><span>Support</span><strong>${text((stock.technical?.support_zones || []).slice(0, 2).join(", "))}</strong></div>
      <div><span>Resistance</span><strong>${text((stock.technical?.resistance_zones || []).slice(0, 2).join(", "))}</strong></div>
    `;

    const tags = document.createElement("div");
    tags.className = "tag-row";
    (stock.alert_tags || []).forEach((tag) => {
      const badge = document.createElement("span");
      badge.textContent = tag;
      tags.appendChild(badge);
    });

    const quick = document.createElement("div");
    quick.className = "quick-row";
    quick.innerHTML = `
      <span>Risk: ${text(stock.risk_level)}</span>
      <span>Relevance: ${text(stock.relevance_score)}</span>
      <span>Confidence: ${text(stock.confidence)}</span>
    `;

    const details = document.createElement("details");
    details.className = "card-details";
    const summary = document.createElement("summary");
    summary.textContent = "Details";
    const possibleImpact = document.createElement("p");
    possibleImpact.innerHTML = `<strong>Possible impact:</strong> ${text(stock.possible_impact || stock.impact)}`;
    const valuation = document.createElement("p");
    valuation.innerHTML = `<strong>Valuation context:</strong> ${text(stock.valuation_context)}`;

    const relevance = document.createElement("p");
    relevance.innerHTML = `<strong>Relevance:</strong> ${text(stock.relevance_reason, "No relevance reason generated.")}`;

    const technicalNote = document.createElement("p");
    technicalNote.innerHTML = `<strong>Technical note:</strong> ${text(stock.technical_summary || stock.technical?.technical_note, "No technical context generated.")}`;

    const monitor = document.createElement("p");
    monitor.innerHTML = `<strong>Monitor next:</strong> ${text(stock.what_to_monitor)}`;

    const points = document.createElement("div");
    points.className = "points-grid";
    points.append(
      createPointList("Good points", stock.bullish_points || []),
      createPointList("Bad points", stock.bearish_points || [])
    );

    const sources = document.createElement("ul");
    sources.className = "source-list compact-sources";

    const articles = stock.articles || [];
    if (articles.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No source links available.";
      sources.appendChild(item);
    } else {
      articles.slice(0, 4).forEach((article) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = article.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = article.title || "Untitled source";
        item.appendChild(link);
        sources.appendChild(item);
      });
    }

    details.append(summary, possibleImpact, valuation, technicalNote, relevance, points, monitor, sources);
    card.append(header, quick, metrics, tags, impact, details);
    grid.appendChild(card);
  });
}

function renderTextList(id, items) {
  const list = document.getElementById(id);
  list.innerHTML = "";
  const values = items && items.length ? items : ["No clear signal from today's sources."];
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.appendChild(item);
  });
}

function renderReadMore(items) {
  const grid = document.getElementById("readMoreList");
  grid.innerHTML = "";
  const values = items && items.length ? items : [];

  if (values.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No priority sources selected.";
    grid.appendChild(empty);
    return;
  }

  values.forEach((item) => {
    const card = document.createElement("article");
    card.className = "read-more-card";
    const ticker = document.createElement("span");
    ticker.className = "read-more-ticker";
    ticker.textContent = item.ticker || "Source";

    const link = document.createElement("a");
    link.href = item.url || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.title || "Untitled source";

    const source = document.createElement("p");
    source.textContent = item.source || "";

    const why = document.createElement("p");
    why.textContent = item.why_read || "Worth opening for more context.";

    card.append(ticker, link, source, why);
    grid.appendChild(card);
  });
}

function createPointList(title, points) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const list = document.createElement("ul");
  list.className = "point-list";

  if (points.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No clear signal from today's sources.";
    list.appendChild(item);
  } else {
    points.forEach((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      list.appendChild(item);
    });
  }

  wrapper.append(heading, list);
  return wrapper;
}

function renderNotes(report) {
  const notes = document.getElementById("notes");
  notes.innerHTML = "";
  const items = [
    "This is a news summary, not financial advice.",
    "The report gives decision support, but it does not recommend buying, selling, or trading.",
    "Use NotebookLM only when you want to explore a report more deeply.",
  ];

  const riskAlerts = report.summary?.risk_alerts || [];
  riskAlerts.forEach((alert) => items.push(alert));

  const errors = report.summary?.errors || [];
  if (errors.length > 0) {
    items.push(`${errors.length} fetch note(s) were recorded. Check the Markdown report for details.`);
  }

  items.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    notes.appendChild(item);
  });
}

async function main() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL}`);
  }
  const report = await response.json();

  setText("reportDate", report.date);
  setText("stockCount", report.summary?.stock_count);
  setText("articleCount", report.summary?.total_articles);
  setText("status", report.status);
  setText("generatedAt", `Generated ${report.generated_at}`);
  setText("dailyBriefing", report.summary?.daily_briefing || report.summary?.portfolio_summary || "No briefing generated.");
  setText("portfolioSummary", report.summary?.portfolio_summary || report.summary?.mode);
  setText("macroOverview", report.summary?.macro_overview || "No macro overview generated.");
  renderTextList("crossThemes", report.summary?.cross_portfolio_themes || []);
  renderTextList("marketContext", report.summary?.market_context || []);
  renderReadMore(report.summary?.read_more || []);

  const googleDocLink = document.getElementById("googleDocLink");
  if (report.google_doc_url) {
    googleDocLink.href = report.google_doc_url;
    googleDocLink.classList.remove("disabled");
  } else {
    googleDocLink.href = "#";
  }

  document.getElementById("notebookLink").href = report.notebooklm_url || "https://notebooklm.google.com/";
  document.getElementById("copyReport").addEventListener("click", async () => {
    await navigator.clipboard.writeText(report.markdown_report || "");
    document.getElementById("copyReport").textContent = "Copied";
    window.setTimeout(() => {
      document.getElementById("copyReport").textContent = "Copy report";
    }, 1600);
  });

  renderImpactTable(report.stocks || []);
  renderStockCards(report.stocks || []);
  renderNotes(report);
}

main().catch((error) => {
  setText("reportDate", "Could not load report");
  document.getElementById("notes").innerHTML = `<li>${error.message}</li>`;
});

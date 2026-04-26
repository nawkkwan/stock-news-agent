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
      createCell(stock.key_news),
      createCell(stock.impact),
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

    const title = document.createElement("h3");
    title.textContent = `${stock.ticker} - ${stock.company}`;

    const impact = document.createElement("p");
    impact.textContent = stock.impact;

    const sources = document.createElement("ul");
    sources.className = "source-list";

    const articles = stock.articles || [];
    if (articles.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No source links available.";
      sources.appendChild(item);
    } else {
      articles.forEach((article) => {
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

    card.append(title, impact, sources);
    grid.appendChild(card);
  });
}

function renderNotes(report) {
  const notes = document.getElementById("notes");
  notes.innerHTML = "";
  const items = [
    "This is a news summary, not financial advice.",
    "The report does not recommend buying, selling, or trading.",
    "Use NotebookLM only when you want to explore a report more deeply.",
  ];

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

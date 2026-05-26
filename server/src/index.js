import "dotenv/config";

import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import journalRouter from "./routes/journal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const siteDir = path.join(rootDir, "site");
const app = express();
const port = Number(process.env.PORT || 4174);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/journal", journalRouter);
app.use(express.static(siteDir));

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Stock News Agent server running at http://127.0.0.1:${port}`);
});

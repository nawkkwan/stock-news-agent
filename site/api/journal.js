import { requireAdminToken } from "./_auth.js";
import { getDb, hasMongoConfig } from "./_db.js";
import { validateJournalInput } from "./_journal-validation.js";

function serializeEntry(entry) {
  const { _id, ...rest } = entry;
  return {
    ...rest,
    id: _id.toString(),
  };
}

function parseLimit(value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return 50;
  }
  return Math.min(limit, 200);
}

async function listEntries(req, res) {
  if (!hasMongoConfig()) {
    res.status(200).json({ entries: [], configured: false });
    return;
  }

  const db = await getDb();
  const query = {};
  if (req.query.ticker) {
    query.ticker = String(req.query.ticker).trim().toUpperCase();
  }
  if (req.query.date) {
    query.date = String(req.query.date).trim();
  }

  const entries = await db
    .collection("journal_entries")
    .find(query)
    .sort({ date: -1, created_at: -1 })
    .limit(parseLimit(req.query.limit))
    .toArray();

  res.status(200).json({ entries: entries.map(serializeEntry), configured: true });
}

async function createEntry(req, res) {
  if (!requireAdminToken(req, res)) {
    return;
  }
  if (!hasMongoConfig()) {
    res.status(503).json({ error: "MONGODB_URI is not configured" });
    return;
  }

  const validation = validateJournalInput(req.body);
  if (!validation.ok) {
    res.status(400).json({ errors: validation.errors });
    return;
  }

  const now = new Date();
  const entry = {
    ...validation.value,
    created_at: now,
    updated_at: now,
  };
  const db = await getDb();
  const result = await db.collection("journal_entries").insertOne(entry);
  res.status(201).json({ entry: serializeEntry({ ...entry, _id: result.insertedId }) });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      await listEntries(req, res);
      return;
    }
    if (req.method === "POST") {
      await createEntry(req, res);
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}

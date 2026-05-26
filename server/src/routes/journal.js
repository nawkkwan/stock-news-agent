import express from "express";

import { requireAdminToken } from "../auth.js";
import { getDb, ObjectId } from "../db.js";
import { validateJournalInput } from "../journal-validation.js";

const router = express.Router();

function serializeEntry(entry) {
  return {
    ...entry,
    id: entry._id.toString(),
    _id: undefined,
  };
}

function parseLimit(value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return 50;
  }
  return Math.min(limit, 200);
}

router.get("/", async (req, res, next) => {
  try {
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

    res.json({ entries: entries.map(serializeEntry) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdminToken, async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdminToken, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }

    const validation = validateJournalInput(req.body);
    if (!validation.ok) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    const db = await getDb();
    const result = await db.collection("journal_entries").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...validation.value, updated_at: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }

    res.json({ entry: serializeEntry(result) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdminToken, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }

    const db = await getDb();
    const result = await db.collection("journal_entries").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

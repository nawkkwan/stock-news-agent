import { requireAdminToken } from "../_auth.js";
import { getDb, hasMongoConfig, ObjectId } from "../_db.js";
import { validateJournalInput } from "../_journal-validation.js";

function serializeEntry(entry) {
  const { _id, ...rest } = entry;
  return {
    ...rest,
    id: _id.toString(),
  };
}

function getId(req) {
  return Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
}

async function updateEntry(req, res) {
  if (!requireAdminToken(req, res)) {
    return;
  }
  if (!hasMongoConfig()) {
    res.status(503).json({ error: "MONGODB_URI is not configured" });
    return;
  }

  const id = getId(req);
  if (!ObjectId.isValid(id)) {
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
    { _id: new ObjectId(id) },
    { $set: { ...validation.value, updated_at: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  res.status(200).json({ entry: serializeEntry(result) });
}

async function deleteEntry(req, res) {
  if (!requireAdminToken(req, res)) {
    return;
  }
  if (!hasMongoConfig()) {
    res.status(503).json({ error: "MONGODB_URI is not configured" });
    return;
  }

  const id = getId(req);
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  const db = await getDb();
  const result = await db.collection("journal_entries").deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  res.status(204).end();
}

export default async function handler(req, res) {
  try {
    if (req.method === "PATCH") {
      await updateEntry(req, res);
      return;
    }
    if (req.method === "DELETE") {
      await deleteEntry(req, res);
      return;
    }

    res.setHeader("Allow", "PATCH, DELETE");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}

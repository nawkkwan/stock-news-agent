import { MongoClient, ObjectId } from "mongodb";

let clientPromise;

export { ObjectId };

export function hasMongoConfig() {
  return Boolean(process.env.MONGODB_URI);
}

export async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB || "stock_news_agent");
  await db.collection("journal_entries").createIndex({ date: -1, ticker: 1 });
  return db;
}

import { MongoClient, ObjectId } from "mongodb";

let client;
let database;

export { ObjectId };

export async function getDb() {
  if (database) {
    return database;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  client = new MongoClient(uri);
  await client.connect();
  database = client.db(process.env.MONGODB_DB || "stock_news_agent");
  await database.collection("journal_entries").createIndex({ date: -1, ticker: 1 });
  return database;
}

export async function closeDb() {
  if (client) {
    await client.close();
  }
  client = null;
  database = null;
}

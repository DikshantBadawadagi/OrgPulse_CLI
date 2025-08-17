import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error("MONGO_URI is not defined in .env");
}

let client;
let db;

export async function connectDB() {
  if (db) return db; // reuse existing connection

  client = new MongoClient(uri);
  await client.connect();

  db = client.db(); // uses DB from URI
  console.log("✅ Connected to MongoDB Atlas");
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    console.log("🛑 MongoDB connection closed");
  }
}

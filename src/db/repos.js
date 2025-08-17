import { connectDB } from "./connection.js";

const REPO_COLLECTION = "repos";

export async function createRepoIndexes() {
  const db = await connectDB();
  const collection = db.collection(REPO_COLLECTION);

  // Unique key on org + name for upserts
  await collection.createIndex({ org: 1, name: 1 }, { unique: true });

  // Index for top queries
  await collection.createIndex({ org: 1, stars: -1 });

  console.log("✅ Repo indexes created");
}

// Upsert a repo
export async function upsertRepo(repoData) {
  const db = await connectDB();
  const collection = db.collection(REPO_COLLECTION);

  const { org, name } = repoData;

  await collection.updateOne(
    { org, name },           // filter
    { $set: repoData },      // update
    { upsert: true }         // insert if not exists
  );
}

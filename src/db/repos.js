import { connectDB } from "./connection.js";

const REPO_COLLECTION = "repos";

export async function createRepoIndexes() {
  const db = await connectDB();
  const collection = db.collection(REPO_COLLECTION);

  await collection.createIndex({ org: 1, name: 1 }, { unique: true });

  await collection.createIndex({ org: 1, stars: -1 });

  console.log("✅ Repo indexes created");
}

export async function upsertRepo(repoData) {
  const db = await connectDB();
  const collection = db.collection(REPO_COLLECTION);

  const { org, name } = repoData;

  await collection.updateOne(
    { org, name },           
    { $set: repoData },     
    { upsert: true }       
  );
}

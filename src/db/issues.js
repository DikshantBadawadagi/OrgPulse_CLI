import { connectDB } from "./connection.js";

const ISSUE_COLLECTION = "issues";

export async function createIssueIndexes() {
  const db = await connectDB();
  const collection = db.collection(ISSUE_COLLECTION);

  await collection.createIndex({ repo: 1, number: 1 }, { unique: true });

  await collection.createIndex({ repo: 1, state: 1 });

  console.log("Issue indexes created");
}

export async function upsertIssue(issueData) {
  const db = await connectDB();
  const collection = db.collection(ISSUE_COLLECTION);

  const { repo, number } = issueData;

  await collection.updateOne(
    { repo, number },
    { $set: issueData },
    { upsert: true }
  );
}

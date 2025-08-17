import { connectDB } from "../db/connection.js";
import { createObjectCsvWriter } from "csv-writer";

const REPO_COLLECTION = "repos";

/**
 * Export repos for an org to CSV
 * @param {string} org - organization name
 * @param {string} outFile - output file path
 */
export async function exportReposCSV(org, outFile) {
  const db = await connectDB();
  const collection = db.collection(REPO_COLLECTION);

  const repos = await collection.find({ org }).toArray();

  if (!repos.length) {
    console.log(`No repos found for org "${org}"`);
    return;
  }

  const csvWriter = createObjectCsvWriter({
    path: outFile,
    header: [
      { id: "name", title: "name" },
      { id: "stars", title: "stars" },
      { id: "forks", title: "forks" },
      { id: "openIssues", title: "openIssues" },
      { id: "pushedAt", title: "pushedAt" },
      { id: "language", title: "language" },
    ],
  });

  await csvWriter.writeRecords(repos);

  console.log(`✅ CSV exported to ${outFile}`);
}

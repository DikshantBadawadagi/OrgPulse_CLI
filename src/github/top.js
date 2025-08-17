import { connectDB } from "../db/connection.js";
import Table from "cli-table3";
import { MongoClient } from "mongodb";

const REPO_COLLECTION = "repos";

/**
 * @param {string} org 
 * @param {string} metric 
 * @param {number} limit 
 */
export async function showTopRepos(org, metric = "stars", limit = 10) {
  const db = await connectDB();
  const collection = db.collection(REPO_COLLECTION);

  let sortField;
  if (metric === "stars") sortField = { stars: -1 };
  else if (metric === "issues") sortField = { openIssues: -1 };
  else {
    console.warn(`Unknown metric "${metric}", defaulting to stars`);
    sortField = { stars: -1 };
  }

  const repos = await collection
    .find({ org })
    .sort(sortField)
    .limit(Number(limit))
    .toArray();

  if (!repos.length) {
    console.log(`No repos found for org "${org}"`);
    return;
  }

  // Build table
  const table = new Table({
    head: ["Name", "Stars", "Forks", "Open Issues", "Language", "Pushed At"],
  });

  repos.forEach((r) => {
    table.push([
      r.name,
      r.stars,
      r.forks,
      r.openIssues,
      r.language || "-",
      r.pushedAt ? new Date(r.pushedAt).toISOString().split("T")[0] : "-",
    ]);
  });

  console.log(table.toString());
}

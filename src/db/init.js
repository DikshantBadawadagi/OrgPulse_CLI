#!/usr/bin/env node
import { createRepoIndexes } from "./repos.js";
import { createIssueIndexes } from "./issues.js";

async function initDB() {
  await createRepoIndexes();
  await createIssueIndexes();
  console.log("✅ All indexes initialized");
  process.exit(0);
}

initDB();

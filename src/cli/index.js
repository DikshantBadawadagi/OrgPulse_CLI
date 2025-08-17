import { Command } from "commander";
import dotenv from "dotenv";

import { createRepoIndexes } from "../db/repos.js";
import { createIssueIndexes } from "../db/issues.js";
import { connectDB, closeDB } from "../db/connection.js";

import { fetchOrgData } from "../github/fetcher.js";
import { showTopRepos } from "../github/top.js";
import { exportReposCSV } from "../utils/csv.js";
import { syncStars } from "../github/syncStars.js";

dotenv.config();

const program = new Command();

program
  .name("orgpulse")
  .description("CLI to fetch GitHub data and store in MongoDB")
  .version("0.1.0");

// ---------- INIT ----------
program
  .command("init")
  .description("Connect to MongoDB and create indexes")
  .action(async () => {
    try {
      await connectDB();
      await createRepoIndexes();
      await createIssueIndexes();
      console.log("✅ Indexes ready");
    } catch (err) {
      console.error("❌ Init failed:", err.message);
    } finally {
      await closeDB();
    }
  });

program
  .command("fetch <org>")
  .description("Fetch public repos + issues for <org>")
  .option("--since <date>", "Only repos pushed since YYYY-MM-DD")
  .action(async (org, options) => {
    try {
      await connectDB();
      await fetchOrgData(org, options.since);
      console.log(`✅ Fetch completed for org: ${org}`);
    } catch (err) {
      console.error("❌ Fetch failed:", err.message);
    } finally {
      await closeDB();
    }
  });

program
  .command("top")
  .description("Show top repos")
  .requiredOption("--org <org>", "Organization name")
  .option("--metric <metric>", "stars or issues", "stars")
  .option("--limit <number>", "Number of repos", 10)
  .action(async (options) => {
    try {
      await connectDB();
      await showTopRepos(options.org, options.metric, options.limit);
    } catch (err) {
      console.error("❌ Top command failed:", err.message);
    } finally {
      await closeDB();
    }
  });

// program
//   .command("export")
//   .description("Export repos to CSV")
//   .requiredOption("--org <org>", "Organization name")
//   .requiredOption("--out <file>", "Output CSV file")
//   .action(async (options) => {
//     try {
//       await connectDB();
//       await exportReposCSV(options.org, options.out);
//       console.log(`✅ Repos exported to ${options.out}`);
//     } catch (err) {
//       console.error("❌ Export failed:", err.message);
//     } finally {
//       await closeDB();
//     }
//   });

// program
//   .command("sync-stars")
//   .description("Refresh stars/forks for existing repos")
//   .requiredOption("--org <org>", "Organization name")
//   .action(async (options) => {
//     try {
//       await connectDB();
//       await syncStars(options.org);
//       console.log(`✅ Stars/forks synced for ${options.org}`);
//     } catch (err) {
//       console.error("❌ Sync-stars failed:", err.message);
//     } finally {
//       await closeDB();
//     }
//   });

program.parse();

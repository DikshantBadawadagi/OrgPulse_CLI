import fs from "fs";
import path from "path";
import axios from "axios";

import { upsertRepo } from "../db/repos.js";
import { upsertIssue } from "../db/issues.js";

// Path to checkpoint file
const CHECKPOINT_FILE = path.join(process.cwd(), "checkpoint.json");

// Load checkpoint if exists
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
  }
  return {};
}

// Save checkpoint
function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// GitHub axios instance
function getGithubClient() {
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }
  return axios.create({
    baseURL: "https://api.github.com",
    headers,
  });
}

// Helper to fetch paginated data from GitHub
async function fetchPaginated(client, url, perPage = 100) {
  let results = [];
  let page = 1;

  while (true) {
    const res = await client.get(url, {
      params: { per_page: perPage, page },
    });
    results = results.concat(res.data);

    const link = res.headers.link || "";
    if (!link.includes('rel="next"')) break;

    page++;
  }

  return results;
}

// Main function: fetch org repos + issues
export async function fetchOrgData(org, since) {
  const checkpoint = loadCheckpoint();
  const client = getGithubClient();

  console.log(`Fetching repos for org: ${org}...`);

  const repos = await fetchPaginated(client, `/orgs/${org}/repos`);

  for (const repo of repos) {
    // Filter by pushed_at if --since is provided
    if (since && new Date(repo.pushed_at) < new Date(since)) continue;

    const repoData = {
      org,
      name: repo.name,
      description: repo.description,
      topics: repo.topics || [],
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      license: repo.license ? repo.license.spdx_id : null,
      pushedAt: repo.pushed_at,
    };

    await upsertRepo(repoData);

    // Save checkpoint after each repo
    checkpoint[repo.full_name] = { repoFetched: true };
    saveCheckpoint(checkpoint);

    // Fetch latest 30 issues for the repo
    console.log(`Fetching issues for repo: ${repo.full_name}...`);
    const issues = await fetchPaginated(
      client,
      `/repos/${org}/${repo.name}/issues`,
      100
    );

    // Only take latest 30
    for (const issue of issues.slice(0, 30)) {
      // Skip PRs
      if (issue.pull_request) continue;

      const issueData = {
        repo: `${org}/${repo.name}`,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        createdAt: issue.created_at,
      };

      await upsertIssue(issueData);
    }
  }

  console.log("✅ All repos + issues fetched and stored.");
}

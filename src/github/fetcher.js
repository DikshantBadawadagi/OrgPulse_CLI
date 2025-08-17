// import fs from "fs";
// import path from "path";
// import axios from "axios";

// import { upsertRepo } from "../db/repos.js";
// import { upsertIssue } from "../db/issues.js";

// const CHECKPOINT_FILE = path.join(process.cwd(), "checkpoint.json");

// function loadCheckpoint() {
//   if (fs.existsSync(CHECKPOINT_FILE)) {
//     return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
//   }
//   return {};
// }

// function saveCheckpoint(data) {
//   fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
// }

// function getGithubClient() {
//   const headers = {};
//   if (process.env.GITHUB_TOKEN) {
//     headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
//   }
//   return axios.create({
//     baseURL: "https://api.github.com",
//     headers,
//   });
// }

// async function fetchPaginated(client, url, perPage = 100) {
//   let results = [];
//   let page = 1;

//   while (true) {
//     const res = await client.get(url, {
//       params: { per_page: perPage, page },
//     });
//     results = results.concat(res.data);

//     const link = res.headers.link || "";
//     if (!link.includes('rel="next"')) break;

//     page++;
//   }

//   return results;
// }

// export async function fetchOrgData(org, since) {
//   const checkpoint = loadCheckpoint();
//   const client = getGithubClient();

//   console.log(`Fetching repos for org: ${org}...`);

//   const repos = await fetchPaginated(client, `/orgs/${org}/repos`);

//   for (const repo of repos) {
//     if (since && new Date(repo.pushed_at) < new Date(since)) continue;

//     const repoData = {
//       org,
//       name: repo.name,
//       description: repo.description,
//       topics: repo.topics || [],
//       language: repo.language,
//       stars: repo.stargazers_count,
//       forks: repo.forks_count,
//       openIssues: repo.open_issues_count,
//       license: repo.license ? repo.license.spdx_id : null,
//       pushedAt: repo.pushed_at,
//     };

//     await upsertRepo(repoData);

//     checkpoint[repo.full_name] = { repoFetched: true };
//     saveCheckpoint(checkpoint);

//     console.log(`Fetching issues for repo: ${repo.full_name}...`);
//     const issues = await fetchPaginated(
//       client,
//       `/repos/${org}/${repo.name}/issues`,
//       100
//     );

//     for (const issue of issues.slice(0, 30)) {
//       if (issue.pull_request) continue;

//       const issueData = {
//         repo: `${org}/${repo.name}`,
//         number: issue.number,
//         title: issue.title,
//         state: issue.state,
//         createdAt: issue.created_at,
//       };

//       await upsertIssue(issueData);
//     }
//   }

//   console.log("✅ All repos + issues fetched and stored.");
// }

import fs from "fs";
import path from "path";
import axios from "axios";
import { upsertRepo } from "../db/repos.js";
import { upsertIssue } from "../db/issues.js";
import Redis from "ioredis";

let redis;
// Avoid connecting to Redis during tests to prevent noise and listener leaks
if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
  redis = new Redis(process.env.REDIS_URL);
  redis.on("connect", () => console.log("✅ Connected to Redis"));
  redis.on("error", (err) => console.warn("⚠️ Redis connection error:", err.message));
}

async function getCache(key) {
  if (!redis) return null;
  return await redis.get(key);
}

async function setCache(key, value, ttlSeconds = 3600) {
  if (!redis) return;
  await redis.set(key, value, "EX", ttlSeconds);
}

const CHECKPOINT_FILE = path.join(process.cwd(), "checkpoint.json");

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
  }
  return {};
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function getGithubClient() {
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }
  return axios.create({ baseURL: "https://api.github.com", headers });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleGithubError(err, attempt = 1) {
  const maxAttempts = 3;
  const resp = err.response;

  if (resp && (resp.status === 403 || resp.status === 429)) {
    const reset = resp.headers["x-ratelimit-reset"];
    const remaining = resp.headers["x-ratelimit-remaining"];
    if (remaining === "0" && reset) {
      const now = Math.floor(Date.now() / 1000);
      const wait = (parseInt(reset) - now + 1) * 1000;
      console.log(`⚠️ Rate limit reached. Sleeping for ${Math.ceil(wait / 1000)}s...`);
      await sleep(wait);
      return true; 
    }
  }

  if (attempt < maxAttempts) {
    const backoff = Math.pow(3, attempt - 1) * 1000;
    console.log(`⚠️ Request failed, retrying in ${backoff / 1000}s (attempt ${attempt})`);
    await sleep(backoff);
    return true; 
  }

  console.error("❌ Request failed after retries:", err.message);
  return false; 
}

async function cachedGet(client, url, params = {}) {
  const cacheKey = `${url}?${new URLSearchParams(params).toString()}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const res = await client.get(url, { params });
  await setCache(cacheKey, JSON.stringify(res.data));
  return res.data;
}

async function fetchPaginated(client, url, perPage = 100, checkpointKey = null, startPage = 1, onPage = null) {
  let page = startPage;

  while (true) {
    let success = false;
    let attempt = 1;

    while (!success) {
      try {
        const data = await cachedGet(client, url, { per_page: perPage, page });

        if (onPage) await onPage(data, page);

        if (checkpointKey) {
          const checkpoint = loadCheckpoint();
          checkpoint[checkpointKey] = { lastPage: page };
          saveCheckpoint(checkpoint);
        }

        if (data.length < perPage) return;

        page++;
        success = true;
      } catch (err) {
        const retry = await handleGithubError(err, attempt);
        if (!retry) throw err;
        attempt++;
      }
    }
  }
}

export async function fetchOrgData(org, since) {
  const checkpoint = loadCheckpoint();
  const client = getGithubClient();

  console.log(`Fetching repos for org: ${org}...`);
  const lastRepoPage = checkpoint["_repoPage"] || 1;

  await fetchPaginated(
    client,
    `/orgs/${org}/repos`,
    100,
    "_repoPage",
    lastRepoPage,
    async (reposPage) => {
      for (const repo of reposPage) {
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

        const checkpointKey = repo.full_name;
        const lastIssuesPage = (checkpoint[checkpointKey] && checkpoint[checkpointKey].lastPage) || 1;

        console.log(`Fetching issues for repo: ${repo.full_name}...`);

        await fetchPaginated(
          client,
          `/repos/${org}/${repo.name}/issues`,
          100,
          checkpointKey,
          lastIssuesPage,
          async (issuesPage) => {
            for (const issue of issuesPage.slice(0, 30)) {
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
        );

        checkpoint[checkpointKey] = { repoFetched: true };
        saveCheckpoint(checkpoint);
      }
    }
  );

  console.log("All repos + issues fetched and stored.");
}


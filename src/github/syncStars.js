import axios from "axios";
import { connectDB } from "../db/connection.js";
import { upsertRepo } from "../db/repos.js";


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

/**
 * @param {string} org 
 */
export async function syncStars(org) {
  const db = await connectDB();
  const collection = db.collection("repos");

  const repos = await collection.find({ org }).toArray();
  if (!repos.length) {
    console.log(`No repos found for org "${org}"`);
    return;
  }

  const client = getGithubClient();

  console.log(`Refreshing stars/forks for ${repos.length} repos...`);

  for (const repo of repos) {
    try {
      const res = await client.get(`/repos/${org}/${repo.name}`);
      const data = res.data;

      const updated = {
        org,
        name: repo.name,
        stars: data.stargazers_count,
        forks: data.forks_count,
      };

      await upsertRepo(updated);
      console.log(`Updated ${repo.name}: Stars: ${data.stargazers_count}, Forks: ${data.forks_count}`);
    } catch (err) {
      console.error(`Failed to update ${repo.name}: ${err.message}`);
    }
  }

  console.log("Stars/forks sync completed.");
}

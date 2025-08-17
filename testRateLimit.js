import pLimit from "p-limit";
import { fetchOrgData } from "./src/github/fetcher.js";

const limit = pLimit(5); // max 5 concurrent requests

async function spamFetch() {
  const org = "expressjs";
  const tasks = [];

  for (let i = 0; i < 1000; i++) {
    tasks.push(limit(() => fetchOrgData(org)));
  }

  await Promise.allSettled(tasks);
  console.log("Done");
}

spamFetch();

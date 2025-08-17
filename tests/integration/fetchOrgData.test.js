import nock from "nock";
import { MongoMemoryServer } from "mongodb-memory-server";
import { jest } from '@jest/globals';
import { MongoClient } from "mongodb";
import { fetchOrgData } from "../../src/github/fetcher.js";
import { upsertRepo } from "../../src/db/repos.js";
import { upsertIssue } from "../../src/db/issues.js";
import { connectDB } from "../../src/db/connection.js";

let mongoServer;
let db;
let skipIntegration = false;

beforeAll(
  async () => {
    // Allow extra time for mongodb-memory-server to prepare binaries on CI/network-limited machines
    try {
      mongoServer = await MongoMemoryServer.create({
        binary: { version: "6.0.7" },
      });
    } catch (err) {
      console.warn("⚠️ mongodb-memory-server failed to start, skipping this integration test:", err.message);
      skipIntegration = true;
      return;
    }

    const uri = mongoServer.getUri();

    // Make the in-memory server available to code that uses process.env.MONGO_URI
    process.env.MONGO_URI = uri;
    process.env.MONGODB_URI = uri;

    db = await MongoClient.connect(uri);
  },
  300000
);

afterAll(async () => {
  if (db && typeof db.close === 'function') await db.close();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  if (skipIntegration) return;

  if (db) {
    const reposCollection = db.db().collection("repos");
    const issuesCollection = db.db().collection("issues");

    await reposCollection.deleteMany({});
    await issuesCollection.deleteMany({});
  }
  nock.cleanAll();
});

describe("fetchOrgData integration", () => {
  it(
    "handles 2 pages of repos and upserts issues correctly",
    async () => {
      if (skipIntegration) {
        console.warn('⚠️ Skipping fetchOrgData integration test due to mongodb-memory-server startup failure');
        return;
      }
      const org = "testorg";

      nock("https://api.github.com")
        .get(`/orgs/${org}/repos`)
        .query({ per_page: 100, page: 1 })
        .reply(
          200,
          [
            {
              name: "repo1",
              owner: { login: org },
              stargazers_count: 10,
              forks_count: 1,
              open_issues_count: 1,
              pushed_at: "2025-08-17T10:00:00Z",
            },
          ],
          { link: `<https://api.github.com/orgs/${org}/repos?page=2>; rel="next"` }
        );

      nock("https://api.github.com")
        .get(`/orgs/${org}/repos`)
        .query({ per_page: 100, page: 2 })
        .reply(200, [
          {
            name: "repo2",
            owner: { login: org },
            stargazers_count: 5,
            forks_count: 0,
            open_issues_count: 0,
            pushed_at: "2025-08-16T10:00:00Z",
          },
        ]);

      nock("https://api.github.com")
        .get(`/repos/${org}/repo1/issues`)
        .query({ per_page: 100, page: 1 })
        .reply(200, [
          { number: 1, title: "Issue 1", state: "open", created_at: "2025-08-17T11:00:00Z" },
        ]);

      nock("https://api.github.com")
        .get(`/repos/${org}/repo2/issues`)
        .query({ per_page: 100, page: 1 })
        .reply(200, []);

      await fetchOrgData(org);

      const reposCollection = db.db().collection("repos");
      const issuesCollection = db.db().collection("issues");

      const repos = await reposCollection.find({}).toArray();
      const issues = await issuesCollection.find({}).toArray();

      expect(repos.length).toBe(2);
      expect(issues.length).toBe(1);

      const topRepo = repos.sort((a, b) => b.stars - a.stars)[0];
      expect(topRepo.name).toBe("repo1");
    },
    30000 
  );
});

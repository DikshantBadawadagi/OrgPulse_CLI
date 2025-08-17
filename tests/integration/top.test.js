import { connectDB } from "../../src/db/connection.js";
import { upsertRepo } from "../../src/db/repos.js";

describe("Top command", () => {
  let db;
  let reposCollection;

  beforeAll(async () => {
    db = await connectDB();
    reposCollection = db.collection("repos");
  });

  beforeEach(async () => {
    await reposCollection.deleteMany({});

    await upsertRepo({ org: "testorg", name: "a", stars: 5, openIssues: 1 });
    await upsertRepo({ org: "testorg", name: "b", stars: 10, openIssues: 3 });
    await upsertRepo({ org: "testorg", name: "c", stars: 7, openIssues: 0 });
  });

  afterEach(async () => {
    await reposCollection.deleteMany({});
  });

  it("sorts repos by stars correctly", async () => {
    const repos = await reposCollection.find({ org: "testorg" }).toArray();
    const sorted = repos.sort((a, b) => b.stars - a.stars);
    expect(sorted[0].name).toBe("b");
    expect(sorted[1].name).toBe("c");
    expect(sorted[2].name).toBe("a");
  });

  it("sorts repos by issues correctly", async () => {
    const repos = await reposCollection.find({ org: "testorg" }).toArray();
    const sorted = repos.sort((a, b) => b.openIssues - a.openIssues);
    expect(sorted[0].name).toBe("b");
    expect(sorted[1].name).toBe("a");
    expect(sorted[2].name).toBe("c");
  });
});

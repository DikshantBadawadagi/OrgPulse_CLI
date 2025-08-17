import { mapRepo } from "../../src/github/mapRepo.js";

describe("mapRepo", () => {
  it("maps GitHub API JSON correctly to repoDoc", () => {
    const apiJson = {
      name: "express",
      owner: { login: "expressjs" },
      description: "Minimal web framework",
      topics: ["nodejs", "framework"],
      language: "JavaScript",
      stargazers_count: 50000,
      forks_count: 9000,
      open_issues_count: 100,
      license: { spdx_id: "MIT" },
      pushed_at: "2025-08-17T10:00:00Z",
    };

    const expected = {
      org: "expressjs",
      name: "express",
      description: "Minimal web framework",
      topics: ["nodejs", "framework"],
      language: "JavaScript",
      stars: 50000,
      forks: 9000,
      openIssues: 100,
      license: "MIT",
      pushedAt: "2025-08-17T10:00:00Z",
    };

    expect(mapRepo(apiJson)).toEqual(expected);
  });
});

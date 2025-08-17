export function mapRepo(repo) {
  return {
    org: repo.owner.login,
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
}

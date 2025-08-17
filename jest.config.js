export default {
  testEnvironment: "node",
  verbose: true,
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.js"],
  testTimeout: 120000

};
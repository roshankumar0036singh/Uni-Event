module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx,js,jsx}",
  "!src/**/*.d.ts",
],
  coverageReporters: ["text", "lcov", "json-summary"],
};


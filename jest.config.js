module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: ["tests/**/*.{ts,js}", "!tests/**/*.d.ts"],
  coverageReporters: ["text", "lcov", "json-summary"],
};

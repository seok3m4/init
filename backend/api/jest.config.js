module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.(spec|test)\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  setupFiles: ["<rootDir>/jest.setup.js"],
  testEnvironment: "node"
};

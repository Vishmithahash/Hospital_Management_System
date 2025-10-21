module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/tests/**'],
  testTimeout: 60000,
  setupFilesAfterEnv: [],
  transform: {}
};

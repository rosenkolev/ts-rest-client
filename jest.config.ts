import type { JestConfigWithTsJest } from 'ts-jest';
import { createJsWithTsPreset } from 'ts-jest';

const CI = !!process.env.CI;

export default {
  displayName: 'typed-rest-api-client',
  ...createJsWithTsPreset({
    tsconfig: 'tsconfig.spec.json'
  }),

  modulePathIgnorePatterns: ['<rootDir>/tests/use-test-*'],

  // The test environment that will be used for testing
  testEnvironment: 'jsdom',

  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],

  maxWorkers: '8',

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // In the CI/CD server we output lcov and cobertura coverage report.
  coverageReporters: CI ? ['text-summary', 'json-summary', 'lcovonly', 'cobertura'] : ['text'],
  coverageDirectory: './reports',

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/*.d.ts'],

  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // In the CI/CD server we do not require console reporting, so just do summary, warnings and jUnit.
  reporters: CI ? [['jest-silent-reporter', { showWarnings: true }], 'summary'] : ['default']
} satisfies JestConfigWithTsJest;

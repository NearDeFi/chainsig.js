import { type Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(m?[tj]s|tsx)$': [
      'ts-jest',
      {
        tsconfig: { allowJs: true },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@chain-adapters/(.*)$': '<rootDir>/src/chain-adapters/$1',
    '^@contracts/(.*)$': '<rootDir>/src/contracts/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@constants$': '<rootDir>/src/constants.ts',
    '^@types$': '<rootDir>/src/types.ts',
    '^@chain-adapters$': '<rootDir>/src/chain-adapters/index.ts',
    '^@contracts$': '<rootDir>/src/contracts/index.ts',
    '^@utils$': '<rootDir>/src/utils/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleDirectories: ['node_modules'],
  // For ES modules compatibility
  testRunner: 'jest-circus/runner',
  transformIgnorePatterns: [
    '/node_modules/(?!(@cosmjs|bitcoinjs-lib|@scure|@noble)/)',
  ],
  workerThreads: true,
  maxWorkers: 1,
}

export default config

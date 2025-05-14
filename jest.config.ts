import { type Config } from 'jest'

// Add JSON BigInt serialization support for Jest
if (!('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function () {
      return this.toString()
    },
  })
}

const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(m?ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
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
}

export default config

import love from 'eslint-config-love'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.yarn/**',
      '.vscode/**',
      'scripts/**',
      'docs/**',
    ],
  },
  {
    ...love,
    files: ['src/**/*.ts', '__tests__/**/*.ts', '__mocks__/**/*.ts'],
  },
  prettierRecommended,
  {
    files: ['src/**/*.ts', '__tests__/**/*.ts', '__mocks__/**/*.ts'],
    rules: {
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '__tests__/**',
            '__mocks__/**',
            '**/*.test.ts',
            'eslint.config.mjs',
            'jest.config.ts',
            'tsup.config.ts',
          ],
          peerDependencies: false,
          optionalDependencies: false,
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          pathGroups: [
            { pattern: '@chain-adapters', group: 'internal' },
            { pattern: '@chain-adapters/**', group: 'internal' },
            { pattern: '@contracts', group: 'internal' },
            { pattern: '@contracts/**', group: 'internal' },
            { pattern: '@utils', group: 'internal' },
            { pattern: '@constants', group: 'internal' },
            { pattern: '@types', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ['__tests__/**/Integration.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['__tests__/**/*.test.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
]

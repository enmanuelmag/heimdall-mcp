import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

const sharedRules = {
  'simple-import-sort/imports': [
    'error',
    {
      groups: [
        ['^node:', '^@?\\w'],
        ['^@/'],
        ['^\\.'],
        ['^.*\\u0000$'],
      ],
    },
  ],
  'simple-import-sort/exports': 'error',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-unused-vars': 'off',
  '@typescript-eslint/no-namespace': 'off',
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
}

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: sharedRules,
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
)

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'header-max-length': [2, 'always', 200],
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'refactor', 'docs', 'test', 'perf', 'style', 'build', 'ci', 'revert']],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
  },
}

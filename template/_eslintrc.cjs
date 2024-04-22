'use strict';

module.exports = {
  root: true,
  extends: ['xo', require.resolve('xo/config/plugins.cjs'), 'prettier'],
  ignorePatterns: ['dist', 'coverage'],
  rules: {
    'no-console': 'error',
    'unicorn/prevent-abbreviations': 'off',
    'import/extensions': ['error', 'never', { json: 'always' }],
  },
  overrides: [
    {
      files: ['*.ts', '*.cts', '*.mts'],
      extends: ['xo-typescript', 'prettier'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
  settings: {
    'import/resolver': {
      typescript: {},
    },
  },
  globals: {
    wx: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly',
  },
};

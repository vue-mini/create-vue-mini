'use strict';

module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    es2021: true,
    node: true,
  },
  reportUnusedDisableDirectives: true,
  ignorePatterns: ['dist', 'coverage'],
  extends: ['eslint:recommended', 'prettier'],
  overrides: [
    {
      files: ['*.ts'],
      extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
  globals: {
    wx: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly',
  },
};

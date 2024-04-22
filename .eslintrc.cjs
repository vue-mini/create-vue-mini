module.exports = {
  root: true,
  extends: ['xo', require.resolve('xo/config/plugins.cjs'), 'prettier'],
  ignorePatterns: ['index.js', 'template'],
  rules: {
    'unicorn/prevent-abbreviations': 'off',
  },
  overrides: [
    {
      files: ['*.ts'],
      extends: ['xo-typescript', 'prettier'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
}

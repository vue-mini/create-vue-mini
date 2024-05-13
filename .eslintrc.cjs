module.exports = {
  root: true,
  extends: ['xo', require.resolve('xo/config/plugins.cjs'), 'prettier'],
  ignorePatterns: ['outfile.js', 'template'],
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
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
      },
    },
  ],
}

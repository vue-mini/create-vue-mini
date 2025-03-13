import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const config = [
  { ignores: ['template/', 'outfile.js'] },
  {
    files: ['**/*.js', '**/*.ts'],
    linterOptions: { reportUnusedDisableDirectives: true },
    ...eslint.configs.recommended,
  },
  { files: ['**/*.js'], ...prettier },
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    ...prettier,
  },
]

export default config

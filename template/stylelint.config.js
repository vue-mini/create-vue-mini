const config = {
  extends: 'stylelint-config-standard',
  rules: {
    'alpha-value-notation': 'number',
    'color-function-notation': 'legacy',
    'selector-type-no-unknown': [
      true,
      {
        ignoreTypes: ['page'],
      },
    ],
  },
};

export default config;

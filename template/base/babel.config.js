import fs from 'node:fs';

const runtimeVersion = JSON.parse(
  fs.readFileSync(
    new URL(import.meta.resolve('@babel/runtime/package.json')),
    'utf8',
  ),
).version;

const config = ({ env }) => ({
  targets: env('test') ? { node: 'current' } : {},
  assumptions: {
    arrayLikeIsIterable: true,
    constantReexports: true,
    constantSuper: true,
    enumerableModuleMeta: true,
    ignoreFunctionLength: true,
    ignoreToPrimitiveHint: true,
    iterableIsArray: true,
    mutableTemplateObject: true,
    noClassCalls: true,
    noDocumentAll: true,
    noNewArrows: true,
    objectRestNoSymbols: true,
    privateFieldsAsProperties: true,
    pureGetters: true,
    setClassMethods: true,
    setComputedProperties: true,
    setPublicClassFields: true,
    setSpreadProperties: true,
    skipForOfIteratorClosing: true,
    superIsCallableConstructor: true,
  },
  presets: [
    [
      '@babel/preset-env',
      {
        bugfixes: true,
        modules: 'commonjs',
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [
    [
      '@babel/plugin-transform-runtime',
      {
        version: runtimeVersion,
      },
    ],
    !env('test') && '@babel/plugin-transform-regenerator',
    !env('test') && '@babel/plugin-transform-destructuring',
    'transform-inline-environment-variables',
    [
      'module-resolver',
      {
        alias: {
          '@': './src',
        },
      },
    ],
    'autocomplete-index',
  ].filter(Boolean),
});

export default config;

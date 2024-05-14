import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';
import chokidar from 'chokidar';
import babel from '@babel/core';
import traverse from '@babel/traverse';
import t from '@babel/types';
import { minify } from 'terser';
import postcss from 'postcss';
import postcssrc from 'postcss-load-config';
import { rollup } from 'rollup';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const NODE_ENV = process.env.NODE_ENV || 'production';
const __PROD__ = NODE_ENV === 'production';
const terserOptions = {
  ecma: 2016,
  toplevel: true,
  safari10: true,
  format: { comments: false },
};

const bundledModules = new Set();
async function bundleModule(module) {
  if (bundledModules.has(module)) return;
  bundledModules.add(module);

  const bundle = await rollup({
    input: module,
    plugins: [
      commonjs(),
      replace({
        preventAssignment: true,
        values: {
          'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
        },
      }),
      resolve(),
      __PROD__ && terser(terserOptions),
    ].filter(Boolean),
  });
  bundle.write({
    exports: 'named',
    file: `dist/miniprogram_npm/${module}/index.js`,
    format: 'cjs',
  });
}

async function processScript(filePath) {
  let { ast, code } = await babel.transformFileAsync(path.resolve(filePath), {
    ast: true,
  });

  traverse.default(ast, {
    CallExpression({ node }) {
      if (
        node.callee.name !== 'require' ||
        !t.isStringLiteral(node.arguments[0]) ||
        node.arguments[0].value.startsWith('.')
      ) {
        return;
      }

      bundleModule(node.arguments[0].value);
    },
  });

  if (__PROD__) {
    code = (await minify(code, terserOptions)).code;
  }

  const destination = filePath.replace('src', 'dist');
  // Make sure the directory already exists when write file
  await fs.copy(filePath, destination);
  fs.writeFile(destination, code);
}

async function processTemplate(filePath) {
  const destination = filePath
    .replace('src', 'dist')
    .replace(/\.html$/, '.wxml');
  await fs.copy(filePath, destination);
}

async function processStyle(filePath) {
  const source = await fs.readFile(filePath, 'utf8');
  const { plugins, options } = await postcssrc({ from: undefined });
  const { css } = await postcss(plugins).process(source, options);
  const destination = filePath
    .replace('src', 'dist')
    .replace(/\.css$/, '.wxss');
  // Make sure the directory already exists when write file
  await fs.copy(filePath, destination);
  fs.writeFile(destination, css);
}

async function dev() {
  await fs.remove('dist');
  const cb = (filePath) => {
    if (/\.js$/.test(filePath)) {
      processScript(filePath);
      return;
    }

    if (/\.html$/.test(filePath)) {
      processTemplate(filePath);
      return;
    }

    if (/\.css$/.test(filePath)) {
      processStyle(filePath);
      return;
    }

    fs.copy(filePath, filePath.replace('src', 'dist'));
  };

  chokidar
    .watch(['src'], {
      ignored: ['**/.{gitkeep,DS_Store}'],
    })
    .on('add', (filePath) => {
      cb(filePath);
    })
    .on('change', (filePath) => {
      cb(filePath);
    });
}

async function prod() {
  await fs.remove('dist');
  const watcher = chokidar.watch(['src'], {
    ignored: ['**/.{gitkeep,DS_Store}'],
  });
  watcher.on('add', (filePath) => {
    if (/\.js$/.test(filePath)) {
      processScript(filePath);
      return;
    }

    if (/\.html$/.test(filePath)) {
      processTemplate(filePath);
      return;
    }

    if (/\.css$/.test(filePath)) {
      processStyle(filePath);
      return;
    }

    fs.copy(filePath, filePath.replace('src', 'dist'));
  });
  watcher.on('ready', () => watcher.close());
}

if (__PROD__) {
  await prod();
} else {
  await dev();
}

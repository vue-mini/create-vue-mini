import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
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
import { green, bold } from 'kolorist';

let topLevelJobs = [];
let bundleJobs = [];
const startTime = Date.now();
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

  const { peerDependencies } = await fs.readJson(fileURLToPath(
    new URL(import.meta.resolve(`${module}/package.json`)),
  ), 'utf8');
  const bundle = await rollup({
    input: module,
    external: peerDependencies ? Object.keys(peerDependencies) : undefined,
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
  await bundle.write({
    exports: 'named',
    file: `dist/miniprogram_npm/${module}/index.js`,
    format: 'cjs',
  });
}

function traverseAST(ast, onlyBabel = false) {
  traverse.default(ast, {
    CallExpression({ node }) {
      if (
        node.callee.name !== 'require' ||
        !t.isStringLiteral(node.arguments[0]) ||
        node.arguments[0].value.startsWith('.') ||
        (onlyBabel && !node.arguments[0].value.startsWith('@babel/runtime'))
      ) {
        return;
      }

      const promise = bundleModule(node.arguments[0].value);
      bundleJobs?.push(promise);
    },
  });
}

async function buildComponentLibrary(name) {
  const pkgPath = fileURLToPath(
    new URL(import.meta.resolve(`${name}/package.json`)),
  );
  const modulePath = path.dirname(pkgPath);
  const { miniprogram } = await fs.readJson(pkgPath, 'utf8');

  let source = '';
  if (miniprogram) {
    source = path.join(modulePath, miniprogram);
  } else {
    try {
      const dist = path.join(modulePath, 'miniprogram_dist');
      const stats = await fs.stat(dist);
      if (stats.isDirectory()) {
        source = dist;
      }
    } catch {
      // Empty
    }
  }

  if (!source) return;

  const destination = path.resolve('dist', 'miniprogram_npm', name);
  await fs.copy(source, destination);

  return new Promise((resolve) => {
    const jobs = [];
    const tnm = async (filePath) => {
      const result = await babel.transformFileAsync(filePath, { ast: true });
      traverseAST(result.ast, true);
      const code = __PROD__
        ? (await minify(result.code, terserOptions)).code
        : result.code;
      await fs.writeFile(filePath, code);
    };

    const watcher = chokidar.watch([destination], {
      ignored: ['**/.{gitkeep,DS_Store}'],
    });
    watcher.on('add', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      const promise = tnm(filePath);
      jobs.push(promise);
    });
    watcher.on('ready', async () => {
      const promise = watcher.close();
      jobs.push(promise);
      await Promise.all(jobs);
      resolve();
    });
  });
}

async function scanDependencies() {
  const { dependencies } = await fs.readJson('package.json', 'utf8');
  for (const name of Object.keys(dependencies)) {
    const promise = buildComponentLibrary(name);
    topLevelJobs.push(promise);
  }
}

async function processScript(filePath) {
  let ast, code;
  try {
    const result = await babel.transformFileAsync(path.resolve(filePath), {
      ast: true,
    });
    ast = result.ast;
    code = result.code;
  } catch (error) {
    console.error(`Failed to compile ${filePath}`);

    if (__PROD__) throw error;

    console.error(error);
    return;
  }

  if (filePath.endsWith('app.ts')) {
    /**
     * IOS 小程序 Promise 使用的内置的 Polyfill，但这个 Polyfill 有 Bug 且功能不全，
     * 在某些情况下 Promise 回调不会执行，并且不支持 Promise.prototype.finally。
     * 这里将全局的 Promise 变量重写为自定义的 Polyfill，如果你不需要兼容 iOS10 也可以使用以下方式：
     * Promise = Object.getPrototypeOf((async () => {})()).constructor;
     * 写在此处是为了保证 Promise 重写最先被执行。
     */
    code = code.replace(
      '"use strict";',
      '"use strict";\n\nvar PromisePolyfill = require("promise-polyfill");\nPromise = PromisePolyfill.default;',
    );
    const promise = bundleModule('promise-polyfill');
    bundleJobs?.push(promise);
  }

  traverseAST(ast);

  if (__PROD__) {
    code = (await minify(code, terserOptions)).code;
  }

  const destination = filePath.replace('src', 'dist').replace(/\.ts$/, '.js');
  // Make sure the directory already exists when write file
  await fs.copy(filePath, destination);
  await fs.writeFile(destination, code);
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

  let css;
  try {
    const result = await postcss(plugins).process(source, options);
    css = result.css;
  } catch (error) {
    console.error(`Failed to compile ${filePath}`);

    if (__PROD__) throw error;

    console.error(error);
    return;
  }

  const destination = filePath
    .replace('src', 'dist')
    .replace(/\.css$/, '.wxss');
  // Make sure the directory already exists when write file
  await fs.copy(filePath, destination);
  await fs.writeFile(destination, css);
}

const cb = async (filePath) => {
  if (filePath.endsWith('.ts')) {
    await processScript(filePath);
    return;
  }

  if (filePath.endsWith('.html')) {
    await processTemplate(filePath);
    return;
  }

  if (filePath.endsWith('.css')) {
    await processStyle(filePath);
    return;
  }

  await fs.copy(filePath, filePath.replace('src', 'dist'));
};

async function dev() {
  await fs.remove('dist');
  await scanDependencies();
  chokidar
    .watch(['src'], {
      ignored: ['**/.{gitkeep,DS_Store}'],
    })
    .on('add', (filePath) => {
      const promise = cb(filePath);
      topLevelJobs?.push(promise);
    })
    .on('change', (filePath) => {
      cb(filePath);
    })
    .on('ready', async () => {
      await Promise.all(topLevelJobs);
      await Promise.all(bundleJobs);
      console.log(bold(green(`启动完成，耗时：${Date.now() - startTime}ms`)));
      console.log(bold(green('监听文件变化中...')));
      // Release memory.
      topLevelJobs = null;
      bundleJobs = null;
    });
}

async function prod() {
  await fs.remove('dist');
  await scanDependencies();
  const watcher = chokidar.watch(['src'], {
    ignored: ['**/.{gitkeep,DS_Store}'],
  });
  watcher.on('add', (filePath) => {
    const promise = cb(filePath);
    topLevelJobs.push(promise);
  });
  watcher.on('ready', async () => {
    const promise = watcher.close();
    topLevelJobs.push(promise);
    await Promise.all(topLevelJobs);
    await Promise.all(bundleJobs);
    console.log(bold(green(`构建完成，耗时：${Date.now() - startTime}ms`)));
  });
}

if (__PROD__) {
  await prod();
} else {
  await dev();
}

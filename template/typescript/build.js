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
import { parse as templateParse } from 'vue/compiler-sfc';

const NODE_ENV = process.env.NODE_ENV || 'production';
const __PROD__ = NODE_ENV === 'production';
const terserOptions = {
  ecma: 2016,
  toplevel: true,
  safari10: true,
  format: { comments: false },
};

/**
 * Ensure the file exists by creating the directory if it doesn't exist.
 * @param {string} filePath
 */
async function ensureFileExists(filePath) {
  const isFileExists = await fs.exists(filePath);
  if (!isFileExists) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }
}

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

/**
 * Process the script file.
 * If the script is not provided, the file will be read from the file system.
 * @param {string} filePath
 * @param {string | undefined} script
 */
async function processScript(filePath, script) {
  let ast, code;
  try {
    let result;
    if (script) {
      result = await babel.transformAsync(script, {
        ast: true,
        filename: path.resolve(filePath),
      });
    } else {
      result = await babel.transformFileAsync(path.resolve(filePath), {
        ast: true,
      });
    }
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
    bundleModule('promise-polyfill');
  }

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

  const destination = filePath.replace('src', 'dist').replace(/\.ts$/, '.js');
  // Make sure the directory already exists when write file
  await ensureFileExists(destination);
  fs.writeFile(destination, code);
}

/**
 * Process the template file.
 * If the template is not provided, the file will be read from the file system.
 * @param {string} filePath
 * @param {string} template
 */
async function processTemplate(filePath, template) {
  if (template) {
    await ensureFileExists(filePath);
    await fs.writeFile(filePath, template);
  } else {
    const destination = filePath
      .replace('src', 'dist')
      .replace(/\.html$/, '.wxml');
    await fs.copy(filePath, destination);
  }
}

/**
 * Process the style file.
 * If the style is not provided, the file will be read from the file system.
 * @param {string} filePath
 * @param {string} style
 */
async function processStyle(filePath, style) {
  let source;
  if (style) {
    source = style;
  } else {
    source = await fs.readFile(filePath, 'utf8');
  }
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
  ensureFileExists(destination);
  fs.writeFile(destination, css);
}

/**
 * Process the Single File Component (SFC) file.
 * The file will be read from the file system.
 * The script, template, and style will be extracted from the SFC file.
 * now do not support scoped style
 * and only support one style block
 * @param {string} filePath
 */
function processSFC(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const parsedSrc = templateParse(source);
  const script = parsedSrc.descriptor.script.content;
  const scriptLang = parsedSrc.descriptor.script.lang;
  const template = parsedSrc.descriptor.template.content;
  const style = parsedSrc.descriptor.styles[0];

  const virtualScriptPath = filePath
    .replace('src', 'dist')
    .replace(/\.vue$/, `.${scriptLang}`);
  const virtualTemplatePath = filePath
    .replace('src', 'dist')
    .replace(/\.vue$/, '.wxml');
  const virtualStylePaths = filePath
    .replace('src', 'dist')
    .replace(/\.vue$/, '.css');

  processScript(virtualScriptPath, script);
  processTemplate(virtualTemplatePath, template);
  processStyle(virtualStylePaths, style.content);
}

async function dev() {
  await fs.remove('dist');
  const cb = (filePath) => {
    if (/\.vue$/.test(filePath)) {
      processSFC(filePath);
      return;
    }

    if (/\.ts$/.test(filePath)) {
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
    if (/\.vue$/.test(filePath)) {
      processSFC(filePath);
      return;
    }

    if (/\.ts$/.test(filePath)) {
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

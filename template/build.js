import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import chokidar from 'chokidar';
import babel from '@babel/core';
import traverse from '@babel/traverse';
import t from '@babel/types';
import { minify } from 'terser';
import posthtml from 'posthtml';
import less from 'less';
import postcss from 'postcss';
import pxtorpx from 'postcss-pxtorpx-pro';
import url from 'postcss-url';
import { rollup } from 'rollup';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const NODE_ENV = process.env.NODE_ENV || 'production';
const __PROD__ = NODE_ENV === 'production';
const localPath = `http://${getLocalIP()}:3000/`;
const publicPath = 'https://your.static.server/';
const terserOptions = {
  ecma: 2016,
  toplevel: true,
  safari10: true,
  format: { comments: false },
};

function getLocalIP() {
  const ifaces = Object.values(os.networkInterfaces());
  for (const iface of ifaces) {
    for (const alias of iface) {
      if (alias.internal || alias.family !== 'IPv4') continue;
      return alias.address;
    }
  }
}

function getImagePathWithHash(imagePath, originPath) {
  const buffer = fs.readFileSync(imagePath);
  const hash = crypto
    .createHash('md5')
    .update(buffer)
    .digest('hex')
    .slice(0, 8);
  return originPath.replace(/\.(png|jpe?g|gif|svg)$/, `.${hash}.$1`);
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
    // eslint-disable-next-line unicorn/no-await-expression-member
    code = (await minify(code, terserOptions)).code;
  }

  const destination = filePath.replace('src', 'dist').replace(/\.ts$/, '.js');
  // Make sure the directory already exists when write file
  await fs.copy(filePath, destination);
  fs.writeFile(destination, code);
}

async function processTemplate(filePath, origin = localPath) {
  const source = await fs.readFile(filePath, 'utf8');
  const { html } = await posthtml()
    .use((tree) => {
      tree.match([{ tag: 'image' }, { tag: 'cover-image' }], (node) => {
        const { src } = node.attrs;
        if (
          /^{{.*}}$/.test(src) ||
          /^https?:\/\//.test(src) ||
          src.startsWith('data:') ||
          src.includes('/assets/')
        ) {
          return node;
        }

        const absolutePath = src.startsWith('/')
          ? path.resolve('src', src.slice(1))
          : path.resolve(path.dirname(filePath), src);
        const href =
          origin + path.relative('src', absolutePath).replaceAll('\\', '/');
        node.attrs.src = __PROD__
          ? getImagePathWithHash(absolutePath, href)
          : href;
        return node;
      });
    })
    .process(source, { xmlMode: true, singleTags: [/<>/] });
  const destination = filePath
    .replace('src', 'dist')
    .replace(/\.html$/, '.wxml');
  // Make sure the directory already exists when write file
  await fs.copy(filePath, destination);
  fs.writeFile(destination, html);
}

async function processStyle(filePath, origin = localPath) {
  let source = await fs.readFile(filePath, 'utf8');
  source =
    `@import '${path.resolve('src/styles/variables.less')}';\n` +
    `@import '${path.resolve('src/styles/mixins.less')}';\n` +
    source;
  const { css } = await less.render(source, {
    filename: path.resolve(filePath),
  });
  const { css: wxss } = await postcss()
    .use(pxtorpx({ minPixelValue: 2, transform: (x) => x }))
    .use(
      url({
        url(asset) {
          if (/^https?:\/\//.test(asset.url) || asset.url.startsWith('data:')) {
            return asset.url;
          }

          const absolutePath = asset.url.startsWith('/')
            ? path.resolve('src', asset.url.slice(1))
            : path.resolve(path.dirname(filePath), asset.url);
          const href =
            origin + path.relative('src', absolutePath).replaceAll('\\', '/');
          return __PROD__ ? getImagePathWithHash(absolutePath, href) : href;
        },
      }),
    )
    .process(css, { map: false, from: undefined });
  const destination = filePath
    .replace('src', 'dist')
    .replace(/\.less$/, '.wxss');
  // Make sure the directory already exists when write file
  await fs.copy(filePath, destination);
  fs.writeFile(destination, wxss);
}

function recompileStyles() {
  const watcher = chokidar.watch(['src/**/*.less', '!src/styles/**/*']);
  watcher.on('add', (filePath) => {
    processStyle(filePath);
  });
  watcher.on('ready', () => watcher.close());
}

async function dev() {
  await fs.remove('dist');
  const cb = (filePath) => {
    if (/\.ts$/.test(filePath)) {
      processScript(filePath);
      return;
    }

    if (/\.html$/.test(filePath)) {
      processTemplate(filePath);
      return;
    }

    if (/\.less$/.test(filePath)) {
      processStyle(filePath);
      return;
    }

    fs.copy(filePath, filePath.replace('src', 'dist'));
  };

  chokidar
    .watch(['src', '!src/images/**/*'], {
      ignored: ['**/.{gitkeep,DS_Store}'],
    })
    .on('add', (filePath) => {
      if (filePath.includes(path.join('src', 'styles'))) return;
      cb(filePath);
    })
    .on('change', (filePath) => {
      if (filePath.includes(path.join('src', 'styles'))) {
        recompileStyles();
        return;
      }

      cb(filePath);
    });
}

async function prod() {
  await fs.remove('dist');
  await fs.remove('temp');
  const watcher = chokidar.watch(['src', '!src/styles/**/*'], {
    ignored: ['**/.{gitkeep,DS_Store}'],
  });
  watcher.on('add', (filePath) => {
    if (/\.ts$/.test(filePath)) {
      processScript(filePath);
      return;
    }

    if (/\.html$/.test(filePath)) {
      processTemplate(filePath, publicPath);
      return;
    }

    if (/\.less$/.test(filePath)) {
      processStyle(filePath, publicPath);
      return;
    }

    if (filePath.includes(path.join('src', 'images'))) {
      fs.copy(
        filePath,
        getImagePathWithHash(filePath, filePath.replace('src', 'temp')),
      );
      return;
    }

    fs.copy(filePath, filePath.replace('src', 'dist'));
  });
  watcher.on('ready', () => watcher.close());
}

if (__PROD__) {
  await prod();
} else {
  spawn('serve', ['src'], { stdio: 'inherit', shell: true });
  await dev();
}

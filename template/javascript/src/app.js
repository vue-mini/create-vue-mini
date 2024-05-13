// IOS 小程序 Promise 使用的内置的 Polyfill，但这个 Polyfill 有 Bug 且功能不全，
// 在某些情况下 Promise 回调不会执行，并且不支持 Promise.prototype.finally。
// 此处将全局的 Promise 变量重写为自定义的 Polyfill，如果你不需要兼容 iOS10 也可以使用以下方式：
// Promise = Object.getPrototypeOf((async () => {})()).constructor;
import PromisePolyfill from 'promise-polyfill';
// eslint-disable-next-line no-global-assign
Promise = PromisePolyfill;
import { createApp } from '@vue-mini/core';

createApp(() => {
  console.log('App Launched!');
});

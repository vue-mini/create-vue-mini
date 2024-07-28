# create-vue-mini <a href="https://nodejs.org/en/about/previous-releases"><img src="https://img.shields.io/node/v/create-vue-mini" alt="node compatibility"></a>

创建 Vue Mini 小程序项目的最佳方案。

<p align="center">
  <img src="https://github.com/vue-mini/create-vue-mini/blob/main/media/screenshot-cli.png?raw=true" width="738">
</p>

## 使用

要使用 `create-vue-mini` 创建一个全新的 Vue Mini 小程序项目，请直接在终端内运行以下命令：

```bash
npm create vue-mini@latest
```

<!-- prettier-ignore -->
> [!NOTE]
> `@latest` **不能**省略，否则 `npm` 可能会使用已缓存的旧版本。

## 常见问题

### 如何使用小程序组件库？

`create-vue-mini` 创建的小程序项目对小程序组件库提供了开箱支持，**不需要**使用微信开发者工具的 `工具 -> 构建 npm` 功能，**不需要**勾选 `将 JS 编译成 ES5`，只需要将小程序组件库作为**生产依赖**（即 dependencies）安装，就可以直接使用。`create-vue-mini` 会在幕后帮你将一切处理妥当。视频介绍：[《Vue Mini 如何使用小程序组件库》](https://www.bilibili.com/video/BV1w1421t7US/)

## 致谢

此项目由 [create-vue](https://github.com/vuejs/create-vue) 修改而来。

## 许可证

[MIT](https://opensource.org/licenses/MIT)

Copyright (c) 2024-present Yang Mingshan

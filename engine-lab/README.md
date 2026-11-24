# 游戏引擎练习

在仓库根目录安装依赖并启动 Vite。

```sh
npm install
npm run dev
```

打开终端显示的地址，选择一章。每章的完整代码在 [src/lessons/](src/lessons/)，章节讲解见 [教程目录](../docs/README.md)。

练习通过 npm workspace 使用本地引擎包。Three.js 由示例项目显式安装，Vite 负责解析并打包。

```js
import { createEngine, createInput, models } from "@game-engine/runtime"
```

在仓库根目录执行生产构建和预览。

```sh
npm run lint
npm run build
npm run preview
```

在 `engine/` 中运行 `npm pack` 可以生成引擎的 npm 压缩包。独立项目安装该压缩包时，也需要安装符合 [引擎 peerDependencies](../engine/package.json) 的 Three.js。

## 代码实验台

运行 `npm run dev` 后，从练习目录打开「代码实验台」，也可以在 Vite 地址后加上 `?playground`。左侧编写 JavaScript，右侧显示预览和控制台。默认在编辑停顿后重新运行，也可以关闭实时运行，再点击「运行」或按 Ctrl/⌘ + Enter。

内置「补间数值」和「补间立方体」示例。代码支持从 `@game-engine/runtime` 和 `three` 导入。每次运行都会重建预览，定时器、场景和状态随之从头开始。预览在独立的沙箱中执行，运行环境支持本地 JavaScript 和内联资源，外部模块导入及网络资源加载受限。

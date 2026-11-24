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

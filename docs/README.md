# 从零读懂这个 Three.js 游戏引擎

这套教程给有 JavaScript 或 TypeScript 基础、第一次读游戏引擎源码的读者。你会从一个旋转的立方体起步，逐步做出能移动、跳跃、碰撞、计分的拾取小游戏，最后回到仓库里的半场篮球，追踪一次投篮和扣篮。

这里的「引擎」是 Three.js 上的一组浏览器游戏工具。Three.js 提供场景图、模型材质、相机和 WebGL 渲染。这个仓库在上面组织每帧更新，并提供输入、简易碰撞、镜头、HUD、动画和音效。游戏脚本负责决定什么算进球、谁能抢断、回合何时结束。

## 按文件读源码

- [`engine/engine.js` 源码解析](engine/engine.md) · 从场景、相机和帧循环开始
- [`engine/models.js` 源码解析](engine/models.md) · 从基本形状到组合模型、实例化与对象池
- [`engine/materials.js` 源码解析](engine/materials.md) · 从颜色、光照到程序化纹理
- [`engine/lighting.js` 源码解析](engine/lighting.md) · 对比布光方案、阴影范围和跟随灯
- [`engine/animation.js` 源码解析](engine/animation.md) · 在理解帧循环后，学习如何驱动补间和动画

## 学习目录

| 章节 | 动手做什么 | 应该掌握什么 |
| --- | --- | --- |
| [01 · 第一帧是怎么画出来的](01-render-loop.md) | 启动一个旋转立方体 | ES 模块、场景图、帧循环与 `dt` |
| [02 · 从按键到移动和镜头](02-input-camera.md) | 用 WASD 移动，相机跟随 | 输入快照、归一化、更新顺序、相机平滑 |
| [03 · 重力、跳跃与碰撞](03-physics.md) | 给玩家加重力、地板和挡路方块 | 速度积分、碰撞体、碰撞法线、模拟状态 |
| [04 · 把原型变成游戏](04-game-state.md) | 拾取金币、倒计时、重开 | 触发器、有限状态机、HUD 和结算 |
| [05 · 让游戏给出反馈](05-feedback.md) | 加入拾取音效、火花和镜头反馈 | 补间、粒子、后处理、资源生命周期 |

## 开始之前

熟悉 `import`、对象、回调和基本的 DOM 操作即可。练习使用浏览器直接执行的 JavaScript。第一章提供一个小型 HTML 入口，后续各章沿用同一个练习目录，最终不会覆盖篮球游戏的入口。仓库根目录是启动静态服务器的位置。

不熟悉 3D 坐标时，先记住 `x` 是横向、`y` 是高度、`z` 是纵深。教程把球场地板放在 `y = 0`，把前进方向约定为 `-z`。坐标的「前方」仍取决于具体玩法和相机朝向。

## 模块速查

| 想查什么 | 源码 |
| --- | --- |
| 引擎入口、帧循环、画布、资源释放 | [index.js](../engine/index.js)、[engine.js](../engine/engine.js) |
| 按键、触摸、手柄、视角控制 | [input.js](../engine/input.js)、[controls.js](../engine/controls.js) |
| 向量辅助、插值、阻尼、缓动 | [math.js](../engine/math.js) |
| 模型、材质和灯光 | [models.js](../engine/models.js)、[materials.js](../engine/materials.js)、[lighting.js](../engine/lighting.js) |
| 碰撞、触发器、射线检测 | [physics.js](../engine/physics.js) |
| 回合状态、计分、计时、存储与界面 | [state.js](../engine/state.js)、[hud.js](../engine/hud.js) |
| 补间、骨骼动画、音效、粒子、后处理 | [animation.js](../engine/animation.js)、[sound.js](../engine/sound.js)、[particles.js](../engine/particles.js)、[postfx.js](../engine/postfx.js) |
| 帧率、绘制次数和碰撞可视化 | [debug.js](../engine/debug.js) |

## 在 Vite 中运行练习

前五章的完整实现放在 [lab/src/lessons/](../lab/src/lessons/)。在仓库根目录执行 `npm install` 和 `npm run dev`，再从终端显示的地址进入练习目录。Vite 示例从 `@game-engine/runtime` 导入引擎，由 npm workspace 链接到本仓库的 `engine/` 包。第一章的静态服务器步骤仍可以用来理解浏览器模块的加载过程。

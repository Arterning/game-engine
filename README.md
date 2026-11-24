# Game Engine

`@game-engine/runtime` 是一个基于 Three.js 的浏览器游戏工具包。它管理场景、相机、画布和帧循环，并提供输入、简易碰撞、镜头、HUD、动画、音效和粒子。游戏代码可以按需组合这些模块，也可以用 `createGame()` 一次创建常用组件。

## 运行仓库里的示例

从仓库根目录执行：

```sh
npm install
npm run dev
```

打开终端显示的 Vite 地址，选择一章即可运行。五个练习从旋转立方体开始，逐步加入移动、碰撞、计分和音效。

| 目录 | 内容 |
| --- | --- |
| [engine/](engine/) | 引擎源码与 npm 包，公开入口是 `engine/index.js` |
| [engine-lab/src/lessons/](engine-lab/src/lessons/) | 五个从包名导入引擎的 Vite 示例 |
| [docs/](docs/) | 面向有 JS/TS 基础的初学者的分章教程 |

`npm run lint` 检查示例源码，`npm run build` 生成 `engine-lab/dist/`，`npm run preview` 可预览生产构建。

## 在自己的项目中使用

同一工作区内，可以像示例一样在应用的 `package.json` 声明 `"@game-engine/runtime": "0.1.0"` 和 `"three": "^0.185.1"`，然后从仓库根目录运行 `npm install`。

独立项目可以安装本地压缩包。先在本仓库打包：

```sh
npm pack --workspace @game-engine/runtime
```

然后在你的 Vite 项目目录安装。把示例中的路径替换成实际压缩包路径。

```sh
npm install /path/to/game-engine-runtime-0.1.0.tgz "three@^0.185.1"
```

在 Vite 的浏览器入口（例如 `src/main.js`）粘贴下面的代码。页面如果已有模板样式，请先移除对页面尺寸和画布布局的限制。

```js
import { createGame, followCamera, lights, models } from "@game-engine/runtime"

Object.assign(document.body.style, {
  margin: "0",
  height: "100dvh",
  overflow: "hidden",
  position: "relative",
})

const game = createGame({
  background: "#243743",
  cameraPosition: [0, 4, 7],
  lookAt: [0, 0.5, 0],
})

lights.daylight(game.scene)
const player = models.box(1, { color: "#66d9ff", position: [0, 0.5, 0] })
game.add(models.ground(24), player)
game.hud.text("WASD 或方向键移动")
followCamera(game.engine, player, { behind: false, distance: 7, height: 4 })

game.onUpdate((dt) => {
  const speed = 4
  player.position.x += game.input.move.x * speed * dt
  player.position.z += game.input.move.y * speed * dt
})
```

`createGame()` 会启动帧循环。如果用 `createEngine()` 逐个组装模块，配置完成后调用 `engine.start()`。帧回调里的 `dt` 和 `elapsed` 都以秒计。先运行 `onUpdate`，再运行 `onLateUpdate`，最后渲染。把速度乘以 `dt`，可以让移动速度随经过的时间计算。

## API 速查

### 入口、玩法和表现

| 模块 | 公开 API | 常见用途 |
| --- | --- | --- |
| 核心 | `createGame(options)`、`createEngine(options)`、`disposeObject(root)` | 创建游戏设施、直接管理渲染和循环、释放场景对象资源 |
| 输入 | `createInput({ engine, actions })` | 自定义动作绑定，用 `move` 读取方向，用 `down`、`pressed`、`released` 检查按键状态 |
| 镜头与操作 | `orbitCamera`、`followCamera`、`topDownCamera`、`sideCamera`、`firstPerson`、`thirdPerson`、`platformer` | 轨道、跟随、俯视、横版和角色控制 |
| 指针查询 | `pointerOnGround`、`pointerPicker` | 把屏幕指针投射到地面，或用射线拾取场景对象 |
| 物理 | `createPhysics(options)`、`hits`、`inside` | 静态碰撞体、移动球体、拾取触发器和区域判断 |
| 游戏状态 | `createStateMachine`、`createEvents`、`createTimer`、`createScore`、`createStorage`、`createTicker`、`createCooldown`、`createDifficulty`、`formatTime` | 回合、事件、计时、计分、存档、技能间隔及难度 |
| HUD | `createHud({ container })` | 用 `stat`、`bar`、`text`、`toast`、`overlay`、`button` 等方法创建 DOM 界面 |
| 动画 | `createTweens`、`createMixer`、`createShake`、`Spring`、`SpringVec3`、`flash`、`pop`、`hover`、`ease` | 补间、动画片段、镜头震动、弹簧和缓动 |
| 特效 | `createParticles`、`createTrail`、`createAmbience`、`shockwave`、`createPostFX` | 粒子、拖尾、环境效果、冲击波、辉光和暗角 |
| 音频 | `createAudio(options)` | 用 `play("coin")` 播放预设音效，或用 `define()`、`tone()`、`noise()` 自定义声音 |

### 命名空间

| 导出 | 常用成员 | 源码 |
| --- | --- | --- |
| `models` | `box`、`sphere`、`ground`、`coin`、`character`、`loadModel`、`instances`、`createPool` | [models.js](engine/models.js) |
| `materials` | `standard`、`matte`、`metal`、`glow`、`toon`、`checkerTexture`，另有顶层导出的 `palette`、`brand` | [materials.js](engine/materials.js) |
| `lights` | `daylight`、`sunset`、`night`、`studio`、`moody`、`attachLight`、`blobShadow` | [lighting.js](engine/lighting.js) |
| `math` | `clamp`、`lerp`、`damp`、`dampVec`、`angleDelta`、`createRandom` | [math.js](engine/math.js) |
| `effects`、`anim` | 对应粒子和动画模块，也可使用上表的顶层导出 | [particles.js](engine/particles.js) · [animation.js](engine/animation.js) |
| `debug` | `showStats`、`showHelpers`、`showColliders`、`log` | [debug.js](engine/debug.js) |

完整导出见 [engine/index.js](engine/index.js)。源码注释与 [分章教程](docs/README.md) 可以用来查询参数和运行原理。

## 接入时的几个约定

- **帧循环**：用 `engine.onUpdate(fn)` 注册游戏逻辑。该方法返回注销函数，跟随镜头等读取更新结果的逻辑可以放在 `onLateUpdate`。
- **物理**：`createPhysics()` 创建独立的模拟。通过 `addGround()`、`addBox()`、`addBody()` 注册对象，再在每帧调用 `physics.step(dt)`。当前主要支持动态球体与静态地面、盒体或球体的碰撞，以及触发器重叠。完整示例见 [第三章](engine-lab/src/lessons/03-physics.js)。
- **实时状态**：`createTimer()` 需要主动调用 `update(dt)`。计时器、状态机、分数和 HUD 的组合示例见 [第四章](engine-lab/src/lessons/04-game-state.js)。
- **退出与清理**：在单页应用卸载游戏时，调用已创建模块的清理方法，例如 `input.dispose()`、`audio.dispose()`、`hud.remove()`，再调用 `engine.dispose()`。音频通常需要先有一次用户交互。

# 02 · 从按键到移动和镜头

本章接着使用第一章的 `engine-lab/example.js`。把第一行导入改为：

```js
import { createEngine, createInput, followCamera, lights, models } from "../engine/index.js"
```

把原来的旋转回调和最后的 `engine.start()` 替换为以下代码。灯光、地面和方块部分继续使用。

```js
const input = createInput({ engine })

engine.onUpdate((dt) => {
  const speed = input.down("sprint") ? 7 : 4
  player.position.x += input.move.x * speed * dt
  player.position.z += input.move.y * speed * dt

  if (input.pressed("restart")) player.position.set(0, 0.5, 0)
})

followCamera(engine, player, {
  behind: false,
  distance: 7,
  height: 4,
  stiffness: 7,
})

engine.start()
```

用 WASD 或方向键移动，按住 Shift 加速，按 R 回到起点。这里使用的是引擎默认键位，篮球项目在自己的入口中定义了不同的绑定。

## 为什么按键事件和移动分开

浏览器的 `keydown` 和 `keyup` 可以在帧与帧之间到达，引擎先把它们放进集合。每帧开始时，`beginFrame()` 把方向键、触摸摇杆和手柄轴整理为 `input.move`。这个向量最大长度为 1，因此同时按 W 和 D 不会获得约 1.4 倍的速度。 [input.js](../engine/input.js)

| 查询 | 适合的动作 |
| --- | --- |
| `down("sprint")` | 按住期间每帧使用较高速度 |
| `pressed("restart")` | 按下时触发一次重置 |
| `released("jump")` | 松开时结算蓄力动作 |

`createInput({ engine })` 会注册一个常规更新回调和一个晚更新回调。注册顺序让游戏更新前能读到新方向，晚更新阶段清除当帧按下和松开的标记。若自行调用 `createInput()` 而不传 `engine`，调用者负责每帧执行 `beginFrame()` 和 `endFrame()`。 [input.js](../engine/input.js)

## 镜头为什么晚一点更新

`followCamera()` 在 `onLateUpdate` 才计算相机目标，所以读到的是这一帧玩家移动后的坐标。它对相机位置和观察点都做阻尼。核心系数是 `1 - Math.exp(-lambda * dt)`，含义是按经过的时间靠近目标。这里的 `behind: false` 让偏移沿世界坐标固定，便于理解普通跟随。 [controls.js](../engine/controls.js) · [math.js](../engine/math.js)

**练习**。把 `stiffness` 调到 2，再调到 20，比较跟随迟滞。再把加速速度改成 10，试试斜跑速度是否仍跟直跑一致。

[返回目录](README.md) · [上一章](01-render-loop.md) · [下一章](03-physics.md)

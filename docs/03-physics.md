# 03 · 重力、跳跃与碰撞

本章把上一章的方块换成球，让简易物理系统接管位置。在 `example.js` 中保留地面、灯光和引擎构造。

把模块导入及玩家定义分别改成：

```js
import { createEngine, createInput, createPhysics, followCamera, lights, models } from "../engine/index.js"
```

```js
const player = models.sphere(0.5, { color: "#66d9ff", position: [0, 2, 0] })
```

把第二章的 `const input = ...` 和紧跟的 `engine.onUpdate(...)` 替换为下段。保留下面的 `followCamera(...)` 和 `engine.start()`。

```js
const input = createInput({ engine })
const physics = createPhysics({ gravity: -18 })
physics.addGround(0)

const wall = models.box([3, 1.6, 0.5], { color: "#ff9d59", position: [0, 0.8, -3] })
engine.add(wall)
physics.addBox(wall)

const body = physics.addBody({ object: player, radius: 0.5 })

engine.onUpdate((dt) => {
  const speed = input.down("sprint") ? 7 : 4
  body.velocity.x = input.move.x * speed
  body.velocity.z = input.move.y * speed

  if (input.pressed("jump") && body.grounded) body.velocity.y = 7
  if (input.pressed("restart")) {
    body.position.set(0, 2, 0)
    body.velocity.set(0, 0, 0)
  }

  physics.step(dt)
})
```

刷新后小球会先落地。向前撞墙可以沿着墙面滑动，按空格可以跳，空中按空格不应再起跳。当前练习每帧直接写水平速度，手感接近即时控制。若想模拟惯性，可以逐步让速度接近目标值。

## 物理状态怎样传到画面

`step(dt)` 先做 `velocity.y += gravity * gravityScale * dt`，再用更新后的速度推进 `position`。发生碰撞时，物理解算会把球移出重叠区，并处理沿碰撞法线的速度分量。对墙面，消除朝墙的分量可以保留沿墙运动。地面法线向上，因此可以标记 `grounded` 并消除向下速度。最后用 `body.object.position.copy(body.position)` 把结果交给画面。 [physics.js](../engine/physics.js)

这里的物理主路径是动态球体与静态地面、轴对齐包围盒、球体的碰撞。它不会自动为场景里每个网格注册碰撞体，也没有完整的动态刚体两两碰撞求解。网格形式传给 `addBox(mesh)` 时会读取当时的世界坐标包围盒，移动墙以后需要更新碰撞盒。默认只在每步的位置检查碰撞，速度过高仍可能穿过很薄的墙。

**练习**。临时把 `physics.addBox(wall)` 注释掉，观察墙仍画在屏幕上，小球却能穿过。恢复后试着修改重力和起跳速度，比较跳跃高度。

[返回目录](README.md) · [上一章](02-input-camera.md) · [下一章](04-game-state.md)

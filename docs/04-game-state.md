# 04 · 把原型变成游戏

这一章把前面的原型扩展成 20 秒拾取挑战。用以下完整代码替换 `engine-lab/example.js`，HTML 继续使用第一章的版本。

```js
import {
  createEngine, createHud, createInput, createPhysics,
  createScore, createStateMachine, createTimer, followCamera, lights, models,
} from "../engine/index.js"

const engine = createEngine({ background: "#243743" })
const input = createInput({ engine })
const hud = createHud({ container: engine.container })
const physics = createPhysics({ gravity: -18 })
const score = createScore({ hud, label: "金币", key: "engine-lab" })
const hint = hud.text("WASD 移动 · 空格跳跃 · R 重开")

lights.daylight(engine.scene)
const player = models.sphere(0.5, { color: "#66d9ff", position: [0, 2, 0] })
const wall = models.box([3, 1.6, 0.5], { color: "#ff9d59", position: [0, 0.8, -3] })
engine.add(models.ground(24), player, wall)
physics.addGround(0)
physics.addBox(wall)
const body = physics.addBody({ object: player, radius: 0.5 })

const pickups = [[2, 0.55, 0], [2.5, 0.55, -3], [-2.5, 0.55, -3]].map((position) => {
  const mesh = models.coin()
  mesh.position.set(...position)
  engine.add(mesh)
  const trigger = physics.addBody({ object: mesh, position, radius: 0.45, trigger: true })
  return { mesh, trigger }
})

const timer = createTimer({
  duration: 20,
  hud,
  label: "时间",
  onEnd: () => machine.go("result"),
})

const machine = createStateMachine({
  play: {
    enter() {
      score.reset()
      timer.reset()
      timer.start()
      body.position.set(0, 2, 0)
      body.velocity.set(0, 0, 0)
      body.grounded = false
      player.position.copy(body.position)
      for (const { mesh, trigger } of pickups) {
        mesh.visible = true
        trigger.enabled = true
      }
      hint.set("WASD 移动 · 空格跳跃 · R 重开")
    },
    update(dt) {
      if (input.pressed("restart")) {
        machine.go("result")
        machine.go("play")
        return
      }
      body.velocity.x = input.move.x * 4
      body.velocity.z = input.move.y * 4
      if (input.pressed("jump") && body.grounded) body.velocity.y = 7
      timer.update(dt)
      if (machine.is("play")) physics.step(dt)
    },
  },
  result: {
    enter() {
      timer.pause()
      hint.set(`收集了 ${score.value} / ${pickups.length} 枚金币。按 R 再玩。`)
    },
    update() {
      if (input.pressed("restart")) machine.go("play")
    },
  },
})

function collectPickup(mesh, trigger) {
  trigger.enabled = false
  mesh.visible = false
  score.add(1)
  if (score.value === pickups.length) machine.go("result")
}

for (const { mesh, trigger } of pickups) {
  trigger.onEnter = () => collectPickup(mesh, trigger)
}

machine.go("play")
engine.onUpdate((dt) => machine.update(dt))
followCamera(engine, player, { behind: false, distance: 7, height: 4 })
engine.start()
```

## 一次拾取经过哪些层

1. `physics.step(dt)` 更新玩家位置，然后检查触发器的重叠。
2. 首次进入触发器时，`onEnter` 触发一次。金币禁用触发器并隐藏模型，所以下一帧不会重复加分。
3. `score.add(1)` 修改数值并更新 HUD。若刷新后看到历史最佳分，这是 `createScore()` 经由 `createStorage()` 写入了浏览器存储。
4. 集齐或时间耗尽后，状态机切到 `result`。此时继续渲染场景，输入只用来重开。

`createStateMachine()` 用 `go()` 依次执行旧状态的 `exit`、新状态的 `enter`，并发出 `change`。切到当前状态时会直接返回，因此练习里的 R 先切到结算，再进游戏。倒计时器需要由游戏显式执行 `update(dt)`。倒计时归零会暂停，重开时用 `reset()` 后再调用 `start()`。 [state.js](../engine/state.js)

HUD 使用 DOM，场景模型走 WebGL。隐藏金币的 `mesh.visible` 只影响画面，禁用触发器的 `trigger.enabled` 才会停止碰撞检查。 [hud.js](../engine/hud.js) · [physics.js](../engine/physics.js)

**练习**。先走到右侧捡第一枚金币，留在原地确认只加 1 分。再集齐、按 R 重开，并在第二局等待超时，确认两条结算路径都能正常工作。

[返回目录](README.md) · [上一章](03-physics.md) · [下一章](05-feedback.md)

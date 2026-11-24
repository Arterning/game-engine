import {
  createAudio, createEngine, createHud, createInput, createParticles, createPhysics,
  createScore, createStateMachine, createTimer, followCamera, lights, models, shockwave,
} from "@game-engine/runtime"

const engine = createEngine({ background: "#243743" })
const input = createInput({ engine })
const hud = createHud({ container: engine.container })
const physics = createPhysics({ gravity: -18 })
const score = createScore({ hud, label: "金币", key: "engine-lab" })
const controlsHint = "WASD 移动 · 空格跳跃 · R 重开"
const startHint = "按 WASD 或方向键开始计时 · 空格跳跃"
const hint = hud.text(startHint)

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

let started = false

const machine = createStateMachine({
  play: {
    enter() {
      score.reset()
      timer.reset()
      timer.pause()
      started = false
      body.position.set(0, 2, 0)
      body.velocity.set(0, 0, 0)
      body.grounded = false
      player.position.copy(body.position)
      for (const { mesh, trigger } of pickups) {
        mesh.visible = true
        trigger.enabled = true
      }
      hint.set(startHint)
    },
    update(dt) {
      if (input.pressed("restart")) {
        machine.go("result")
        machine.go("play")
        return
      }
      const jump = input.pressed("jump")
      if (!started && (input.move.lengthSq() > 0 || jump)) {
        started = true
        timer.start()
        hint.set(controlsHint)
      }
      body.velocity.x = input.move.x * 4
      body.velocity.z = input.move.y * 4
      if (jump && body.grounded) body.velocity.y = 7
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
  audio.play("coin", { vary: 0.08 })
  particles.burst(mesh.position, { count: 28, color: "#ffd15a", speed: 4 })
  shockwave(engine, mesh.position, { from: 0.25, to: 1.5, duration: 0.35 })
  cameraRig.shake(0.12)
  if (score.value === pickups.length) machine.go("result")
}

for (const { mesh, trigger } of pickups) {
  trigger.onEnter = () => collectPickup(mesh, trigger)
}

machine.go("play")
engine.onUpdate((dt) => machine.update(dt))
const cameraRig = followCamera(engine, player, { behind: false, distance: 7, height: 4 })
const audio = createAudio()
const particles = createParticles(engine, { max: 120, gravity: -6 })
engine.start()

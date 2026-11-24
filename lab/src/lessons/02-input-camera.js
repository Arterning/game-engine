import { createEngine, createInput, followCamera, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [4, 3, 6],
  lookAt: [0, 0.6, 0],
})

lights.daylight(engine.scene)
const ground = models.ground(24)
const player = models.box(1, { color: "#66d9ff", position: [0, 0.5, 0] })
engine.add(ground, player)

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

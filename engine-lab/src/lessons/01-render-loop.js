import { createEngine, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [4, 3, 6],
  lookAt: [0, 0.6, 0],
})

lights.daylight(engine.scene)
const ground = models.ground(24)
const player = models.box(1, { color: "#66d9ff", position: [0, 0.5, 0] })
engine.add(ground, player)

engine.onUpdate((dt) => {
  player.rotation.y += 1.4 * dt
})

engine.start()

import { createEngine, createInput, createPhysics, followCamera, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [4, 3, 6],
  lookAt: [0, 0.6, 0],
})

lights.daylight(engine.scene)
const ground = models.ground(24)
const player = models.sphere(0.5, { color: "#66d9ff", position: [0, 2, 0] })
engine.add(ground, player)

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
followCamera(engine, player, {
  behind: false,
  distance: 7,
  height: 4,
  stiffness: 7,
})

engine.start()

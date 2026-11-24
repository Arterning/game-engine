export const examples = {
  tween: `import { createTweens, ease } from "@game-engine/runtime"

const tweens = createTweens()
const point = { y: 0 }
const done = tweens.to(point, { y: 10 }, {
  duration: 0.5,
  delay: 0.25,
  ease: ease.outCubic,
  onUpdate(progress, target) {
    console.log("进度", progress, "高度", target.y)
  },
})

tweens.step(0.125)
console.log("延迟阶段的高度", point.y)
tweens.step(0.25)
tweens.step(0.375)
done.then((target) => console.log("补间完成", target))
`,
  cube: `import { createEngine, createTweens, ease, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [4, 3, 6],
  lookAt: [0, 1, 0],
})
lights.daylight(engine.scene)
const cube = models.box(1, {
  color: "#66d9ff",
  position: [0, 0.5, 0],
})
engine.add(models.ground(24), cube)
const tweens = createTweens(engine)

engine.onUpdate((dt) => { cube.rotation.y += dt })
engine.start()

async function bounce() {
  while (true) {
    await tweens.to(cube.position, { y: 2 }, {
      duration: 0.6,
      ease: ease.outCubic,
    })
    await tweens.to(cube.position, { y: 0.5 }, {
      duration: 0.6,
      ease: ease.outBounce,
    })
    await tweens.wait(0.35)
  }
}
bounce()
`,
}

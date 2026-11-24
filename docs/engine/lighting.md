# `engine/lighting.js` 源码解析

上一篇换了材质来观察反光。这一篇固定物体和材质，只换灯。读完你应该能分辨平行光、半球光、聚光灯和点光源，知道怎么调阴影的覆盖范围，也能让一盏灯随角色移动。模块里的方法通过公共入口的 `lights` 使用，例如 `lights.daylight(engine.scene)`。 [lighting.js 源码](../../engine/lighting.js) · [materials.js 讲义](materials.md) · [公共入口](../../engine/index.js#L25)

打开 `engine-lab` 的「代码实验台」，每次把一整段示例替换进左侧。右侧预览里的按钮可以直接点。

## 1. `daylight()`、`sunset()` 与 `night()` · 换一套室外布光

光照先要看**方向**和**作用范围**。平行光 `DirectionalLight` 模拟许多平行的光线。改变它的位置和目标之间的连线就会改变照射方向，沿同一方向把灯移远则不会产生点光源那种距离衰减。半球光 `HemisphereLight` 给朝上的表面更多天空色、给朝下的表面更多地面色，用来补足主灯照不到的部分。为了读源码，可以把这些灯分成主光、补光与轮廓光。补光抬起暗面，轮廓光通常从后侧勾出物体边缘。 [Three.js DirectionalLight](https://threejs.org/docs/pages/DirectionalLight.html)

三种室外预设都调用内部的 `addSun()` 创建主光，再额外创建补光。

| 方法 | 主光 | 补光与返回值 |
| --- | --- | --- |
| [`daylight(scene, options)`](../../engine/lighting.js#L58) | 暖白色、强度 2.8，继承 `addSun()` 的位置 `[8, 14, 6]`。 | 蓝色天空与棕色地面组成半球光。返回 `{ sun, sky }`。 |
| [`sunset(scene, options)`](../../engine/lighting.js#L70) | 橙色、强度 3.2，位置 `[14, 6, 4]`，光线更接近水平，地面上通常能看到更长的影子。 | 紫色与深棕色半球光，加一盏从另一侧照过来的蓝色平行光。返回 `{ sun, sky, rim }`。 |
| [`night(scene, options)`](../../engine/lighting.js#L89) | 冷蓝色、强度 0.9，位置 `[-6, 12, -4]`。 | 暗蓝色半球光。返回 `{ moon, sky }`，其中 `moon` 仍然是平行光。 |

三者都把 `...options` 展开到传给 `addSun()` 的对象末尾。因此 `intensity`、`position`、`shadows` 等选项覆盖的是主光设置。要改补光，用返回对象的 `sky.intensity` 等属性。预设直接把灯加进传入的场景，多次调用会同时留下多套灯。下面用一个独立的 `Group` 保存每套灯及其目标，切换时只将当前组加进场景。

### 示例 · 同一个场景从白天切到夜晚

**会看到什么**。点击右下角按钮，方块、球和地面的颜色与阴影会在日光、夕阳和月光之间切换。相机和背景颜色保持相同，方便比较灯光造成的变化。

```js
import { Group } from "three"
import { createEngine, createHud, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#283549",
  cameraPosition: [5, 4, 8],
  lookAt: [0, 0.8, 0],
})
engine.add(
  models.ground(20),
  models.box([1.1, 1.6, 1.1], { color: "#dddddd", position: [-1.2, 0.8, 0] }),
  models.sphere(0.65, { color: "#dddddd", position: [1.1, 0.65, 0] })
)

const presets = [
  { name: "日光", factory: lights.daylight },
  { name: "夕阳", factory: lights.sunset },
  { name: "月光", factory: lights.night },
].map(({ name, factory }) => {
  const group = new Group()
  factory(group, { area: 9, mapSize: 1024 })
  return { name, group }
})

let active = 0
engine.add(presets[active].group)
const hud = createHud({ container: engine.container })
const toggle = hud.button("日光 · 点击切换", () => {
  engine.remove(presets[active].group)
  active = (active + 1) % presets.length
  const { name, group } = presets[active]
  engine.add(group)
  toggle.element.textContent = `${name} · 点击切换`
})
engine.start()
```

试着在 `factory(group, ...)` 后面保留它的返回值，把 `sky.intensity` 设成 0 再运行。注意比较背光的一面，那里更容易看出半球光的作用。

## 2. 内部函数 `addSun()` · 光照方向与阴影相机

`addSun(scene, options)` 创建并返回一盏 `DirectionalLight`。它把灯放在 `position`，把灯的目标放在 `target`，两者都加入场景。目标默认是 `[0, 0, 0]`，方向由灯的位置指向目标。源码用 `sun.target.position` 控制这个方向，所以调灯的 `rotation` 不会把光束转过去。 [addSun 源码](../../engine/lighting.js#L19) · [Three.js DirectionalLight.target](https://threejs.org/docs/pages/DirectionalLight.html#target)

启用 `shadows` 时，Three.js 还会从灯的角度绘制一张**阴影贴图**，记录光线方向上遇到的遮挡。用户相机绘制场景时，通过这张图判断某处是否被挡光。这里有两台不同的相机。玩家相机决定屏幕上看见什么，平行光自己的阴影相机决定哪些位置参与投影。

- **`area`** 默认 24。它把阴影相机的左右和上下边界设为 `-area` 到 `+area`，所以覆盖宽高是 `2 * area`，方向随主光对准目标。这个范围用的是灯的视角，与地面上的世界坐标范围不一定重合。近平面是 0.5，远平面由 `position` 向量的长度加上两倍 `area` 得出。
- **`mapSize`** 默认 2048，表示阴影贴图的像素宽高。覆盖区域扩大但像素数固定时，每个像素对应的世界范围就变大，边缘通常会变粗。想提高精度可以适当缩小覆盖范围，或提高贴图分辨率。
- **`bias` 和 `normalBias`** 分别设为 `-0.0004` 与 `0.02`。它们给阴影深度比较留出一点偏移，减轻表面误判为被自己遮挡时产生的条纹。偏移过大时，阴影可能看起来和物体脚底分离。

要看到投影，还要满足这几处开关：渲染器的 `shadowMap.enabled`、灯的 `castShadow`、遮挡物的 `castShadow`、地面的 `receiveShadow`。`createEngine()` 默认启用渲染器阴影，`models.box()` 和 `models.ground()` 默认已经设置这次实验需要的网格标志。 [阴影配置源码](../../engine/lighting.js#L36) · [Three.js DirectionalLightShadow](https://threejs.org/docs/pages/DirectionalLightShadow.html) · [models.js 讲义](models.md)

### 示例 · 缩小阴影覆盖范围

**会看到什么**。开始时两只箱子都会在地面投影。点击「缩小覆盖」后，远处的箱子仍被主光照亮，但它的影子会消失，近处箱子保留投影。

```js
import { createEngine, createHud, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#344458",
  cameraPosition: [0, 6, 10],
  lookAt: [0, 0, 0],
})
engine.add(
  models.ground(24, { color: "#7b8798", accent: "#687485" }),
  models.box([1, 1.5, 1], { position: [0, 0.75, 0], color: "#ffb866" }),
  models.box([1, 1.5, 1], { position: [4, 0.75, 0], color: "#79c9ff" })
)

const { sun } = lights.daylight(engine.scene, {
  position: [0, 8, 4],
  area: 7,
  mapSize: 512,
})
const shadowCamera = sun.shadow.camera
const hud = createHud({ container: engine.container })
const toggle = hud.button("缩小覆盖", () => {
  const area = shadowCamera.right > 3 ? 2 : 7
  shadowCamera.left = shadowCamera.bottom = -area
  shadowCamera.right = shadowCamera.top = area
  shadowCamera.updateProjectionMatrix()
  toggle.element.textContent = area === 2 ? "扩大覆盖" : "缩小覆盖"
})
engine.start()
```

灯的位置在 X 轴上是 0，主要沿 Y 和 Z 方向照向原点。将阴影相机左右边界缩到 ±2 时，位于 `x = 4` 的箱子和它的投影出了范围。这个按钮只改变阴影相机的裁剪范围，照明方向和玩家相机都没变。想对比分辨率，可把初始 `mapSize` 从 512 改成 128，重新运行并观察影缘。

## 3. `studio()` 与 `moody()` · 棚拍和聚光

**`studio(scene, { intensity })`** 创建三盏平行光和一盏环境光。主光 `key` 在右前方，亮度是 `3 * intensity`，也是这组唯一开启投影的灯。补光 `fill` 在左前方，亮度是 `1 * intensity`。轮廓光 `rim` 在背后，亮度是 `1.6 * intensity`。最后用 `0.35 * intensity` 的环境光 `ambient` 提供无方向的基础亮度。它返回 `{ key, fill, rim, ambient }`，方便单独改灯。主光使用 1024×1024 的阴影贴图，阴影相机保留 Three.js 默认范围。 [studio 源码](../../engine/lighting.js#L106)

**`moody(scene, { color, intensity })`** 创建一盏位于 `[4, 12, 4]` 的聚光灯，以及一盏暗蓝色环境光，返回 `{ key, ambient }`。聚光灯从一点向目标打出锥形光束，源码用 `intensity * 30` 作为灯的强度，最大距离为 60，半锥角为 `Math.PI / 5`，也就是 36 度。半影参数 0.6 让锥形光束边缘渐淡，衰减参数 1.6 控制灯光随距离变弱的方式。环境光有自己固定的颜色和强度。和 `addSun()` 一样，聚光灯及它的目标都会被加进场景。 [moody 源码](../../engine/lighting.js#L128) · [Three.js SpotLight](https://threejs.org/docs/pages/SpotLight.html)

### 示例 · 从棚拍切到一束会移动的灯

**会看到什么**。初始时，白色物体的多个面都能看清。点击「切换到聚光」，场景转成暗场中的橙色光斑，光斑在地面缓慢扫动。

```js
import { Group } from "three"
import { createEngine, createHud, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#182332",
  cameraPosition: [5, 5, 8],
  lookAt: [0, 0.7, 0],
})
engine.add(
  models.ground(20, { color: "#747d89", accent: "#68717e" }),
  models.box([1.3, 1.5, 1.3], { color: "#e5e7eb", radius: 0.12, position: [0, 0.75, 0] }),
  models.sphere(0.55, { color: "#e5e7eb", position: [-2, 0.55, 0] })
)

const studioRig = new Group()
lights.studio(studioRig, { intensity: 0.65 })
const spotRig = new Group()
const { key } = lights.moody(spotRig, { color: "#ffa05c", intensity: 3.8 })
key.position.set(0, 4, 2)
key.angle = Math.PI / 9
engine.add(studioRig)

let useSpot = false
const hud = createHud({ container: engine.container })
const toggle = hud.button("切换到聚光", () => {
  engine.remove(useSpot ? spotRig : studioRig)
  useSpot = !useSpot
  engine.add(useSpot ? spotRig : studioRig)
  toggle.element.textContent = useSpot ? "切换到棚拍" : "切换到聚光"
})

engine.onUpdate((dt, elapsed) => {
  key.target.position.x = Math.sin(elapsed * 1.4) * 2
})
engine.start()
```

试着把 `key.angle` 从 `Math.PI / 9` 改回预设的 `Math.PI / 5`，看地面光斑变宽。再把 `key.penumbra` 设成 0，比较光斑边缘的软硬。`key.target.position.x` 改的是聚光灯的朝向，所以灯留在原处，地面的受光区域仍会移动。

## 4. `attachLight()` · 给移动物体挂一盏灯

`attachLight(object, options)` 创建一盏 `PointLight`。点光源像一只裸灯泡，从所在点向各个方向发光。默认是橙色、强度 8、最大距离 12，衰减参数固定为 2。源码把 `offset` 写进 `light.position`，再通过 `object.add(light)` 将它变成子节点。默认偏移 `[0, 1, 0]` 是父物体局部坐标中的位置，父物体平移或旋转时，灯会一起变换。函数返回灯本身，可以在之后修改 `intensity`、`distance` 或 `color`。默认关闭点光源投影。 [attachLight 源码](../../engine/lighting.js#L156) · [Three.js PointLight](https://threejs.org/docs/pages/PointLight.html)

### 示例 · 让提灯照亮沿途的箱子

**会看到什么**。橙色小灯来回移动，沿途箱子会在靠近灯时亮起来。按钮可以关掉点光源，画面上仍能看到表示灯泡位置的橙色小球，便于观察两者各自负责什么。

```js
import { AmbientLight, Group } from "three"
import { createEngine, createHud, lights, materials, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#121b2b",
  cameraPosition: [0, 3.5, 8],
  lookAt: [0, 0.7, 0],
})
engine.add(models.ground(20), new AmbientLight("#ffffff", 0.2))
for (const x of [-2.4, 0, 2.4]) {
  engine.add(models.box(0.9, { color: "#dedbd5", position: [x, 0.45, 0] }))
}

const carrier = new Group()
const offset = [0.65, 1.15, 0]
const bulb = models.sphere(0.14, {
  position: offset,
  material: materials.flat("#ffa052"),
})
carrier.add(bulb)
const lamp = lights.attachLight(carrier, {
  offset,
  color: "#ffb36b",
  intensity: 22,
  distance: 4,
})
engine.add(carrier)

const hud = createHud({ container: engine.container })
const toggle = hud.button("关灯", () => {
  lamp.intensity = lamp.intensity > 0 ? 0 : 22
  toggle.element.textContent = lamp.intensity > 0 ? "关灯" : "开灯"
})
engine.onUpdate((dt, elapsed) => {
  carrier.position.set(Math.sin(elapsed * 1.25) * 3, 0, 0.9)
  carrier.rotation.y = Math.sin(elapsed * 0.9)
})
engine.start()
```

灯泡网格用了 `materials.flat()`，负责画出一个看得见的小球。相同局部位置上的 `PointLight` 负责照亮箱子。试着把 `distance: 4` 改成 2，观察灯走到离箱子更近时，箱子才明显变亮。改 `offset` 的 X 值，则能看到灯泡和灯一起从载体旋转中心伸出去。

## 5. `blobShadow()` · 做一个跟随物体的地面软影

`blobShadow(scene, target, options)` 先在 128×128 的 Canvas 里画径向渐变，中心为半透明黑色，边缘完全透明。把它作为平面网格的贴图，使用不受光的基本材质并关闭深度写入，再将平面旋转到地面所在的 XZ 平面。平面整体宽高都是 `radius * 2`，默认 `radius = 0.6`。它被直接加进场景，保持水平，即使目标物体转动或倾斜也能贴地。 [blobShadow 源码](../../engine/lighting.js#L186)

- **`mesh`** 是可访问的阴影平面。这里的暗斑是绘制出来的半透明图案，与上一节使用光源和遮挡计算的影子用途不同。它适合作为角色的落地提示。
- **`update(groundY = 0)`** 通过 `target.getWorldPosition(world)` 得到目标的世界坐标，即使目标挂在其他组下面也能跟对。平面的 X、Z 跟随目标，Y 固定为 `groundY + y`，默认 `y = 0.01` 让它略高于地面。接着计算 `fade = max(0, 1 - max(0, world.y - groundY) / fadeHeight)`。透明度设为 `opacity * fade`，缩放设为 `0.65 + fade * 0.35`。以默认 `fadeHeight = 6` 为例，目标离地 3 个单位时，透明度降到设定值的一半，半径缩为原来的 82.5%。
- **`dispose()`** 释放平面的几何体、纹理与材质，再从场景移除它。若你把 `update` 注册进引擎循环，清理时也要执行自己保存的回调注销函数。

没有自动更新。通常先在 `onUpdate` 移动角色，再用 `onLateUpdate` 调 `shadow.update(groundY)`，这样暗斑使用的是当前帧已经更新过的位置。 [update 与 dispose 源码](../../engine/lighting.js#L213)

### 示例 · 球跳高，暗斑留在地上

**会看到什么**。球左右移动并周期性跳起。它下面的暗斑沿地面移动，球越高，暗斑越小、越淡。这里关掉了真实投影，方便单独观察暗斑。

```js
import { Group } from "three"
import { createEngine, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#2a3b4c",
  cameraPosition: [0, 4, 8],
  lookAt: [0, 1.1, 0],
  shadows: false,
})
lights.daylight(engine.scene, { shadows: false })
engine.add(models.ground(20, { color: "#a9aaac", accent: "#93979c" }))

const carrier = new Group()
const ball = models.sphere(0.46, { color: "#5bbcf7", position: [0, 0.46, 0] })
carrier.add(ball)
engine.add(carrier)

const shadow = lights.blobShadow(engine.scene, carrier, {
  radius: 0.95,
  opacity: 0.78,
  fadeHeight: 3,
})
engine.onUpdate((dt, elapsed) => {
  carrier.position.x = Math.sin(elapsed) * 2.4
  carrier.position.y = Math.abs(Math.sin(elapsed * 1.7)) * 2.1
})
engine.onLateUpdate(() => {
  shadow.update(0)
})
engine.start()
```

球作为子节点放在 `y = 0.46`，父组的原点因此落在球的底部。用父组作为阴影目标时，刚落地会得到完整的暗斑。把 `fadeHeight` 调到 1.5，球跳到高处时暗斑会完全消失。试着将目标换成 `ball`，暗斑从落地时就会浅一点，因为函数此时拿球心高度来算衰减。

## 下一篇读什么

到这里已经能造物体、设材质并布光。接下来可以读 `input.js`，把按键或指针输入接进帧循环，再让玩家亲手移动场景里的物体。 [input.js 源码](../../engine/input.js)

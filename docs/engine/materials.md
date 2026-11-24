# `engine/materials.js` 源码解析

上一篇用同一个 `models.box()` 造出了不同尺寸的方块。这一篇保留形状，换掉它的表面。**材质**决定表面如何响应灯光、是否像金属、能不能透光。**纹理**是一张材质可读取的图片，既可以给表面上色，也可以用来表示粗糙度等数据。本文件的纹理由代码画出来，可以直接在实验台运行。

从 `lab` 打开「代码实验台」，每次把一整段示例代码粘到左侧。每个示例都跟在对应的源码解释后面。 [materials.js 源码](../../engine/materials.js) · [models.js 讲义](models.md)

## 1. `brand`、`palette`、`mix()` 和 `shade()` · 先选颜色

`brand` 保存项目自己的色值，比如橙色 `ember`，深灰色 `slate`。创建 `palette` 时先展开 `brand`，再添加通用游戏颜色，所以两份色表都能查到 `ember`。它们的值是十六进制颜色字符串，下面两个方法则返回 `THREE.Color` 对象，可以直接交给材质。

- **`mix(a, b, t)`** 创建两个 `THREE.Color`，用第一个颜色的 `lerp()` 向第二个颜色插值。三个颜色分量各走从起点到终点的比例 `t`，`t = 0` 时取起点，`t = 1` 时取终点。函数本身没有限制 `t` 的范围。Three.js 的颜色对象使用工作色彩空间保存颜色，因此屏幕上看到的中间色和直接平均十六进制 RGB 字节可能不同。
- **`shade(color, amount)`** 读取颜色的 HSL。H 是色相，S 是饱和度，L 是明度。函数保留前两项，将明度改为 `clamp(l + amount, 0, 1)`，再写回颜色对象。例如 `amount = 0.2` 表示给明度加 0.2。

[色表与颜色方法源码](../../engine/materials.js#L13)

### 示例 · 用同一个橙色做三块色样

**会看到什么**。中间是品牌橙，左侧是降低明度的颜色，右侧是向白色混合后的颜色。`flat()` 用基本材质直接显示颜色，下一节会对比它和受光材质。

```js
import { createEngine, materials, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#263241",
  cameraPosition: [0, 0, 6],
  lookAt: [0, 0, 0],
})
const { brand, palette, mix, shade, flat } = materials
const colors = [
  shade(brand.ember, -0.2),
  brand.ember,
  mix(brand.ember, palette.white, 0.5),
]

colors.forEach((color, i) => {
  engine.add(models.box(1, {
    position: [(i - 1) * 1.35, 0, 0],
    material: flat(color, { toneMapped: false }),
  }))
})
engine.start()
```

把第三块改成 `shade(brand.ember, 0.2)`，比一比「向白色混合」和「提高 HSL 明度」的画面。两种方法得到的浅色并不相同。

## 2. `standard()`、`matte()`、`metal()`、`glow()` 与 `flat()` · 同一个球怎样受光

**粗糙度** `roughness` 可以先理解成反光有多散。值低时高光更集中，值高时高光更宽、更柔和。**金属度** `metalness` 决定材质怎样分配漫反射和镜面反射。接近纯金属时，表面主要靠反射呈现颜色，环境太暗就容易看上去发黑。 [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)

| 方法 | 内部创建什么 | 源码里的主要设置 |
| --- | --- | --- |
| [`standard(options)`](../../engine/materials.js#L63) | `MeshStandardMaterial` | 默认 `palette.mist`、粗糙度 0.75、金属度 0。先用 `new THREE.Color(color)` 处理颜色，再展开剩余选项，允许覆盖默认属性。 |
| [`matte(color, options)`](../../engine/materials.js#L74) | 调用 `standard()` | 粗糙度提高到 0.95，金属度保持 0。`models.box()` 等模型工厂默认用它。 |
| [`metal(color, options)`](../../engine/materials.js#L78) | 调用 `standard()` | 粗糙度降到 0.28，金属度为 1。有可反射的光源或环境时更容易看清高光。 |
| [`glow(color, options)`](../../engine/materials.js#L83) | 调用 `standard()` | 设置同色自发光，默认强度 1.6、粗糙度 0.4。`intensity` 转成 `emissiveIntensity`，其他选项继续传给 `standard()`。 |
| [`flat(color, options)`](../../engine/materials.js#L96) | `MeshBasicMaterial` | 直接用颜色和贴图显示表面，场景灯光的移动不会改变它的明暗。 |

`glow()` 让物体自身看起来亮。周围物体要被照亮需要灯光，想看到亮色溢出物体边缘则可以使用 `createPostFX()` 的辉光效果。 [postfx.js](../../engine/postfx.js)

### 示例 · 让同一盏灯扫过五个球

**会看到什么**。从左到右依次为标准、哑光、金属、自发光和纯色材质。它们共用相同尺寸与底色。光扫过时，左侧三个球的受光效果不同，自发光球暗面仍然亮，最右边的纯色球保持原样。

```js
import { AmbientLight, PointLight } from "three"
import { createEngine, materials, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#202a37",
  cameraPosition: [0, 1.5, 8],
  lookAt: [0, 0.8, 0],
})
const c = "#f99c58"
const surfaces = [
  materials.standard({ color: c }),
  materials.matte(c),
  materials.metal(c),
  materials.glow(c),
  materials.flat(c),
]

surfaces.forEach((material, i) => {
  engine.add(models.sphere(0.54, {
    position: [(i - 2) * 1.33, 0.8, 0],
    material,
  }))
})
const lamp = new PointLight("#ffffff", 65)
engine.add(new AmbientLight("#ffffff", 0.25), lamp)
engine.onUpdate((dt, elapsed) => {
  lamp.position.set(Math.sin(elapsed * 1.5) * 3.8, 2.6, 2.3)
})
engine.start()
```

先把 `lamp` 的强度从 65 改成 0，比较哪些球变化最大。再恢复灯光，把 `materials.metal(c)` 改成 `materials.metal(c, { roughness: 0.7 })`，观察金属高光怎样变化。这里使用发光材质，但没有加辉光链，注意比较的是**球的表面亮度**。

## 3. `toon()`、`wireframe()` 与 `outline()` · 改变光影和轮廓的画法

- **`toon(color, steps = 4, options)`** 用 `Uint8Array` 存储从 0 到 255 的亮度样本。四级时数组是 `[0, 85, 170, 255]`。将它变成宽 `steps`、高 1 的单通道 `DataTexture`，把两个过滤器设成 `NearestFilter`，让取样落在某个亮度级上，再交给 `MeshToonMaterial.gradientMap`。于是灯光过渡会呈现几档明显的色带。这个公式用 `steps - 1` 作分母，比较时传入至少 2 档。
- **`wireframe(color, options)`** 创建开启 `wireframe` 的 `MeshBasicMaterial`。Three.js 用线画出三角网格的边，所以方块每个面往往还能看见一条对角线。
- **`outline(mesh, options)`** 共享原网格的几何体，用只绘制背面的 `MeshBasicMaterial` 创建一个子网格。放大倍数是 `1 + thickness`，默认 `1.04`。从正面看，放大后的背面在原物体边缘露出一圈。外壳作为子节点跟随原网格的变换，函数已调用 `mesh.add(shell)`，返回的就是外壳。相同的缩放比例会在更大的物体上形成更宽的世界空间边缘。

[卡通、线框与描边源码](../../engine/materials.js#L104)

### 示例 · 色带、描边和三角网格

**会看到什么**。左边的卡通球只有几档明暗变化，外面有一圈深色轮廓。右边的方块显示组成表面的三角形边线。

```js
import { DirectionalLight } from "three"
import { createEngine, materials, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#627990",
  cameraPosition: [0, 1.3, 6],
  lookAt: [0, 0, 0],
})
const sphere = models.sphere(0.72, {
  material: materials.toon("#64c7ff", 3),
  position: [-1.05, 0, 0],
})
materials.outline(sphere, { color: "#111827", thickness: 0.08 })
const cube = models.box(1.2, {
  material: materials.wireframe("#ffcb74"),
  position: [1.05, 0, 0],
})
const light = new DirectionalLight("#ffffff", 2)
light.position.set(-3, 4, 3)
engine.add(sphere, cube, light)
engine.onUpdate((dt) => {
  cube.rotation.y += dt
  cube.rotation.x += dt * 0.6
})
engine.start()
```

把 `toon` 的 3 改成 6，看球面多出多少级过渡。再改变描边的 `thickness`。右边若改用 `flat()`，相同的几何体就会从线框变回实心表面。

## 4. `glass()` · 看见物体背后的图案

`glass(color, options)` 用 `MeshPhysicalMaterial`，设置 `roughness = 0.05`、`metalness = 0`、`transmission = 0.95`、`thickness = 0.5`、`ior = 1.4`，最后展开 `options`。其中 `transmission` 决定透过材质的程度，`thickness` 和折射率 `ior` 参与透射效果的计算。观察时最好在玻璃后面放一个有图案的物体，图案变化比纯色背景更容易看出来。 [glass 源码](../../engine/materials.js#L118) · [Three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)

### 示例 · 从两个球观察背板

**会看到什么**。透过左边的玻璃球还能看见后方的条格，图案在球内变形。右边用相同的工厂将透射设为 0，背板被球遮住。

```js
import { createEngine, lights, materials, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#202b3a",
  cameraPosition: [0, 0.8, 6],
  lookAt: [0, 0.8, 0],
})
lights.studio(engine.scene)
const board = models.box([5, 2.8, 0.12], {
  position: [0, 0.8, -1.8],
  material: materials.flat("#ffffff", {
    map: materials.checkerTexture({ squares: 12, light: "#ffd191", dark: "#285779" }),
  }),
})
const glass = models.sphere(0.72, {
  position: [-1, 0.8, 0],
  material: materials.glass("#ffffff", { thickness: 1.2 }),
})
const opaque = models.sphere(0.72, {
  position: [1, 0.8, 0],
  material: materials.glass("#b8d4f2", { transmission: 0 }),
})
engine.add(board, glass, opaque)
engine.start()
```

把左球的 `thickness` 改为 0.1，观察变形幅度。再把 `roughness` 改成 0.5，看透过球看到的图案怎样变模糊。右球是对照组。

## 5. `canvasTexture()`、`checkerTexture()`、`gridTexture()` 和 `noiseTexture()` · 生成可平铺图案

### 内部函数 `canvasTexture(size, draw)`

先创建一块正方形的离屏 Canvas，拿到 2D 绘图上下文并调用 `draw(ctx, size)`，随后用 `new THREE.CanvasTexture(canvas)` 把它交给 Three.js。工厂把色彩空间设为 sRGB，两个纹理方向都设为 `RepeatWrapping`，并配置各向异性过滤级别为 8，帮助斜视时看清纹理细节，实际支持的级别取决于设备。

几何体的 **UV** 是表面对应到纹理的位置。可以把 `u` 和 `v` 想成图片上的两根坐标轴。`repeat.set(2, 2)` 让纹理在两个方向各重复两次。纹理自身画了多少格，由生成函数的参数决定。重复几遍，则由贴到表面时的纹理设置决定。 [canvasTexture 源码](../../engine/materials.js#L159) · [Three.js CanvasTexture](https://threejs.org/docs/pages/CanvasTexture.html)

### 三种图案在内部怎样画

- **`checkerTexture(options)`** 先算每格的像素边长 `size / squares`，再遍历行和列。通过 `(x + y) % 2` 交替选择深色和浅色，用 `fillRect` 填满每格。默认画布为 512×512，横竖各 8 格。
- **`gridTexture(options)`** 先填满背景色。用 `size / divisions` 算线距，每次迭代各画一条横线和竖线。`lineWidth` 的单位是纹理画布像素，默认是 2。`divisions` 默认是 8，控制网格的划分数。
- **`noiseTexture(options)`** 创建一个 RGBA 像素数组，逐像素计算平滑噪声。默认 `scale = 32` 把图像坐标换算到较粗的采样网格，值越大，同一块纹理上会出现越多细小变化。`contrast` 围绕 0.5 拉开或缩小明暗差，再把亮度限制在 0 到 1。最后用亮度乘 `tint` 的颜色分量，将结果写入 RGB，透明度写成 255，并用 `putImageData` 放回 Canvas。本实现用通用帮助函数返回 sRGB 纹理，作为粗糙度等数据贴图时，应按数据贴图的要求调整色彩空间。

噪声有两个内部辅助函数。**`hashNoise(x, y)`** 用网格整数坐标计算确定的伪随机值，并放进模块级 `Map`。同一个角点会被附近很多像素读取，缓存可以省掉重复计算。**`smoothNoise(x, y)`** 找到包围采样点的四个网格角，取出各自的值。它用 `f² × (3 - 2f)` 平滑两个方向的小数进度，先沿 X 混合左右两角，再沿 Y 混合上下两条结果。这样相邻像素共享同一组角点，画面就会形成连贯的斑块。 [棋盘、网格与噪声源码](../../engine/materials.js#L174) · [噪声辅助函数](../../engine/materials.js#L241)

### 示例 · 把三种纹理贴到相同的板子上

**会看到什么**。左边是棋盘，中间是橙色网格，右边是绿色噪声。三块板用相同的几何体和基本材质，你看到的表面差别来自 `map`。

```js
import { createEngine, materials, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#192333",
  cameraPosition: [0, 0, 7],
  lookAt: [0, 0, 0],
})
const maps = [
  materials.checkerTexture({ squares: 4, light: "#e2e8f0", dark: "#64748b" }),
  materials.gridTexture({ divisions: 6, lineWidth: 5 }),
  materials.noiseTexture({ scale: 12, contrast: 1.6, tint: "#8fd6a0" }),
]
maps[0].repeat.set(2, 2)

maps.forEach((map, i) => {
  engine.add(models.box([1.65, 1.65, 0.08], {
    position: [(i - 1) * 1.95, 0, 0],
    material: materials.flat("#ffffff", { map, toneMapped: false }),
  }))
})
engine.start()
```

先把 `repeat.set(2, 2)` 改成 `repeat.set(1, 1)`，左板每边会从 8 格变成 4 格。再调整右板的 `scale` 和 `contrast`。前者改变斑块尺寸，后者改变明暗差。材质底色用白色，贴图颜色不容易被底色染偏。

## 6. `gradientTexture()`、`skyGradient()`、`sparkTexture()` 与 `textTexture()`

- **`gradientTexture(stops, options)`** 使用 `canvasTexture`，在 Canvas 上从顶到底创建线性渐变。传入 `[[0, colorA], [0.4, colorB], [1, colorC]]` 可以明确指定颜色位置。代码只把数字当成显式偏移量。对象形式会先经 `Object.entries()`，键是字符串，所以实际上用枚举顺序等距分布颜色。想精确控制位置时用数组，位置传 0 到 1。
- **`skyGradient(scene, top, bottom)`** 调用 `gradientTexture([[0, top], [1, bottom]])`，设置 `scene.background` 并返回纹理。它覆盖的是背景。场景里物体的光照仍然由灯光或环境贴图决定。
- **`sparkTexture(options)`** 单独建画布并画径向渐变。半径从画布中心 0 扩到半个画布，透明度从中心的 1，经 `0.4 / softness` 处的 0.55，降到边缘的 0。默认 `softness = 1`。值变大时，中间透明度停靠点向中心靠拢。因为 Canvas 渐变要求停靠点在 0 到 1 之间，传小于 0.4 的值会让这个计算越界。本方法直接返回 sRGB 的 `CanvasTexture`，保留默认环绕方式。
- **`textTexture(text, options)`** 先设置字体，用 `measureText()` 取文字宽度，再给左右各加 `padding`。画布高度固定为 `128 + padding * 2`。调整 Canvas 尺寸会重置绘图状态，所以源码获取上下文后重新设置字体，按 `background` 决定是否填底，最后居中画字。若传了很大的字体，固定高度可能裁掉文字，可同时增大边距。`models.label()` 就用它为 Sprite 生成文字贴图。

[渐变、火花和文字纹理源码](../../engine/materials.js#L267) · [skyGradient 源码](../../engine/materials.js#L350)

### 示例 · 背景渐变、发光贴图与场景文字

**会看到什么**。画面有一层由上到下的天空渐变。左边是用三种颜色做渐变的色板，右边是一团随时间呼吸的柔光，上方有一行贴到 3D 场景中的文字。

```js
import { Sprite, SpriteMaterial } from "three"
import { createEngine, materials, models } from "@game-engine/runtime"

const engine = createEngine({
  cameraPosition: [0, 0, 7],
  lookAt: [0, 0, 0],
})
materials.skyGradient(engine.scene, "#121a36", "#653d55")

const ramp = materials.gradientTexture([
  [0, "#fbbf24"],
  [0.35, "#f43f5e"],
  [1, "#4338ca"],
])
const board = models.box([1.35, 1.7, 0.08], {
  position: [-1.05, -0.25, 0],
  material: materials.flat("#ffffff", { map: ramp, toneMapped: false }),
})

const spark = new Sprite(new SpriteMaterial({
  map: materials.sparkTexture({ softness: 1 }),
  color: "#ffd687",
  transparent: true,
  depthWrite: false,
}))
spark.position.set(1.2, -0.25, 0)
spark.scale.set(1.7, 1.7, 1)

const text = materials.textTexture("TEXTURE LAB", {
  color: "#ffffff",
  background: "#202945",
  padding: 18,
})
const title = new Sprite(new SpriteMaterial({ map: text, transparent: true }))
const textHeight = 0.52
title.position.y = 1.25
title.scale.set(textHeight * text.image.width / text.image.height, textHeight, 1)

engine.add(board, spark, title)
engine.onUpdate((dt, elapsed) => {
  spark.material.opacity = 0.65 + Math.sin(elapsed * 3) * 0.35
})
engine.start()
```

把色板中玫红色的偏移从 0.35 改成 0.7，观察颜色交界怎样移动。再把 `softness` 提到 2，观察光斑亮度分布。示例的呼吸动画每帧只改 `material.opacity`，纹理画布在创建精灵时只画了一次。

## 下一篇读什么

接下来可以读 `lighting.js`。先回到第二节的五个球，把同一组材质放进不同的灯光配置，就能看到光源位置、亮度和阴影怎样与材质配合。 [lighting.js 讲义](lighting.md)

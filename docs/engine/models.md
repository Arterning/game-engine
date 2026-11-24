# `engine/models.js` 源码解析

上一篇的旋转方块是用 `new Mesh(new BoxGeometry(...), material)` 手工造的。现在从 `models.box()` 进去，看看项目如何把这几步变成可复用的工厂，再用方块、圆柱和圆锥拼出角色、车和树。读完后，你应该能决定什么时候用一个网格、什么时候把零件放进组，以及什么时候需要实例化或对象池。 [engine.js 讲义](engine.md) · [models.js 源码](../../engine/models.js)

在 `lab` 打开「代码实验台」。每次把一整段代码替换进左侧编辑器，右侧就会显示场景。

## 1. `build()` 与 `castShadows()`

一个 **Mesh（网格）** 把 `geometry`、`material` 与自己的位置、旋转、缩放放在一起。几何体保存形状数据，材质决定表面怎样画。同一个几何体和材质可以被多个网格引用，每个网格仍拥有自己的位置。**Group（组）** 可以容纳多个网格或其他组。移动组时，子对象的局部坐标值保持原样，它们在场景中的实际位置随组移动。

内部函数 `build(geometry, material, position)` 创建 `new THREE.Mesh(geometry, material)`。传了 `[x, y, z]` 就展开数组调用 `mesh.position.set()`，然后开启投影和接收阴影，返回该网格。六个基础形状都用这个函数收尾。

公开方法 `castShadows(object, cast = true, receive = true)` 用 `traverse()` 访问根对象和全部子孙节点，只修改 `isMesh` 为真的对象。传入一辆车的组，就能统一修改车身、车顶和轮子。它返回原对象。要实际看见阴影，还需要启用渲染器的阴影、配置会投影的灯，以及让接收阴影的表面进入灯的阴影范围。 [build 与 castShadows 源码](../../engine/models.js#L27)

## 2. 基础形状、地面与围墙

以下六个形状接受 `options.position`、`options.color`、`options.material`。显式提供材质时会直接使用它，默认材质才由 `matte(color)` 创建。尺寸一律先改变几何体，再由 `build()` 放置网格。

| 方法 | 内部怎样造形状 | 读代码时留意 |
| --- | --- | --- |
| [`box(size = 1, options)`](../../engine/models.js#L48) | 数字展开成三边等长，数组依次给出宽、高、深。普通版用 `BoxGeometry`，圆角版用 `RoundedBoxGeometry`。 | `options.radius` 默认为 0。圆角半径最多是最短边的一半。把 `[2, 1, 0.5]` 放在 `y = 0.5`，底面刚好贴着地面。 |
| [`sphere(radius = 0.5, options)`](../../engine/models.js#L68) | 用 `SphereGeometry(radius, segments, segments / 2)` 构造球。 | 默认 `segments = 24`，水平方向 24 段、竖直方向 12 段。减少分段能看到轮廓变成明显的折线。 |
| [`cylinder(radius = 0.5, height = 1, options)`](../../engine/models.js#L82) | `CylinderGeometry` 的顶底半径相等，高度沿 Y 轴。 | `segments` 默认 20，降低它可以做棱柱。 |
| [`cone(radius = 0.5, height = 1, options)`](../../engine/models.js#L96) | `ConeGeometry` 接收底面半径、高度与圆周分段。 | 默认 20 段。顶部沿正 Y 方向，树冠用 7 段形成低多边形外观。 |
| [`capsule(radius = 0.4, height = 1, options)`](../../engine/models.js#L110) | `CapsuleGeometry` 在圆柱段两端加半球，使用 6 个端盖分段、16 个圆周分段。 | `height` 是中间段的高度，总高是 `height + 2 * radius`。放在地面上时中心高度取总高的一半。 |
| [`torus(radius = 0.6, tube = 0.2, options)`](../../engine/models.js#L119) | `TorusGeometry` 让圆管沿圆形路径绕一圈，横截面 16 段、沿环 48 段。 | `radius` 量到管子的中心线，`tube` 是管子半径，因此外半径是两者之和。默认环面位于 XY 平面。 |

胶囊的中间段高度也可以在 Three.js 的几何体文档里对照。 [CapsuleGeometry](https://threejs.org/docs/pages/CapsuleGeometry.html)

### `ground(size = 100, options)`

生成一块边长为 `size` 的平面。普通 `PlaneGeometry` 在 XY 平面内，绕 X 轴转 `-Math.PI / 2` 后就平铺在 XZ 平面，初始高度为 0。默认调用 `checkerTexture` 生成双色棋盘纹理，`repeat` 默认是 `size / 4`，所以地面越大，棋盘重复次数也越多。如果提供自定义纹理，工厂会直接修改这份纹理的 `repeat`，共享它的其他物体也会感受到变化。传 `texture: null` 可以跳过纹理。最后设为接收阴影、关闭投影。 [ground 源码](../../engine/models.js#L134)

### 示例 1 基础形状与地面

**会看到什么**。地面上依次排着带棱角的短柱、圆角方块、球、圆锥、胶囊和圆环。每个形状绕 Y 轴缓慢旋转。

```js
import { createEngine, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [0, 3.7, 11],
  lookAt: [0, 0.55, 0],
})
lights.daylight(engine.scene)
const shapes = [
  models.cylinder(0.52, 0.85, { segments: 5, color: "#eab308", position: [-4, 0.425, 0] }),
  models.box([1.1, 0.9, 0.9], { radius: 0.18, color: "#fb923c", position: [-2.4, 0.45, 0] }),
  models.sphere(0.5, { segments: 8, color: "#38bdf8", position: [-0.8, 0.5, 0] }),
  models.cone(0.54, 1.2, { segments: 7, color: "#4ade80", position: [0.8, 0.6, 0] }),
  models.capsule(0.34, 0.7, { color: "#c084fc", position: [2.4, 0.69, 0] }),
  models.torus(0.46, 0.14, { color: "#fb7185", position: [4, 0.6, 0] }),
]
engine.add(models.ground(24), ...shapes)
engine.onUpdate((dt) => {
  shapes.forEach((shape) => { shape.rotation.y += dt * 0.65 })
})
engine.start()
```

把方块的 `radius` 改成 0，再把球的 `segments` 提到 32，对比边缘变化。把胶囊的中心高度从 0.69 改成 0.35，可以看到下端埋进地面，因为 `0.7` 只是其中间段的高度。最后，把 `models.ground(24)` 改成 `models.ground(24, { repeat: 2 })`，看棋盘格如何变大。

### `arena(size = 40, options)`

建立一个组，计算四面墙的尺寸与中心。每面墙的中心高度是 `height / 2`，底边因此落在地面上。以左右墙为例，中心在 `±(size / 2 + thickness / 2)`，内沿刚好在 `±size / 2`。前后墙额外加出两个墙厚来合拢四角。四面墙共享同一份材质，返回的 `group.userData.bounds` 记录 `size`、`height`、`thickness`。这些墙先是场景中的可见模型。要让物理角色被墙挡住，需要再向物理世界注册墙体，例如调用 `physics.addArena(group)`。 [arena 源码](../../engine/models.js#L160) · [physics.js](../../engine/physics.js#L79)

## 3. 拼装好的模型

### `coin(options)` 与 `coin.userData.update(dt, elapsed)`

用薄圆柱做硬币，材质带金属感和一定的自发光。圆柱绕 X 轴转 90 度，使圆面从水平变成竖直，随后挂到组下。组上的 `userData.update` 每帧把 Y 轴旋转增加 `dt * 2.5`，用 `sin(elapsed * 2.5) * 0.12` 写入局部高度。调用方自行注册更新，例如 `engine.onUpdate(coin.userData.update)`。高度基准在源码里固定为 0。如果要把动画硬币放在半空某处，给它套一个父组，把高度设在父组上。 [coin 源码](../../engine/models.js#L217)

### `character(options)`、内部 `limb()` 与 `character.userData.animate(elapsed, speed)`

`character` 先定义比例单位 `unit = height / 8`，以这个单位计算各部位的大小与位置。身体和头是直接加入组的方块，四肢则由内部函数 `limb(x, color, length, y)` 创建。这个函数把一个空组放在肩或髋的位置，再把四肢网格挂在空组下面，让网格中心从关节向下偏移 `length / 2`。旋转时转的是关节组，手脚就从肩和髋摆出去。角色根组位于脚底附近。

部位引用放在 `group.userData.parts`，可读 `head`、`body`、`armLeft`、`armRight`、`legLeft`、`legRight`。内置 `animate(elapsed, speed = 1)` 用 `sin(elapsed * 9)` 算摆动量，左右腿取相反角度，手臂与同侧腿反向摆动，躯干会微微起伏。速度为 0 时四肢停止摆动，头部有轻微摇晃。这里的速度控制摆动幅度，上限为 1，公式的时间频率保持原样。函数只改姿势，角色的整体位移由调用方写入 `character.position`。 [character 与 limb 源码](../../engine/models.js#L329) · [animate 源码](../../engine/models.js#L386)

### `label(text, options)` 与 `sprite.setText(next)`

用内部 `draw(value)` 调 `textTexture`，把文字画进纹理，再将它作为 `Sprite` 的图片。Sprite 在 3D 场景里始终面向相机。内部 `fit(map)` 把高度设为 `size`，按纹理宽高比计算宽度。返回的 **`sprite.setText(next)`** 释放旧纹理、重画文字、替换材质图片并重新计算宽度。适合更新名字或显示数值变化。 [label 源码](../../engine/models.js#L461)

### 示例 2 角色、文字标签与浮动硬币

**会看到什么**。方块人走来走去，头顶的文字跟着它移动，硬币始终在它旁边自转和浮动。

```js
import { Box3, Group } from "three"
import { createEngine, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [3, 3, 8],
  lookAt: [0, 1.15, 0],
})
lights.daylight(engine.scene)

const actor = models.character({ shirt: "#38bdf8" })
const label = models.label("巡逻员", { size: 0.36 })
label.position.y = new Box3().setFromObject(actor).max.y + 0.36
actor.add(label)

const coinMount = new Group()
coinMount.position.set(0.95, 1.25, 0)
const coin = models.coin({ radius: 0.24 })
coinMount.add(coin)
actor.add(coinMount)
engine.add(models.ground(20), actor)

engine.onUpdate((dt, elapsed) => {
  actor.position.x = Math.sin(elapsed * 1.35) * 1.8
  const direction = Math.cos(elapsed * 1.35)
  actor.rotation.y = direction >= 0 ? -Math.PI / 2 : Math.PI / 2
  actor.userData.animate(elapsed, Math.abs(direction))
  coin.userData.update(dt, elapsed)
})
engine.start()
```

`actor.position.x` 移动整个角色，`animate` 只更新部件姿势。`Box3` 得到包住角色的盒子，标签放在盒子顶端上方。硬币自身的高度被动画每帧重写，外层 `coinMount` 则决定它离地多高。试着把 `coinMount.position.y` 从 1.25 改成 1.8。再把 `animate` 的速度参数改成 0，观察角色仍在移动，但四肢停止摆动。

### `crate(size = 1, options)`

创建组，把圆角方块放进去，圆角取 `size * 0.08`。再用普通方块生成 `EdgesGeometry`，交给 `LineSegments` 画硬边线。表面颜色来自 `color`，默认边线色由 `shade(color, -0.15)` 得到。最后用 `castShadows(group)` 为组内网格统一设阴影。 [crate 源码](../../engine/models.js#L204)

### `tree(options)`、`rock(options)` 与 `cloud(options)`

- **`tree`** 先用圆柱做树干，高度为 `height * 0.4`，再循环叠放几层七边圆锥。层数上升时，半径与层高逐渐缩小，位置升高，叶色经 `shade()` 调整。省略高度和层数时会随机取值，整棵树也会绕 Y 轴取一个随机朝向。原点在树干底部。 [tree 源码](../../engine/models.js#L243)
- **`rock`** 先生成细分的二十面体，直接遍历几何体的顶点坐标。每个顶点随机放大或缩小，Y 坐标额外乘 0.8，让初始形状较扁。代码重算法线，再用带 `flatShading` 的材质和随机旋转，使石块呈现有棱面的外观。法线可以理解成表面朝向，灯光会用到它。 [rock 源码](../../engine/models.js#L277)
- **`cloud`** 用默认五个大小和位置稍有不同的二十面体组成一团云，所有小团共用一份粗糙材质。`spread` 控制 X 轴分散范围，Y、Z 使用独立范围。各个小团都关闭投影与接收阴影。 [cloud 源码](../../engine/models.js#L301)

### `vehicle(options)` 与 `ring(options)`

- **`vehicle`** 用两个圆角箱体做底盘和上部车身。四个轮子复用同一份圆柱几何体及材质，各自绕 Z 轴转 90 度，把轮轴从 Y 轴转到 X 轴。整辆车长边沿 Z 轴延伸，返回的是可以整体移动的组。 [vehicle 源码](../../engine/models.js#L402)
- **`ring`** 用 `RingGeometry(radius - thickness, radius, 48)` 生成平面圆环。内外半径之差就是厚度，再绕 X 轴转 90 度铺平。材质自带颜色，开启透明和双面绘制、关闭深度写入。它返回静止的环，可以由外部更新 `scale` 与 `material.opacity` 做成扩散效果。 [ring 源码](../../engine/models.js#L440)

## 4. 批量绘制与对象复用

### `instances(geometry, material, count)`

创建一个 `InstancedMesh`。想象场景中有一百株同形状的草，GPU 可以复用同一份几何体和材质，用每株各自的变换把它们画在不同位置。相比一百个独立网格，实例化可以减少绘制调用。工厂把实例矩阵缓冲区标记为适合动态更新，并复用临时向量、欧拉角、四元数和矩阵，供下面的方法反复计算。 [instances 源码](../../engine/models.js#L505) · [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)

- **`mesh.place(index, pos, options)`** 接受位置数组或带 `x/y/z` 的对象。把弧度旋转转成四元数，读取统一缩放或三轴缩放，再用 `matrix.compose(position, quaternion, scale)` 把位置、旋转和缩放打包成矩阵，写进指定槽位。不传旋转、缩放时使用零旋转和单位缩放。标记 `instanceMatrix.needsUpdate` 后，渲染器会上传发生变化的矩阵缓冲区。返回 `mesh` 便于链式调用。
- **`mesh.hide(index)`** 调用 `place`，把该槽位移到很低的位置并缩小。索引仍可随后用 `place` 重新摆回来，实例数量保持不变。
- **`mesh.tint(index, color)`** 第一次调用时创建 RGB 缓冲区，默认每个实例为白色。然后把颜色写到指定槽位，设置 `needsUpdate`，返回 `mesh`。实例颜色会与材质底色相乘，希望看到接近指定色时可用白色材质。

先摆完所有实例再开始渲染。运行时若把实例移到原来范围之外，还要留意整体包围球，必要时调用 `mesh.computeBoundingSphere()`，让相机的可见性判断使用新的范围。 [place、hide、tint 源码](../../engine/models.js#L517) · [Three.js 包围球说明](https://threejs.org/docs/pages/InstancedMesh.html#computeBoundingSphere)

#### 实例化示例 · 让同一种几何体画出一片波浪

**会看到什么**。一大片蓝色和黄色小方块上下起伏。它们共享一种形状，每格的摆放和颜色可以单独改变。

```js
import { BoxGeometry, MeshStandardMaterial } from "three"
import { createEngine, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [6, 6, 9],
  lookAt: [0, 0.4, 0],
})
lights.daylight(engine.scene)
const side = 9
const grid = models.instances(
  new BoxGeometry(0.38, 0.38, 0.38),
  new MeshStandardMaterial({ color: "#ffffff" }),
  side * side
)
const cells = []
for (let row = 0; row < side; row++) {
  for (let col = 0; col < side; col++) {
    const index = row * side + col
    const x = (col - (side - 1) / 2) * 0.65
    const z = (row - (side - 1) / 2) * 0.65
    cells.push({ index, x, z })
    grid.place(index, [x, 0.8, z])
    grid.tint(index, (col + row) % 3 === 0 ? "#fbbf24" : "#38bdf8")
  }
}

engine.add(models.ground(20), grid)
engine.onUpdate((dt, elapsed) => {
  for (const { index, x, z } of cells) {
    const y = 0.8 + Math.sin(elapsed * 2.8 + x * 1.4 + z * 0.8) * 0.55
    grid.place(index, [x, y, z], { rotation: [0, elapsed * 0.35, 0] })
  }
})
engine.start()
```

场景中加入的是一个 `grid`，81 个变换保存在它的数据中。索引用 `row * side + col` 把行列换成槽位。试着把波浪公式里的 `z * 0.8` 改成 `z * 2.5`，看波峰怎样在网格上分布。要试 `hide()`，可以在循环内调用 `place()` 前加上 `if (index === 40) { grid.hide(index); continue }`，观察正中央留下空位。

### `merge(meshes)`

把一批静态网格变成一个网格。内部先逐个克隆几何体，再用 `updateWorldMatrix(true, false)` 更新网格及其父节点的世界变换。随后把 `matrixWorld` 应用到克隆几何体的顶点。这个动作会把原本存放在父节点和网格上的变换直接写进形状数据，所以新网格从原点加入场景仍能保留各块原来的世界位置。

`mergeGeometries(geometries, false)` 合并这些副本，新网格只使用第一个网格的材质，最后清理临时几何体。输入应当是非空的网格数组，几何体要有兼容的顶点属性与索引结构。适合共用材质、之后无需单独移动各块的静态场景。工厂不会主动移除源网格，如果已经把源网格加到场景，换成合并结果时要自行移除。 [merge 源码](../../engine/models.js#L553)

### `createPool(factory, options)`

对象池处理的是重复借出和归还。例如一颗子弹飞出屏幕后，只需隐藏并归还，下次可以重置位置再次使用。创建时默认预先调用 `factory()` 32 次，把对象隐藏并放进 `free` 数组。传入 `parent` 时，预建对象也会先挂到该父节点。

| 成员 | 内部动作 |
| --- | --- |
| `live`、`count` | `live` 是当前借出对象的集合，`count` 返回该集合的大小。 |
| `take()` | 从 `free` 尾部取一个。池用光时调用工厂扩容。必要时把对象挂到父节点，然后设为可见、加入 `live`，执行可选的 `onTake(item)`。 |
| `give(item)` | 从 `live` 删除。如果这个对象本来就没在借出集合中，提前返回。否则隐藏对象，调用 `onGive(item)`，最后放回 `free`。 |
| `each(fn)` | 先复制一份借出对象快照，再循环执行 `fn(item)`。回调严格返回 `true` 时调用 `give(item)`。这样遍历时回收对象不会改变这次快照。 |
| `clear()` | 遍历借出对象的快照，逐个归还。对象和资源保留在池中，以便再借出。 |

对象归还时只会自动隐藏。速度、颜色、缩放等玩法数据由你在 `onTake`、`onGive` 或借出之后重置。对象池里的每个物体仍是独立网格，适合需要单独管理生命周期的对象。实例化着重减少同类物体的绘制调用，合并着重把静态形状一次打包。 [createPool 源码](../../engine/models.js#L578)

#### 对象池示例 · 发射小球，再把它放回池里

**会看到什么**。点击「发射」，小球从左往右飞，到右侧自动消失。「活动」数随借出和归还变化，「已创建」统计工厂一共造过多少颗球。等球飞完再发射，通常会复用之前创建的球。

```js
import { createEngine, createHud, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [0, 3.3, 9],
  lookAt: [0, 0.8, 0],
})
lights.daylight(engine.scene)
engine.add(models.ground(20))

let created = 0
const pool = models.createPool(() => {
  created++
  return models.sphere(0.23, { color: "#fbbf24" })
}, {
  size: 2,
  parent: engine.scene,
  onTake(ball) {
    ball.position.set(-3, 0.55, 0)
  },
})

const hud = createHud({ container: engine.container })
hud.button("发射", () => pool.take())
hud.button("清空", () => pool.clear(), { at: "bottom-left" })
const readout = document.createElement("output")
readout.style.cssText = "position:absolute;top:12px;left:12px;color:white"
engine.container.append(readout)

engine.onUpdate((dt) => {
  pool.each((ball) => {
    ball.position.x += 3.2 * dt
    return ball.position.x > 3
  })
  readout.textContent = `活动 ${pool.count} · 已创建 ${created}`
})
pool.take()
engine.start()
```

启动时已经预建 2 个对象。借出时 `onTake` 把球重新放回起点，越过右侧终点时回调返回 `true`，于是 `each()` 将球归还。试着在第一颗球飞完前快速发射三次，看看什么时候「已创建」超过 2。再点「清空」，观察活动数归零而已创建总数保留。两项数值分别对应当前在用的对象和池曾经分配过的对象。

## 5. `loadModel(url)` 与 `loadTexture(url, options)`

- **`loadModel`** 使用模块级 `GLTFLoader`，把回调式的 `load` 包装成 Promise。成功后先给 `gltf.scene` 内的网格开阴影，再返回 `{ scene, animations, gltf }`。加载完成后可把 `scene` 加进引擎，将 `animations` 和同一个场景对象交给 `createMixer`。失败时 Promise 拒绝。常见资源是单文件 `.glb`，或带其他资源引用的 `.gltf`。 [loadModel 源码](../../engine/models.js#L632) · [动画混合器讲义](animation.md)
- **`loadTexture`** 用 `TextureLoader` 读取图片。成功后，通常用 sRGB 解释颜色贴图。传 `data: true` 时使用 `NoColorSpace`，例如粗糙度等数据贴图需要保留数值含义。传 `repeat: [x, y]` 会同时设置两个方向的重复环绕模式和次数。Promise 返回纹理，可以赋给网格材质的对应贴图属性，失败同样会拒绝。 [loadTexture 源码](../../engine/models.js#L646)

本篇的实验台示例都在代码里直接建模。要加载外部 GLTF 或远程图片，可把加载代码放进普通 Vite 示例模块中运行，在那里从项目提供的 URL 读取资源。实验台的预览沙箱限制网络加载。 [实验台说明](../../lab/README.md)

## 下一篇读什么

接下来读 `materials.js`。这里的 `models.box()`、`ground()` 和 `label()` 已经分别用到了 `matte()`、`checkerTexture()` 和 `textTexture()`，可以从这三个实际调用点进入，理解同一个形状如何呈现不同表面。 [materials.js 讲义](materials.md)

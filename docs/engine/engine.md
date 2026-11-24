# `engine/engine.js` 源码解析

[animation.js](animation.md) 里的补间、弹簧和动画播放器都需要有人告诉它们「这一帧走了多少秒」。`engine.js` 就是提供这个时间、组织更新并把结果画出来的文件。读完这篇，你应该能从一个空白页面画出第一个方块，沿源码追踪一帧，并分辨暂停游戏、停止循环和销毁场景这三种操作。 [engine.js](../../engine/engine.js)

## 1. `createEngine(options)` · 搭出一套 3D 绘制环境

先从函数开头读到 `scene.add(camera)`。这一段创建了三个合作对象。

| 对象 | 负责什么 | 看源码时先找什么 |
| --- | --- | --- |
| `scene` 场景 | 保存需要绘制的物体、灯光和对象之间的父子关系。 | `new THREE.Scene()` 和 `scene.add(...objects)` |
| `camera` 相机 | 决定站在哪里、看向哪里，以及画面可以看到多宽、多远。 | `new THREE.PerspectiveCamera(...)`、`camera.position.set(...)` 和 `camera.lookAt(...)` |
| `renderer` 渲染器 | 根据场景和相机画一帧。它的 `domElement` 就是页面上的 `<canvas>`。 | `new THREE.WebGLRenderer(...)` 和 `renderer.render(scene, camera)` |

可以把场景理解成舞台。地面通常放在 `y = 0`，正 `y` 是升高，`x` 和 `z` 都沿地面延伸。方块的 `position` 决定它在舞台上的位置。改变相机位置，改变的是观察角度。一个最小的可见物体是 `Mesh`，由几何体和材质组成。几何体描述形状，材质描述表面怎样画。示例 1 用边长为 1 的方块，中心放在 `y = 0.5`，因此底面恰好在 `y = 0`。

| 配置 | 源码如何使用 |
| --- | --- |
| `container` | 默认是 `document.body`。渲染器的画布会被插入容器，CSS 宽高都设为 100%，`touchAction = "none"` 让画布上的触摸交互少受默认滚动手势影响。 |
| `cameraPosition`、`lookAt` | 默认分别是 `[0, 4, 10]` 和 `[0, 0, 0]`，前者是相机位置，后者是它盯着的场景坐标。 |
| `fov`、`near`、`far` | 默认是 60 度、0.1、500。视野角度是垂直方向的，角度越大通常能看到更多场景。近远裁剪距离限制相机沿视线深度绘制的范围。透视会让更远的同尺寸物体看起来更小。 |
| `background`、`fog` | 默认背景是 `#0a0a0a`，可传 `null` 跳过设色。雾默认为空，数字配置指数雾的密度，对象配置线性雾的颜色、起始和结束距离。 |
| `antialias`、`alpha`、`maxPixelRatio` | 默认分别为 `true`、`false`、`2`。抗锯齿减少边缘阶梯感，`alpha` 控制渲染器是否支持透明输出，像素比取设备值与上限中较小的值。 |
| `toneMapping`、`exposure`、`shadows` | 默认用 ACES 色调映射、曝光 1、开启阴影绘制，输出色彩空间设为 sRGB。开启渲染器的阴影后，场景还要有会投影的灯和参与投影或接收投影的网格。 |
| `pauseWhenHidden` | 默认开启。监听页面的可见性变化，隐藏时暂停、重新可见时恢复。 |

函数最后返回的 `engine` 上可以直接读到 `renderer`、`scene`、`camera`、`canvas`、`container` 和 `clock`。这些对象会被后续模块继续复用。例如相机控制改 `engine.camera`，动画注册 `engine.onUpdate`。创建完成时画布已经在页面上，循环要由 `start()` 启动。 [初始化源码](../../engine/engine.js#L23) · [返回对象](../../engine/engine.js#L157)

## 2. `add(...objects)` 与 `remove(...objects)` · 改变场景对象树

`add()` 调用 `scene.add(...objects)`，返回第一个传入的对象，所以可以写 `const cube = engine.add(mesh)`。这个方法也能一次添加地面和方块。`remove()` 调用 `scene.remove(...objects)`，用于移除场景的直接子节点。对象如果挂在组下面，应从它实际的父节点移除。

对同一对象执行 `remove` 再 `add`，可以让它暂时从画面消失、之后重新出现。它的几何体和材质仍可使用。永久卸载时，再使用后文的资源清理方法。 [源码](../../engine/engine.js#L195)

## 3. `start()`、`tick()` 与两类更新回调

`start()` 先检查内部的 `running`。如果循环已经启动，就直接返回同一个 `engine`。首次启动时设置 `running = true`、`paused = false`，启动时钟，再把内部函数 `tick` 交给 `renderer.setAnimationLoop(tick)`。接下来由渲染器持续调用 `tick`。 [start 源码](../../engine/engine.js#L203)

### 内部函数 `tick()`

1. `clock.getDelta()` 读出距上次取样的时间 `raw`，单位是秒。暂停时由 `renderTarget.render()` 画一帧，然后直接返回。
2. 正常运行时算 `dt = clamp(raw, 0, 1 / 15) * engine.timeScale`。如果卡了一下，原始间隔是 0.2 秒，正常速度下模拟只推进约 0.0667 秒。这个限制在乘时间倍率之前执行，循环仍然使用随帧间隔变化的步长。
3. 把 `dt` 加进 `elapsed`，并将 `frame` 加 1。`fps` 向当前测得的 `1 / raw` 靠近 10%，这样显示的帧率变化更平滑。将四个值同步到公开的 `engine` 对象。
4. 依次执行 `updates` 和 `lateUpdates`，每个回调收到相同的 `(dt, elapsed)`。最后调用 `renderTarget.render()` 绘制。

例如每秒转 90 度，更新代码是 `rotation.y += (Math.PI / 2) * dt`。60 帧每秒时，一帧只转约 1.5 度。帧间隔翻倍时，每帧转的角度也翻倍。这里的弧度单位与相机选项 `fov` 的度数单位不同。 [tick 源码](../../engine/engine.js#L125)

### `onUpdate(fn)` 与 `onLateUpdate(fn)`

两者分别把回调加入各自的 `Set`，并返回一个删除该回调的函数。同一队列按注册顺序执行，同一个函数引用重复注册会被集合合并。常见做法是先在 `onUpdate` 更新玩家，再在 `onLateUpdate` 根据玩家的新位置调整相机或同步标记。后更新阶段仍在当帧渲染之前。示例 2 把两个方块分别接到这两个阶段，你可以看到它们在同一帧更新。 [注册方法源码](../../engine/engine.js#L179)

## 4. `pause()`、`resume()`、`stop()` 与 `onVisibility()`

| 操作 | 内部动作 | 能观察到什么 |
| --- | --- | --- |
| `pause()` | 将 `paused` 设为 `true`。 | 渲染继续，前后更新回调和模拟计数都暂停。在按钮回调里改背景，画面仍会刷新。 |
| `resume()` | 调一次 `clock.getDelta()` 刷新时钟取样，再把 `paused` 恢复为 `false`。 | 已经启动的循环继续推进。循环如果已经被 `stop()` 关闭，需要用 `start()` 重新启动。 |
| `stop()` | 将 `running` 设为 `false`，停止时钟并用 `setAnimationLoop(null)` 注销循环。 | 此后没有定期更新和渲染。再次 `start()` 时，已有的对象和回调仍在，`frame` 与 `elapsed` 也从停下来的值继续。 |
| `onVisibility()` | 内部监听函数，根据 `document.hidden` 调用 `pause()` 或 `resume()`。 | 启用默认选项时，回到页面会自动解除暂停，包括之前手动设下的暂停。 |

`running` 和 `paused` 是通过 getter 暴露的状态，分别表示循环是否已启动、更新是否被暂停。另一个可直接赋值的属性是 `timeScale`。设为 0.25 后，用 `dt` 移动的物体会降到四分之一速度。`timeScale = 0` 时回调仍然执行，`dt` 为零，帧数仍增加。 [可见性处理](../../engine/engine.js#L150) · [循环控制](../../engine/engine.js#L203)

## 5. `resize()`、`onResize(fn)` 与 `setRenderTarget(target)`

### 内部函数 `resize()`

由初始化、窗口的 `resize` 事件和容器的 `ResizeObserver` 触发。观察器存在时会观察自定义容器，默认的 `document.body` 由窗口事件驱动。读 `container.getBoundingClientRect()` 得到可用的 CSS 尺寸，某一维为零或读不到时用窗口尺寸兜底，然后向下取整并确保至少是 1。尺寸相同就提前返回。

尺寸变了，先更新公开的 `size.width` 与 `size.height`，再将 `camera.aspect` 更新为宽除以高并重算投影矩阵。最后，`renderer.setSize(width, height, false)` 调整渲染缓冲区，保留目前的 CSS 样式。`resize()` 也会调整当前渲染目标的尺寸，然后通知所有尺寸回调。示例 3 改容器宽度，你会看到场景适应新画幅，原本是圆的球仍保持圆形。 [resize 源码](../../engine/engine.js#L100)

### `onResize(fn)`

把回调加入 `resizes` 后，马上以当前的 `(width, height)` 调用它一次。因此可以在同一个回调里初始化尺寸显示并处理后续变化。它同样返回注销函数。 [onResize 源码](../../engine/engine.js#L189)

### `setRenderTarget(target)`

这里的 `target` 是一个提供 `render()` 和可选 `setSize(width, height)` 的对象。设置时会立即同步一次尺寸。默认 `render()` 调用 `renderer.render(scene, camera)`，传入 `null` 会恢复默认行为。后处理模块通过这个接口接管每帧绘制，用自己的渲染链绘制场景和特效。替换目标后，绘制方式改变，`tick` 的前后更新顺序保持一致。 [setRenderTarget 源码](../../engine/engine.js#L228) · [postfx.js](../../engine/postfx.js)

## 6. `disposeObject(root)` 与 `engine.dispose()` · 释放资源

`disposeObject(root)` 用 `root.traverse()` 访问根节点和所有子节点。遇到几何体就调用 `dispose()`。材质可能有一个或多个，源码先把它们整理成数组，再扫描每个材质的直接属性。发现带 `isTexture` 的值就释放纹理，随后释放材质。最后从实际的父节点移除根对象。如果两个物体共用同一份几何体、材质或纹理，函数也会释放访问到的那一份资源。需要为共享资源另行管理生命周期时，先用普通的移除操作把对象摘下来。 [disposeObject 源码](../../engine/engine.js#L255)

`engine.dispose()` 用于结束整个场景的生命周期。它调用 `stop()`，移除窗口和页面监听，断开尺寸观察器，对整个 `scene` 调用 `disposeObject`，释放渲染器并移除画布。这段函数只处理引擎自己的清理流程，外部创建的 HUD、输入和后处理对象可以用各自的清理接口卸载。 [dispose 源码](../../engine/engine.js#L234)

## 在实验台动手

打开 `engine-lab` 的「代码实验台」，每次把下面**一整段代码**粘贴到左侧，等自动运行或点「运行」。这三段使用实验台已经支持的导入。

### 示例 1 让相机看见方块

**会看到什么**。一个不同朝向的面呈现不同颜色的方块，在深色背景中旋转。

```js
import { BoxGeometry, Mesh, MeshNormalMaterial } from "three"
import { createEngine } from "@game-engine/runtime"

const engine = createEngine({
  background: "#1b2938",
  cameraPosition: [3, 2, 5],
  lookAt: [0, 0.5, 0],
})

const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshNormalMaterial())
cube.position.y = 0.5
engine.add(cube)

engine.onUpdate((dt) => {
  cube.rotation.y += (Math.PI / 2) * dt
})
engine.start()
```

`MeshNormalMaterial` 用表面朝向显示颜色，可以先把注意力放在形状和相机上。试着把 `cameraPosition` 改成 `[0, 5, 3]`，你会看到方块更多的顶部。再把 `fov` 调到 35，观察同一位置的方块在画面中变大。把方块的 `position.y` 改成 1.5，则是把物体本身抬高。

### 示例 2 观察一帧的先后顺序与暂停

**会看到什么**。蓝色方块左右移动，橙色小球始终在它上方。点击「暂停」后，方块和帧计数停住，背景会马上换色。点击「半速」后再恢复，可以对比移动速度。

```js
import { Color } from "three"
import { createEngine, createHud, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  cameraPosition: [0, 3, 8],
  lookAt: [0, 1, 0],
})
lights.daylight(engine.scene)
const cube = models.box(0.85, { color: "#66d9ff", position: [0, 0.5, 0] })
const marker = models.sphere(0.18, { color: "#ff993c" })
engine.add(models.ground(20), cube, marker)

const hud = createHud({ container: engine.container })
const readout = document.createElement("output")
readout.style.cssText = "position:absolute;top:12px;left:12px;color:white"
engine.container.append(readout)

engine.onUpdate((dt, elapsed) => {
  cube.position.x = Math.sin(elapsed * 2) * 2
  cube.rotation.y += dt
})
engine.onLateUpdate(() => {
  marker.position.copy(cube.position)
  marker.position.y += 0.9
  readout.textContent = `帧 ${engine.frame} · 模拟时间 ${engine.elapsed.toFixed(2)} 秒`
})

const pause = hud.button("暂停", () => {
  if (engine.paused) {
    engine.resume()
    engine.scene.background = new Color("#0a0a0a")
    pause.element.textContent = "暂停"
  } else {
    engine.pause()
    engine.scene.background = new Color("#583751")
    pause.element.textContent = "恢复"
  }
})
const speed = hud.button("半速", () => {
  engine.timeScale = engine.timeScale === 1 ? 0.5 : 1
  speed.element.textContent = engine.timeScale === 1 ? "半速" : "原速"
}, { at: "bottom-left" })

engine.start()
```

小球在后更新阶段复制的是蓝色方块**本帧**的新位置。把小球的回调放到普通更新阶段，并把注册移到蓝色方块的回调之前，它就会读取上一帧的位置。再把暂停分支中的 `pause()` 改成 `stop()` 做一次对照。这次点击后背景也会停在旧画面，因为循环已经停止绘制。恢复原例时记得整段重新运行。

### 示例 3 缩放容器，观察相机怎样跟着改

**会看到什么**。点「切换宽度」，预览里的画布在宽、窄之间切换，左上角显示宽高与相机宽高比。画布变窄后能容纳的横向画面减少，球仍保持圆形。

```js
import { createEngine, createHud, lights, models } from "@game-engine/runtime"

const panel = document.createElement("div")
panel.style.cssText = "position:relative;width:100%;height:100%;margin:auto"
document.body.append(panel)

const engine = createEngine({
  container: panel,
  background: "#243743",
  cameraPosition: [0, 2, 6],
  lookAt: [0, 0.8, 0],
})
lights.daylight(engine.scene)
const ball = models.sphere(0.7, { color: "#ff993c", position: [0, 0.8, 0] })
engine.add(models.ground(20), ball)

const info = document.createElement("output")
info.style.cssText = "position:absolute;top:12px;left:12px;color:white"
panel.append(info)
engine.onResize((width, height) => {
  info.textContent = `${width} × ${height} · aspect ${engine.camera.aspect.toFixed(2)}`
})

const hud = createHud({ container: panel })
hud.button("切换宽度", () => {
  panel.style.width = panel.style.width === "100%" ? "60%" : "100%"
})

engine.start()
```

按钮只改了容器的 CSS。接下来发生的是 `ResizeObserver → resize() → 更新投影矩阵和渲染尺寸 → onResize 回调`。宽度从 100% 切到 60% 时，高度保持原样，所以 `aspect` 也约变为原来的 60%。想看清 CSS 尺寸和渲染缓冲区的区别，可以在 `onResize` 里输出 `engine.canvas.width` 和 `engine.renderer.getPixelRatio()`。屏幕像素比大于 1 时，画布缓冲区会比回调里的 CSS 宽度更宽。

## 下一篇读什么

从这篇接着读 `models.js`，就能解释 `models.box()` 如何把示例 1 的几何体与材质组装过程封装起来，也能理解 `Group` 怎样把多个零件拼成一个物体。等场景、模型、材质和灯光都能认出来，再读输入如何改变物体，最后回到动画如何组织这些变化。 [models.js](../../engine/models.js)

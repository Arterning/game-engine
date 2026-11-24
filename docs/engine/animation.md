# `engine/animation.js` 源码解析

这个文件管的是**物体怎样随时间变化**。同一个方块可以有好几种变化方式。想让它在 0.3 秒内升到指定高度，用 `createTweens()`。想让它追逐一个随时移动的目标，用 `Spring`。想让一个已有走路、跑步动作的角色播放动画，用 `createMixer()`。下面按源码顺序读，每节给出入口、状态如何变化，以及调用后可以观察什么。 [animation.js](../../engine/animation.js)

## 读代码前先认识三个量

- **`dt`** 是本帧推进了多少秒。约 60 帧每秒时，通常接近 `1 / 60`。每秒移动 2 个单位，就在这一帧移动 `2 * dt` 个单位。
- **`elapsed`** 是引擎累计的模拟时间。补间任务也有自己的 `tween.elapsed`，从任务加入时的 0 开始计。悬浮用前者，补间用后者。
- **`position`、`scale` 和 `rotation`** 是 Three.js 对象的变换。前两个是有 `x/y/z` 分量的向量，分别表示位置和各轴的缩放倍数。这里修改的 `rotation.y` 是绕局部变换的 Y 分量所表示的旋转，角度单位是弧度。直接放在场景里的方块，`position.y` 可以理解为它的高度。对象放在组里时，`position` 是相对父节点的位置。

引擎正常运行时先执行 `onUpdate(dt, elapsed)`，再执行 `onLateUpdate`，最后渲染。把引擎传给 `createTweens` 或 `createMixer`，它们会在创建时注册帧回调。弹簧和震动由调用者推进，`hover` 则直接返回一个可以注册的回调。 [engine.js](../../engine/engine.js#L125) · [animation.js](../../engine/animation.js)

## 1. `createTweens(engine = null)` · 在指定时间内改变属性

补间（tween）是从起点和终点算出中间值。例如把高度从 0 变到 10，时间走到一半，匀速时高度就是 5。管理器用一个 `Set` 保存活动任务。创建时传入 `engine`，它会用 `engine.onUpdate(step)` 自动推进。省略引擎时，由调用者执行 `step(dt)`，也可以借此手动验证单帧结果。 [createTweens 源码](../../engine/animation.js#L21)

### `to(target, props, options)`

`target` 是要修改的对象，`props` 是属性名和终值的映射。比如 `to(mesh.position, { y: 2 })` 修改向量里的数字 `y`，`to(mesh, { position: anotherVector })` 则逐分量补间整个位置向量。

1. 遍历 `props`，读取每个目标属性的当前值。数字直接保存，向量和颜色调用 `clone()` 保存副本。终值有 `clone()` 时也会复制。这样同一个向量被帧循环不断修改，保存下来的起点仍然固定。
2. 把起终值、曲线、计时、回调打包成任务，加入 `active`。默认 `duration = 0.3` 秒、`delay = 0` 秒、`ease = ease.outCubic`。持续时间的最小值是 `1e-6` 秒，以便后面计算比例时有正的分母。
3. 返回一个附带 `stop()` 的 Promise。正常结束时 Promise 得到 `target`，便于用 `await` 串联动作。调用 `stop()` 会从集合删掉任务，属性留在当时的值，Promise 会一直处于 pending。

数值属性需要已有可参与运算的数值起点。对象分支针对已有的 `THREE.Color`、`Vector2`、`Vector3`，依赖原对象的 `clone/copy/lerp`。普通 `{ x, y, z }` 对象、嵌套属性路径、四元数都没有对应的插值分支。多个任务同时写同一个属性时，每个任务仍会照常执行，后写入的值决定当帧该属性的结果。 [to 源码](../../engine/animation.js#L65)

### `step(dt)` · 逐帧计算的核心

`step` 既是闭包里的内部函数，也是管理器公开的方法。它遍历活动任务，对每个任务做以下计算。

1. `tween.elapsed += dt`。累计时间还没到 `delay` 就跳过，延迟阶段也不调用 `onUpdate`。
2. 用 `t = clamp01((elapsed - delay) / duration)` 算时间进度。假设延迟 0.2 秒、时长 0.4 秒，任务累计走到 0.3 秒时，时间进度是 `0.25`。
3. 用 `eased = tween.ease(t)` 算插值比例。默认的 `outCubic` 是 `1 - (1 - t) ** 3`。时间走了 25% 时，属性已经走了约 57.8%。代码只限制 `t` 在 0 到 1 之间，`outBack`、`outElastic` 这类曲线因此可以给出超过 1 的插值比例，让动作越过终值后回弹。
4. 数字用 `from + (to - from) * eased`。向量和颜色用 `target[key].copy(from).lerp(to, eased)`。每一帧先恢复起点再插值，避免把已插过一次的结果继续当起点。到期帧直接赋终值或 `copy(to)`，让最终属性精确停在终点。
5. 属性写完后调用 `onUpdate(eased, target)`，包括到期帧。到期时接着移除任务、调用 `onComplete(target)`、解析 Promise。传给 `onUpdate` 的第一个参数始终是曲线输出，即使那一帧的属性已被直接写为终值。

[step 源码](../../engine/animation.js#L24) · [clamp01 与缓动曲线](../../engine/math.js)

### `from(target, props, options)`

先保存 `target` 原有的属性值作为终点，然后**当场**把 `props` 里的值赋给属性，最后调用 `to(target, destination, options)`。例如高度本来是 2，调用 `from(mesh.position, { y: 0 }, { delay: 1 })` 时，高度会立刻变为 0，等 1 秒再向 2 补间。对可替换的向量或颜色属性，直接赋值会使属性引用变成传入的对象，随后 `to` 会修改这份对象。 [from 源码](../../engine/animation.js#L104)

### `value(from, to, options)`、`wait(seconds)` 与 `stopAll()`

- **`value`** 把数字包进临时对象 `{ v: from }`，再交给 `to`。需要把补间结果显示在界面上时，从 `onUpdate(progress, state)` 里的 `state.v` 读当前值。
- **`wait`** 创建一个从 0 到 1 的线性补间。传入引擎时，等待遵循引擎的 `dt`。引擎暂停会跳过帧更新，慢动作也会延长实际等到的时间。无引擎时仍需手动推进。
- **`stopAll`** 调用 `active.clear()`。和单个任务的 `stop()` 一样，取消的任务保留当时的属性值与 pending Promise，完成回调也不会执行。

[value、wait、stopAll 源码](../../engine/animation.js#L115)

## 2. `Spring` · 用位置和速度追目标

弹簧每一帧重新查看离目标有多远。把数值想成挂在弹簧上的物体，就能理解为什么改了目标后会继续移动、可能冲过目标，再来回收敛。反过来，补间的起点和终点在建立任务时就已确定，动画要走多久也已指定。 [Spring 源码](../../engine/animation.js#L145)

### `constructor(options)`

默认 `stiffness = 180`、`damping = 18`、`value = 0`。构造器让 `target = value`、`velocity = 0`，所以最初处于平衡。后续可以直接赋值 `spring.target = 10`。刚度越大，同样的距离误差会产生越强的拉力。阻尼越大，同样的速度会受到越强的反向作用。

### `impulse(amount)`

把 `amount` 加到速度上，返回弹簧本身以便链式调用。此时位置和目标都还是原值。下一帧的 `update` 才会根据新速度算出位移。想象目标高度为 0 的镜头受到一次向上的冲击，此方法给它一个向上的初速度，随后弹簧会把镜头拉回来。

### `update(dt)`

把一帧分成 `Math.max(1, Math.ceil(dt * 120))` 个小步，每步 `h = dt / steps`。例如 `dt = 1 / 30` 秒就切成 4 步，每步 `1 / 120` 秒。每一步按顺序更新速度与位置。

```text
误差 = 当前值 - 目标值
加速度 = -刚度 × 误差 - 阻尼 × 速度
新速度 = 旧速度 + 加速度 × h
新位置 = 旧位置 + 新速度 × h
```

源码把加速度记作 `force`，这里相当于假定质量为 1。当前值比目标小时，误差是负数，第一项给出正向加速度。速度为正时，第二项抵消一部分加速度。先更新速度再用新速度移动，是半隐式欧拉积分。把长帧切成更小的步可以减少数值不稳定。用默认参数从 `value = 0` 追 `target = 1`，单走 `1 / 120` 秒时，加速度为 180，新速度为 1.5，新位置为 0.0125。`update` 最后返回当前 `value`，由外部把它写给镜头、模型或界面。 [update 源码](../../engine/animation.js#L161)

## 3. `SpringVec3` · 让三维向量追目标

- **`constructor(options)`** 创建三个独立的 `Spring`，分别存为 `x`、`y`、`z`。同一份配置传给三个实例，所以 `value: 1` 会使三个初值都是 1。
- **`setTarget(vector)`** 读取 `vector.x/y/z`，分别写入三个弹簧的 `target`，然后返回自身。它保存的是当时的三个数字。目标向量随后移动时，要再次调用才能追踪。
- **`update(dt, out = new THREE.Vector3())`** 先更新三个弹簧，再通过 `out.set(x, y, z)` 写入结果，返回 `out`。可以传 `mesh.position` 直接更新模型，也可以传一个复用的临时向量。省略 `out` 则每次调用都会创建一个向量。

三个方向分别计算各自的拉力与速度，起始速度不同就可能走出弯曲的路径。传给 `setTarget` 或 `update` 的世界坐标和局部坐标要保持一致，例如写进 `mesh.position` 的目标应当是相对它父节点的位置。 [SpringVec3 源码](../../engine/animation.js#L178)

## 4. `createShake(object, options)` · 衰减的震动

创建时用 `object.position.clone()` 保存初始位置 `base`，另外保存强度 `amount = 0` 和相位计时 `time = 0`。默认 `decay = 5`、`frequency = 30`。它返回三个方法。 [createShake 源码](../../engine/animation.js#L204)

- **`add(strength = 0.3)`** 取现有强度与新强度的最大值。连续触发较小的冲击不会减弱正在进行的强震动，也不会把两次强度相加。相位计时继续沿用。
- **`update(dt)`** 当强度大于 `0.0001` 时，把相位推进 `dt * frequency`。三个轴用不同频率乘数和相位差的正弦函数，Z 轴再乘 0.5。每次消耗一段时间后，振幅乘以 `exp(-decay * dt)`。因此默认设置下，经过约 1 秒，强度约剩原来的 `exp(-5)`，也就是 0.67%。`frequency` 是相位推进系数，各轴实际周期还取决于 `1.7`、`2.3`、`1.1` 等乘数。
- **`reset()`** 把强度清零，并将位置复制回**创建震动时**的 `base`，相位计时保留。

读 `update` 时留意 `position.x += ...`。代码把震动叠到对象的现有位置，强度低于阈值后只是提前返回。如果每帧没有其他逻辑先写入相机原本该在的位置，偏移会累加并可能留下残余位移。跟随镜头的用法是先算相机的正常位置，再调用 `shake.update(dt)` 叠加当帧偏移。 [update 与 reset 源码](../../engine/animation.js#L210)

## 5. `flash(object, options)` · 实现命中闪白

默认颜色白色、持续 0.12 秒、发光强度 1。这里的 `emissive` 是材质自身显示出来的发光颜色。它让物体表面变亮，场景中并不会因此多出一盏给其他物体照明的灯。

`object.traverse` 遍历根对象及其子节点。遇到具有 `material.emissive` 的 Mesh 时，先保存材质引用、旧发光颜色的副本和旧强度，再立刻把颜色、强度换成闪光配置。内部的 `setTimeout` 回调遍历保存的条目，逐个恢复。调用立即返回原对象，恢复动作由浏览器计时器稍后执行。时长参数用秒，所以传给计时器前乘 1000。引擎暂停或调整 `timeScale` 时，这个计时器依旧按浏览器自己的时间调度。

这段逻辑直接修改材质实例，共享该实例的其他 Mesh 也会变亮。材质数组没有 `emissive`，因此会被本实现跳过。重复触发时，每次调用独立保存和恢复，也可能把上一次闪白时的颜色当成恢复值。即使只调用一次，如果多个被遍历的子网格共享同一材质，后遍历的网格也可能保存到已被改亮的颜色。 [flash 源码](../../engine/animation.js#L238)

## 6. `pop(object, tweens, options)` · 压扁再回弹

`scale` 默认 1.25，`duration` 默认 0.24 秒。先复制对象的原始缩放向量，再立刻把 X、Z 轴乘以 `scale`，将 Y 轴除以 `scale`。例如初始缩放为 `(1, 1, 1)`，调用之后先变成 `(1.25, 0.8, 1.25)`。这是着地时的压扁姿态。

随后调用 `tweens.to(object.scale, ...)`，用 `ease.outElastic` 让三轴沿各自的起终值回弹。曲线会越过终点，因此物体可能短暂比原来更瘦、更高，结束帧再精确写回原始缩放。函数返回 `to` 的 Promise，也继承它的停止语义。若在回弹中再次调用，第二次会把当时的缩放保存为新的恢复目标。 [pop 源码](../../engine/animation.js#L263) · [outElastic 实现](../../engine/math.js#L176)

## 7. `hover(object, options)` · 周期性悬浮与自转

默认 `amplitude = 0.15`、`speed = 2`、`spin = 0.6`，`phase` 默认随机取 `[0, 10)`。创建时记录当时的 `position.y` 作为 `baseY`，返回一个 `(dt, elapsed) => { … }` 回调。常见的接法是 `engine.onUpdate(hover(coin))`。

- **上下浮动**用 `baseY + sin((elapsed + phase) * speed) * amplitude` 直接计算这一帧的高度，默认在基准上下 0.15 个单位之间。因为 `phase` 在乘 `speed` 之前加进去，它在这条公式里相当于时间偏移。默认周期是 `2π / 2 ≈ 3.14` 秒。
- **自转**用 `rotation.y += spin * dt` 积累角度，默认为每秒 0.6 弧度。设 `spin: 0` 可以只保留浮动。

回调每帧都重新写 `position.y`。如果物理也在写同一个对象的高度，谁最后执行就会覆盖前面的值。可以让物理移动父节点、悬浮回调移动视觉子节点，让两者各自写自己的位置。 [hover 源码](../../engine/animation.js#L278)

## 8. `createMixer(model, clips, engine)` · 播放和切换动画片段

一个角色的跑步动画可以有很多条**轨道**，例如某根骨骼在 0、0.2、0.4 秒时的旋转。轨道记下什么时候应该是什么值，这些记录就是关键帧。一起描述跑步的轨道组成一个 `AnimationClip`。`AnimationAction` 保存这个片段的播放状态，例如当前时间、速度、循环和权重。`AnimationMixer` 每帧给各个动作推进时间，从轨道上算出当前姿势，再把动作按权重混合并写到模型上。这里的 `createMixer` 把 Three.js 的这套机制包装成按名称播放的接口。 [AnimationMixer 文档](https://threejs.org/docs/pages/AnimationMixer.html) · [AnimationAction 文档](https://threejs.org/docs/pages/AnimationAction.html)

### 创建、`names()` 与 `playing`

首先用 `new THREE.AnimationMixer(model)` 指定动画绑定的模型根节点。遍历 `clips ?? []`，为每个片段取得 `mixer.clipAction(clip)`，以 `clip.name` 为键放进 `Map`。同名片段在这张表里由后者覆盖。函数返回的 `mixer` 和 `actions` 是实际对象，可用于观察底层状态。

`names()` 通过 `[...actions.keys()]` 返回动作名称数组。GLTF 里的名字可能与示例中的 `Idle`、`Run` 不同，先看这个列表。getter `playing` 返回内部变量 `current`，初始为 `null`。它表示包装层最近选中的名字。一次性动画自然播完时，这个变量仍保留原名。 [createMixer 源码](../../engine/animation.js#L298)

### `play(name, options)`

默认过渡 0.25 秒、循环播放、速度 1 倍。

1. 从 `actions` 取出目标动作。名字不存在，或者已选中同一个动作，就直接返回 `api`。例如每帧调用 `play("Run")` 时，第二帧起不会反复把播放时间重置为零。同样，想靠再次调用这个方法修改当前动作的速度，或者在播完一次的动作上直接重播，也会遇到这个提前返回。
2. 用 `next.reset()` 让新动作从头准备播放，把 `speed` 写到 `next.timeScale`。用 `setLoop` 设置无限重复或播放一次。对于 `LoopOnce`，传入的重复次数 `Infinity` 不参与运算。非循环动作设置 `clampWhenFinished = true`，让自然播完的动作停留在最后的姿势。
3. 如果存在上一个动作且 `fade > 0`，调用 `previous.crossFadeTo(next, fade, true)`。旧动作的影响逐渐减小，新动作的影响逐渐增大。第三个参数 `true` 让 Three.js 在过渡期间调整有效播放速度，以处理两个片段的时长差。例如从不同节奏的站立切换到跑步时，画面会经过中间姿势。若 `fade <= 0`，这一分支完全跳过，包装器也没有显式停止旧动作，因此旧动作可能继续参与混合。
4. 调用 `next.play()` 激活新动作，把 `current` 改成新名字并返回 `api`。姿势会随着之后的 `update(dt)` 计算。

[play 源码](../../engine/animation.js#L315) · [Three.js 淡入淡出与循环选项](https://threejs.org/docs/pages/AnimationAction.html)

### `stop(name)`、`update(dt)` 与 `dispose()`

- **`stop(name)`** 找指定动作，省略名称则找当前动作。找到时调用 `fadeOut(0.2)`，淡出仍需后续帧推进。省略名称或停止的是当前动作时，立刻将 `current` 置为 `null`，所以过渡尚未结束时也可能看到 `playing === null`。
- **`update(dt)`** 原样调用并返回 `mixer.update(dt)`，它推进播放、采样动画并更新模型。工厂收到引擎时已经注册 `engine.onUpdate(api.update)`。手动管理时可以省略引擎，自己决定在哪个帧回调调用 `update`。
- **`dispose()`** 在当前实现中只调用并返回 `mixer.stopAllAction()` 的结果。它没有清空本地的 `actions` 和 `current`、释放 Three.js 的动画缓存，或注销工厂注册的帧回调。需要控制回调何时注销的调用方，可以省略工厂的引擎参数，用 `engine.onUpdate(api.update)` 自己保存注销函数。

[stop、update、dispose 源码](../../engine/animation.js#L334) · [Three.js 的停止与缓存接口](https://threejs.org/docs/pages/AnimationMixer.html)

## 9. `export { ease }` · 复用数学模块的曲线

`ease` 从 `math.js` 导入，并在文件末尾原样再导出。这个文件实际用到 `outCubic`（补间默认）、`linear`（等待）、`outElastic`（压扁回弹）。曲线的输入都是时间进度，输出是插值比例。例如 `linear(0.5)` 是 0.5，而 `outCubic(0.5)` 是 0.875。公共入口也导出了同一个 `ease` 对象。 [animation.js](../../engine/animation.js#L347) · [数学模块中的实现](../../engine/math.js#L160) · [公共入口](../../engine/index.js#L37)

## 在实验台看动画

从 `lab` 的练习目录打开「代码实验台」，或在 Vite 地址后加上 `?playground`。每次用下面**一整段代码替换左侧编辑器的内容**，等它自动运行，或点击「运行」。右侧「预览」显示通过 `createEngine()` 创建的画布，「控制台」显示 `console.log()` 的输出。

- [① 对比两条补间曲线](#示例-1-对比两条补间曲线)
- [② 用弹簧追上移动目标](#示例-2-用弹簧追上移动目标)
- [③ 给命中加上闪光、回弹和震动](#示例-3-给命中加上闪光回弹和震动)
- [④ 切换两段关键帧动画](#示例-4-切换两段关键帧动画)

### 先理解原来的数值例子

实验台内置的「补间数值」只在控制台输出。下面的 `point` 是普通 JavaScript 对象，三次 `step()` 都在同一次执行中完成。示例 1 把同样的补间应用到 3D 方块的高度，由引擎一帧一帧推进。

```js
import { createTweens, ease } from "@game-engine/runtime"

const tweens = createTweens()
const point = { y: 0 }
const done = tweens.to(point, { y: 10 }, {
  duration: 0.5,
  delay: 0.25,
  ease: ease.outCubic,
  onUpdate(progress, target) {
    console.log(progress, target.y)
  },
})

tweens.step(0.125) // 延迟阶段，y 仍为 0
tweens.step(0.25)  // 累计 0.375 秒，t = 0.25，y = 5.78125
tweens.step(0.375) // 累计 0.75 秒，y 精确等于 10
done.then((target) => console.log(target === point)) // true
```

### 示例 1 对比两条补间曲线

**会看到什么**。蓝色和橙色方块同时起跳、同时抵达最高点。蓝色匀速上升，橙色迅速上升、接近最高点时放慢。两块随后按相同的曲线落回地面，反复播放。

```js
import { createEngine, createTweens, ease, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [0, 3, 8],
  lookAt: [0, 1.4, 0],
})
lights.daylight(engine.scene)
const blue = models.box(1, { color: "#66d9ff", position: [-1.2, 0.5, 0] })
const orange = models.box(1, { color: "#ff993c", position: [1.2, 0.5, 0] })
engine.add(models.ground(20), blue, orange)
const tweens = createTweens(engine)
engine.start()

async function jump() {
  while (true) {
    await Promise.all([
      tweens.to(blue.position, { y: 2.6 }, { duration: 1.2, ease: ease.linear }),
      tweens.to(orange.position, { y: 2.6 }, { duration: 1.2, ease: ease.outCubic }),
    ])
    await tweens.wait(0.3)
    await Promise.all([
      tweens.to(blue.position, { y: 0.5 }, { duration: 0.8, ease: ease.outBounce }),
      tweens.to(orange.position, { y: 0.5 }, { duration: 0.8, ease: ease.outBounce }),
    ])
    await tweens.wait(0.5)
  }
}
jump()
```

`createTweens(engine)` 注册了一个帧回调。两次 `to()` 把任务加入同一个管理器，各自的 `target` 是方块的 `position`。经过 0.6 秒时，蓝色走过高度差的 50%，橙色走过 87.5%。`Promise.all` 等两块都完成才开始停顿和下落。把橙色的 `ease.outCubic` 改成 `ease.outBack`，观察它怎么越过最高点，再回到目标高度。

### 示例 2 用弹簧追上移动目标

**会看到什么**。橙色小球隔一会儿换个位置，蓝色方块会顺着新方向追过去。它可能冲过小球的中心，再回到目标附近。

```js
import { createEngine, SpringVec3, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [5, 5, 10],
  lookAt: [0, 1, 0],
})
lights.daylight(engine.scene)
const cube = models.box(0.9, { color: "#66d9ff", position: [0, 0.6, 0] })
const target = models.sphere(0.18, {
  color: "#ff993c",
  position: [2, 1.15, 0],
})
engine.add(models.ground(20), cube, target)

const spring = new SpringVec3({ stiffness: 90, damping: 8 })
spring.x.value = cube.position.x
spring.y.value = cube.position.y + 0.55
spring.z.value = cube.position.z

engine.onUpdate((dt, elapsed) => {
  const right = Math.floor(elapsed / 1.5) % 2 === 0
  target.position.set(right ? 2 : -2, 1.15, right ? -1 : 1)
  spring.setTarget(target.position)
  spring.update(dt, cube.position)
  cube.position.y -= 0.55
})

engine.start()
```

小球的位置是目标，弹簧自己保存蓝色方块的运动状态。这里把方块画在弹簧结果下方 0.55 个单位，让方块到达目标时小球还露在上方。`spring.update(dt, cube.position)` 每帧重新写入完整向量，所以这个显示偏移不会累积。把 `damping` 从 8 改到 20，观察冲过目标的幅度怎样变化。再把球的位置改成 `target.position.set(Math.sin(elapsed * 2) * 2, 1.15, 0)`，观察方块如何追一个持续移动的目标。

### 示例 3 给命中加上闪光、回弹和震动

**会看到什么**。蓝色方块一直悬浮和自转。点击预览里的「命中一下」，方块短暂变亮、压扁后回弹，同时整个画面抖动。

```js
import {
  createEngine, createHud, createShake, createTweens, flash, hover, lights, models, pop,
} from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [3, 2.6, 6],
  lookAt: [0, 0.9, 0],
})
lights.daylight(engine.scene)
const cube = models.box(1.2, { color: "#66d9ff", position: [0, 1, 0] })
engine.add(models.ground(20), cube)
const tweens = createTweens(engine)
const hud = createHud({ container: engine.container })

engine.onUpdate(hover(cube, { amplitude: 0.18, speed: 3, spin: 1 }))
const cameraBase = engine.camera.position.clone()
const shake = createShake(engine.camera, { decay: 7 })
engine.onLateUpdate((dt) => {
  engine.camera.position.copy(cameraBase)
  shake.update(dt)
})

const { element: button } = hud.button("命中一下", async () => {
  button.disabled = true
  flash(cube, { color: "#ffffff", intensity: 1.5, duration: 0.15 })
  shake.add(0.28)
  await pop(cube, tweens, { scale: 1.35, duration: 0.5 })
  button.disabled = false
})

engine.start()
```

这里几个效果同时发生，但改的是不同数据。 `hover` 每帧写高度和旋转，`pop` 补间缩放，`flash` 暂时提高材质的自发光，`shake` 最后叠加相机的位移。相机每帧先恢复基准位置，因此震动偏移不会累加。试着把 `decay` 改成 3，观察震动持续多久。再把 `pop` 的 `scale` 改成 1.6，观察启动时的姿势。

### 示例 4 切换两段关键帧动画

**会看到什么**。橙色长方块先左右摇摆。点「跳跃」后，它逐渐从摇摆过渡到跳跃。点「摇摆」可以切回去。两个片段都在代码里定义，粘贴即可运行。

```js
import { AnimationClip, NumberKeyframeTrack } from "three"
import { createEngine, createHud, createMixer, lights, models } from "@game-engine/runtime"

const engine = createEngine({
  background: "#243743",
  cameraPosition: [0, 2.6, 8],
  lookAt: [0, 1.6, 0],
})
lights.daylight(engine.scene)
const block = models.box([0.85, 1.6, 0.85], {
  color: "#ff993c",
  position: [0, 0.8, 0],
})
engine.add(models.ground(20), block)

const times = [0, 0.5, 1, 1.5]
const sway = new AnimationClip("sway", 1.5, [
  new NumberKeyframeTrack(".rotation[z]", times, [0, -0.5, 0.5, 0]),
  new NumberKeyframeTrack(".position[y]", times, [0.8, 0.8, 0.8, 0.8]),
])
const jump = new AnimationClip("jump", 1.5, [
  new NumberKeyframeTrack(".rotation[z]", times, [0, 0, 0, 0]),
  new NumberKeyframeTrack(".position[y]", times, [0.8, 2.6, 0.8, 0.8]),
])

const player = createMixer(block, [sway, jump], engine)
const hud = createHud({ container: engine.container })
hud.button("摇摆", () => player.play("sway", { fade: 0.5 }), { at: "bottom-left" })
hud.button("跳跃", () => player.play("jump", { fade: 0.5 }))
player.play("sway")
engine.start()
```

轨道里的 `.rotation[z]` 指定绕 Z 轴转动，`.position[y]` 指定模型高度。`times` 是四个关键帧的时间，后面的数组记录这些时间点上的属性值。比如跳跃在第 0.5 秒达到 `y = 2.6`，两帧之间由 Three.js 插值。两个片段都提供高度和角度轨道，因此混合期间能同时看到摇摆减弱和跳跃出现。把两个按钮的 `fade` 从 0.5 改到 1，感受过渡变长。想观察一次性动作，把「跳跃」按钮改为 `player.play("jump", { fade: 0.5, loop: false })`，它会在最后一个关键帧停住。切回「摇摆」后，就能再次触发跳跃。

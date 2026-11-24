# 05 · 让游戏给出反馈

这一章接着用金币游戏。收集时发出音效、火花和圆形冲击波，镜头轻微震动。先完成下面三处编辑。

**第一处**。把导入替换为：

```js
import {
  createAudio, createEngine, createHud, createInput, createParticles, createPhysics,
  createScore, createStateMachine, createTimer, followCamera, lights, models, shockwave,
} from "../engine/index.js"
```

**第二处**。把底部的 `followCamera(...)` 和 `engine.start()` 替换为：

```js
const cameraRig = followCamera(engine, player, { behind: false, distance: 7, height: 4 })
const audio = createAudio()
const particles = createParticles(engine, { max: 120, gravity: -6 })
engine.start()
```

**第三处**。在 `collectPickup(mesh, trigger)` 函数里，紧接 `score.add(1)` 插入以下几行：

```js
  audio.play("coin", { vary: 0.08 })
  particles.burst(mesh.position, { count: 28, color: "#ffd15a", speed: 4 })
  shockwave(engine, mesh.position, { from: 0.25, to: 1.5, duration: 0.35 })
  cameraRig.shake(0.12)
```

移动捡起金币，应该能看到金币消失、分数变化，以及拾取位置的特效。Web Audio 通常需要一次键盘或触屏交互来解锁，静音时仍能观察到视觉变化。

## 反馈为什么放在拾取事件里

触发器首先确定「拾取成功」，视觉和音效在同一事件中启动一次。每帧反复播放会不停重启效果，也会让读者难以分清哪个动作触发了它。粒子系统把位置、颜色、寿命等数据存在预分配数组中，用一个 `Points` 对象绘制。冲击波则临时创建环形网格，用 `dt` 推进缩放和透明度，寿命结束后注销回调、移除网格并释放材质和几何体。 [particles.js](../engine/particles.js) · [sound.js](../engine/sound.js)

同样是「随时间变化」，`createTweens()` 适合在一段时间内把属性从起点推进到终点，例如菜单淡入。它先计算归一化进度，再用缓动函数重新映射进度。弹簧和阻尼适合持续变化的目标，例如跟随或回弹。角色已有动画片段时，还可以从 `createMixer()` 读起，看看怎样包装 Three.js 的动画混合器。 [animation.js](../engine/animation.js) · [math.js](../engine/math.js)

## 渲染管线和调试

可在脚本开始运行前用 `createPostFX(engine, { bloom: true })` 换上后处理。它通过 `engine.setRenderTarget()` 接管绘制，场景渲染之后可以再做辉光等全屏处理。运行时的尺寸变化也会传给新目标。对比前后效果时，可以用 `debug.showStats(engine)` 观察帧率、绘制次数和三角形数。它们都由 `engine/index.js` 导出。 [postfx.js](../engine/postfx.js) · [debug.js](../engine/debug.js)

如果把练习挂载到能反复进入和退出的页面，退出时先停止引擎，并清理输入、音频和独立添加的管理器。仅把网格移出场景树，不会替你释放 Three.js 的几何体和材质。引擎的 `dispose()` 会清理当时仍在场景内的资源、画布和引擎自己的监听器。 [engine.js](../engine/engine.js)

**练习**。把 `count` 改成 100 再试。观察 `max: 120` 时，短时间连续触发两次会发生什么。读一下粒子模块的游标逻辑，解释为什么分配的容量不会随着拾取次数增加。

[返回目录](README.md) · [上一章](04-game-state.md) 

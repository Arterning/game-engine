# 01 · 第一帧是怎么画出来的

本章的目标是在浏览器里画一个旋转的立方体，能解释 `createEngine()` 和 `engine.start()` 各自做了什么。

## 搭好练习入口

在仓库根目录创建 `engine-lab/`，把以下内容保存为 `engine-lab/index.html`。导入映射与项目入口使用同一个 Three.js 版本。

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>引擎练习</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; }
    body { position: relative; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <script type="module" src="./example.js"></script>
</body>
</html>
```

把这段保存为 `engine-lab/example.js`。

```js
import { createEngine, lights, models } from "../engine/index.js"

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
```

从**仓库根目录**启动静态服务器，再打开练习地址。HTTP 负责本地模块的加载，浏览器还需要能访问导入映射中的 CDN。

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 [练习页面](http://127.0.0.1:8000/engine-lab/)。正常时会看到地面、一个持续旋转的蓝色方块及光照。

## 从场景到画布

`createEngine()` 创建 `WebGLRenderer`、`Scene` 和 `PerspectiveCamera`，把画布放进容器，默认是 `document.body`。`Scene` 保存场景树，`Mesh` 由几何体和材质组成，`camera` 决定观察位置和方向。模型工厂封装了常用构造步骤，`engine.add()` 把对象加到场景树。可以在工厂里找到 `new THREE.BoxGeometry(...)`，在引擎里找到 `renderer.render(scene, camera)`。 [models.js](../engine/models.js) · [engine.js](../engine/engine.js)

`start()` 用 `renderer.setAnimationLoop(tick)` 启动循环。每帧先计算秒数 `dt`，依次执行 `onUpdate`、`onLateUpdate`，最后渲染。引擎把原始帧间隔限制在最多 `1 / 15` 秒，再乘 `timeScale`，因此卡顿后模拟会少走一些时间，避免这一帧跨得过远。这个循环的步长依然会随帧间隔变化。 [engine.js](../engine/engine.js)

`1.4 * dt` 表示每秒转 1.4 弧度。每帧固定加一个角度，则帧数越高转得越快。改变浏览器大小时，引擎也会更新相机宽高比、投影矩阵和渲染缓冲区尺寸。

**练习**。把角速度改成 `Math.PI`，观察方块是否大约两秒转一圈。然后临时加上 `engine.timeScale = 0.5`，观察旋转速度。

[返回目录](README.md) · [下一章](02-input-camera.md)

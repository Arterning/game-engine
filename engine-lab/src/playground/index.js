import bundle from "playground:modules"

import { examples } from "./examples.js"
import boot from "./frame.js?raw"
import "./playground.css"

const frameDocument = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src blob: data:; worker-src blob:">
<style>html,body{width:100%;height:100%;margin:0}body{position:relative;overflow:hidden;background:#111c24;color:#edf3f6;font-family:system-ui}</style>
<script>${boot}</script>`

export function openPlayground() {
  const main = document.querySelector("#catalog")
  main.classList.add("playground")
  main.innerHTML = `
    <header class="playground-header">
      <div>
        <a href="./">← 返回练习目录</a>
        <h1>代码实验台</h1>
      </div>
      <div class="playground-actions">
        <label>示例
          <select id="example">
            <option value="tween">补间数值</option>
            <option value="cube">补间立方体</option>
          </select>
        </label>
        <label><input type="checkbox" id="live" checked> 实时运行</label>
        <button id="run" type="button">运行</button>
      </div>
    </header>
    <div class="playground-layout">
      <section class="playground-editor">
        <label for="code">JavaScript</label>
        <textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      </section>
      <section class="playground-output" aria-label="运行结果">
        <h2>预览</h2>
        <div id="preview"></div>
        <div class="playground-console-title">
          <h2>控制台</h2>
          <span id="run-state" role="status"></span>
        </div>
        <pre id="console" tabindex="0" aria-label="控制台输出"></pre>
      </section>
    </div>`

  const editor = main.querySelector("#code")
  const example = main.querySelector("#example")
  const live = main.querySelector("#live")
  const preview = main.querySelector("#preview")
  const output = main.querySelector("#console")
  const state = main.querySelector("#run-state")
  let current
  let timer
  let failed = false

  function run() {
    clearTimeout(timer)
    output.replaceChildren()
    state.textContent = "运行中…"
    failed = false
    current = document.createElement("iframe")
    current.title = "代码预览"
    current.setAttribute("sandbox", "allow-scripts")
    current.allow = "autoplay"
    current.srcdoc = frameDocument
    preview.replaceChildren(current)
  }

  window.addEventListener("message", (event) => {
    if (!current || event.source !== current.contentWindow) return
    const { kind, text } = event.data ?? {}
    if (kind === "ready") {
      current.contentWindow.postMessage({ kind: "run", bundle, code: editor.value }, "*")
      return
    }
    if (kind === "done") {
      if (!failed) state.textContent = "已执行"
      return
    }
    if (!["log", "info", "warn", "error", "debug", "failed"].includes(kind)) return
    if (kind === "failed" || kind === "error") {
      failed = true
      state.textContent = "有错误"
    }
    if (typeof text !== "string") return
    const line = document.createElement("span")
    line.className = kind
    line.textContent = text.slice(0, 4000) + "\n"
    output.append(line)
    while (output.childElementCount > 300) output.firstElementChild.remove()
    output.scrollTop = output.scrollHeight
  })

  function loadExample() {
    editor.value = examples[example.value]
    run()
  }

  example.addEventListener("change", loadExample)
  editor.addEventListener("input", () => {
    clearTimeout(timer)
    if (live.checked) timer = setTimeout(run, 650)
  })
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      run()
    }
  })
  live.addEventListener("change", () => {
    if (live.checked) run()
    else clearTimeout(timer)
  })
  main.querySelector("#run").addEventListener("click", run)
  document.title = "代码实验台 · 游戏引擎练习"
  loadExample()
}

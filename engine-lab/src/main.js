import "./index.css"

const lessons = {
  "01": () => import("./lessons/01-render-loop.js"),
  "02": () => import("./lessons/02-input-camera.js"),
  "03": () => import("./lessons/03-physics.js"),
  "04": () => import("./lessons/04-game-state.js"),
  "05": () => import("./lessons/05-feedback.js"),
}
const lesson = new URLSearchParams(location.search).get("lesson")

if (lesson !== null) {
  const status = document.querySelector("#status")
  const showStatus = (message) => {
    status.textContent = message
    status.hidden = false
  }

  if (Object.hasOwn(lessons, lesson)) {
    document.querySelector("#catalog").hidden = true
    document.querySelector("#lesson-nav").hidden = false
    document.body.classList.add("playing")
    lessons[lesson]().catch((error) => {
      showStatus("练习加载失败，请查看浏览器控制台。")
      console.error(error)
    })
  } else {
    showStatus("请从练习目录选择一章。")
  }
}

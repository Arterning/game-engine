function boot() {
  function report(kind, text) {
    parent.postMessage({ kind, text }, "*")
  }

  function format(value) {
    if (value instanceof Error) return value.stack ?? value.message
    if (typeof value === "string") return value
    if (typeof value === "bigint") return `${value}n`
    try {
      return JSON.stringify(value, null, 2) ?? String(value)
    } catch {
      return Object.prototype.toString.call(value)
    }
  }

  for (const level of ["log", "info", "warn", "error", "debug"]) {
    console[level] = (...values) => report(level, values.map(format).join(" "))
  }

  window.addEventListener("error", (event) => {
    report("error", format(event.error ?? event.message))
  })
  window.addEventListener("unhandledrejection", (event) => {
    report("error", format(event.reason))
  })

  const moduleUrl = (source) => URL.createObjectURL(
    new Blob([source], { type: "text/javascript" })
  )

  async function run(event) {
    if (event.source !== parent || event.data?.kind !== "run") return
    window.removeEventListener("message", run)

    try {
      const bundleUrl = moduleUrl(event.data.bundle)
      const modules = await import(bundleUrl)
      function shim(namespace) {
        const exports = Object.keys(modules[namespace]).join(", ")
        return moduleUrl(`import { ${namespace} } from ${JSON.stringify(bundleUrl)}
          const { ${exports} } = ${namespace}
          export { ${exports} }`)
      }

      const map = document.createElement("script")
      map.type = "importmap"
      map.textContent = JSON.stringify({
        imports: { "@game-engine/runtime": shim("runtime"), three: shim("three") },
      })
      document.head.append(map)

      await import(moduleUrl(event.data.code))
      report("done", "")
    } catch (error) {
      report("failed", format(error))
    }
  }

  window.addEventListener("message", run)
  report("ready", "")
}

boot()

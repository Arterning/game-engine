import { fileURLToPath } from "node:url"
import { build, defineConfig } from "vite"

const entry = fileURLToPath(new URL("./src/playground/modules.js", import.meta.url))
const virtualId = "\0playground:modules"

export default defineConfig({
  plugins: [{
    name: "playground-modules",
    resolveId(id) {
      if (id === "playground:modules") return virtualId
    },
    async load(id) {
      if (id !== virtualId) return
      // A single self-contained module can be loaded from a Blob in an
      // opaque-origin iframe, without CORS or access to the lab's document.
      const result = await build({
        configFile: false,
        logLevel: "warn",
        build: {
          write: false,
          lib: { entry, formats: ["es"] },
          rolldownOptions: { output: { codeSplitting: false } },
        },
      })
      const [{ output }] = [result].flat()
      const bundle = output.find((chunk) => chunk.type === "chunk" && chunk.isEntry)
      return `export default ${JSON.stringify(bundle.code)}`
    },
  }],
})

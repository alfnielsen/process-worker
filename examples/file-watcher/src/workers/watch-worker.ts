import { watch } from "fs"
import { join } from "path"
import { ProcessWorker } from "redis-process-worker"

const w = await ProcessWorker.start("__watch-worker")
const path = join(import.meta.dirname, "..", "watched-directory")

console.log("[watch-worker] Watch worker started")
console.log("[watch-worker] Watching directory:", path)
w.post("ready", { type: "ready", workerName: "__watch-worker" })

// Start watching a directory (using a watch library)
watch(path, { recursive: true }, (eventType, filename) => {
  if (!filename) {
    console.error("filename not provided")
    return
  }
  console.log(`[watch-worker] File change detected: ${eventType} on ${filename}`)
  // Stream the file change event to other workers
  w.post("file-change", {
    type: "file-change",
    eventType,
    filename,
  })
})

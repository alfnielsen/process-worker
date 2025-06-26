import { join } from "path"
import { ProcessWorker } from "redis-process-worker"

const w = await ProcessWorker.start("__logger-worker")

console.log(">>>>> Starting file watcher workers...")

const workerPath = join(import.meta.dirname, "workers")
const watchPath = join(import.meta.dirname, "watched-directory")
// Await for the worker to be ready
// let ready = 0
// await new Promise(resolve => {
//   w.on("ready", data => {
//     if (data.type !== "ready" || data.workerName !== "__logger-worker" || data.workerName !== "__watch-worker") {
//       return
//     }
//     ready++
//     console.log(`Worker ${data.workerName} is ready.`)
//     if (ready == 2) {
//       resolve(true)
//     }
//   })
// })

await Bun.sleep(1000) // Wait 1 seconds

// Start workers in the background using Bun.spawn
const worker1 = Bun.spawn({
  cmd: ["bun", "run", "./logger-worker.ts"],
  cwd: workerPath,
  stdout: "inherit",
  stderr: "inherit",
})
const worker2 = Bun.spawn({
  cmd: ["bun", "run", "./watch-worker.ts"],
  cwd: workerPath,
  stdout: "inherit",
  stderr: "inherit",
})

console.log(">>>>> Creating new file...")
// Create test file
const testFilePath2 = join(watchPath, "test-file-2.ts")
await Bun.write(testFilePath2, "// test\n")
console.log(">>>>> New file created.")
await Bun.sleep(1000) // Wait 1 seconds

console.log(">>>>> Updateing file...")
// Update test file
const testFilePath = join(watchPath, "test-file.ts")
await Bun.write(testFilePath, `// test - ${new Date().toISOString()}\n`)
console.log(">>>>> File updated.")
await Bun.sleep(1000) // Wait 2 seconds

// Clean up test files
// Optionally, kill workers if needed
console.log(">>>>> Killing workers...")
worker1.kill()
worker2.kill()
// Reset test file
await Bun.write(testFilePath, "// test\n")
// Delete test file2
const file = Bun.file(testFilePath2)
await file.delete()

console.log(">>>>> Test completed. All workers killed and files cleaned up.")
process.exit(0)

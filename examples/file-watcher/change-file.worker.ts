import { $, sleep } from "bun";
import { LogRepo } from "../../src";
import { config, logger } from "./app-config";
import { join } from "path";

const c = LogRepo.colors
// Dummy script that change the test-file to trigger the file watcher
// Create a logger for the worker
const log =  logger.titleLogFunc("change-file-worker", "yellow")
await log("Test fiel change worker started", "info")

await sleep(1000) // Wait for the logger to be ready

const newFilePath = join(config.path, "test-file-new.ts")
const filePath = join(config.path, "test-file.ts")


await log(`Begin file changes: ${c.gray}${filePath}${c.reset}`)
// CHANGE FILE: Change the file to trigger the file watcher
await $`echo "console.log('This is a test file')" > ${filePath}`.cwd(config.path).catch((err) => {
  log(`${c.gray}Error changing file${c.reset}`, err)
})
// NEW FILE: Change the file to trigger the file watcher
await $`echo "console.log('This is a test file')" > ${newFilePath}`.cwd(config.path).catch((err) => {
  log(`${c.gray}Error changing file${c.reset}`, err)
})
// Rename the file to trigger the file watcher
await $`mv ${newFilePath} ${filePath}`.cwd(config.path).catch((err) => {
  log(`${c.gray}Error renaming file${c.reset}`, err)
})
await log(`File changed: ${c.gray}${filePath}${c.reset}`)
// Sleep to allow the file watcher to react
await sleep(1000)
await log(`File change worker finished`)
// Exit the worker
process.exit(0)

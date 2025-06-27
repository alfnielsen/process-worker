import { $ } from "bun";
import { LogRepo } from "../../src";
import { config, logger } from "./app-config";

const c = LogRepo.colors
console.clear() // Main worker - clear the console

// Create a logger for the worker
const log =  logger.titleLogFunc("main-worker", "green")
await log("Logger worker started", "info", { workerName: "__logger-worker" })

const workers = [ 
  "change-file.worker.ts",
  // app-config.ts
  "file-watch.worker.ts",
  "log-viewer.worker.ts",
  // main.worker.ts
  "react-to-change.worker.ts",
  // README.md
  // test-file.ts
]

for (const worker of workers) {
  log(`${c.gray}Start worker${c.reset}:${worker}`, config.path)
  $`bun run ${worker}`.cwd(config.path).catch((err) => {
    log(`${c.gray}Error starting ${worker}${c.reset}`, err)
  })
} 



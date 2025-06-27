import { $ } from "bun";
import { LogRepo } from "../../src";
import { logger , config } from "./app-server-config";

const c = LogRepo.colors
console.clear() // Main worker - clear the console

// Create a logger for the worker
const log =  logger.titleLogFunc("main-worker", "green")
await log("Logger worker started", "info")

const workers = [ 
  "server.worker.ts",
  // app-config.ts
  "client.worker.ts",
]

for (const worker of workers) {
  log(`${c.gray}Start worker${c.reset}: ${worker}`, config.path)
  $`bun run ${worker}`.cwd(config.path).catch((err) => {
    log(`${c.gray}Error starting ${worker}${c.reset}`, err)
  })
} 



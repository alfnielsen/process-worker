import { LogRepo } from "../../src";
import { logger } from "./app-config";

const c = LogRepo.colors

const log = logger.titleLogFunc("log-viewer", "magenta")
await log("Log viewer worker started")

logger.listenToLogStream((log) => {
  // DO NOT: use a logger here!! (Triggers a loop)  
  console.log(`${c.magenta}log-stream[${log.type}]: ${log.message}`)
  // Do stuff with the log...
})



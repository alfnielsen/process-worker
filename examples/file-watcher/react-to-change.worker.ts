import { LogRepo } from "../../src";
import { hub, logger } from "./app-config";

const c = LogRepo.colors
const log = logger.titleLogFunc("react-worker", "cyan" )

// Create a hub to publish file change events
hub.listen("file-change", (data) => {
  log(`File change event received: ${data.data}`, "info", data)
  log(`${c.gray}doing stuff...${c.reset}`)
})
// Create a logger for the worker
await log("React to file change worker started")



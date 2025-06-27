import { watch } from "fs";
import { join } from "path";
import { hub, config, logger } from "./app-config";

const log = logger.titleLogFunc("watch-worker", "gray");

log(`Watch worker started`)
log(`Watching directory ${config.path}`, config.path)

// Start watching a directory (using a watch library)
watch(config.path, { recursive: true }, (eventType, filename) => {
  if (!filename) {
    log(`Watch worker started`, "error", {
      eventType,
      filename,
      message: "filename not provided",
    })
    return
  }
  // Log the file change event
  log(`[watch-worker] File change detected: ${eventType} on ${filename}`, "info", {
    eventType,
    filename,
  })
  // Stream the file change event to other workers
  hub.publish("file-change", "file-change", {
    path: config.path,
    fullPath: join(config.path, filename),
    eventType,
    filename,
  })
  
})

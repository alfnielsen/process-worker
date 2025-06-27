import { LogRepo, RedisHub } from "../../src"

const config = {
  appPrefix: "file-watcher",
  path: import.meta.dirname, // this directory!
  logMessageToStdout: true,
} as const

const logger = await LogRepo.createLogger({ logMessageToStdout: config.logMessageToStdout, prefix: config.appPrefix })
const hub = await RedisHub.createHub({ prefix: config.appPrefix })

// Factory function
const createLogger = logger.titleLogFunc.bind(logger)

// Initialize the logger with a message
await logger.log("App config and log initialized", "info", { prefix: config.appPrefix })

export { config, logger, hub, createLogger }

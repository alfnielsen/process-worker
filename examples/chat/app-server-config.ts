import { LogRepo, RedisHub } from "../../src"
import { config as _config } from "./app-config"

const config = {
  ..._config,
  path: import.meta.dirname, // this directory!
  logMessageToStdout: true,
} as const

const logger = await LogRepo.createLogger({ logMessageToStdout: config.logMessageToStdout, prefix: config.appPrefix })
const hub = await RedisHub.createHub({ prefix: config.appPrefix })

// Initialize the logger with a message
await logger.log("app-config imported (There will be one for each process)", "info", { prefix: config.appPrefix })

export { config, logger, hub }

import {  RedisHubSocket } from "../../src";
import { config, logger } from "./app-server-config";

const log =  logger.titleLogFunc("chat-server", "blue")

const hubSocket = await RedisHubSocket.createHub({ prefix: config.appPrefix })
  // Create a new RedisHub
const server = await hubSocket.listen({ port: config.serverPort })
 
await log(`Server listening on port ${config.serverPort}`, "info", { prefix: config.appPrefix })

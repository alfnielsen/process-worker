import { RedisHub } from "../RedisHub/RedisHub"
import RedisRepo, { type EntityId } from "../RedisRepo/RedisRepo"
import type { ILogObject, LogEventHandler, LogType } from "./ILogObject"

// Debug utility
const debug = (...args: any[]) => {
  if (process.env.DEBUG) console.log(...args)
}


export const QUEUE_LOG_KEY = "logQueue"

export type LogId = { id: string } | string

export class LogRepo extends RedisRepo {
  static readonly colors = {
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",    
    reset: "\x1b[0m",
  } as const
  logMessageToStdout: boolean = false
  static async createLogger(opt: {
    prefix?: string,
    queueKey?: string,
    logMessageToStdout?: boolean,
  } = {}): Promise<LogRepo> {
    const hub = await RedisHub.createHub({ prefix: opt.prefix })
    const repo = new LogRepo(hub, opt)
    await repo.waitReady()
    repo.logMessageToStdout = opt.logMessageToStdout || false
    return repo
  }

  constructor(hub: RedisHub, opt: {
    prefix?: string,
    queueKey?: string,
  } = {}) {
    super(hub, {  queueKey: opt.queueKey || QUEUE_LOG_KEY })
  }

  /**
   * Creates a logging function with a specific title and color.
   * @param title 
   * @param color 
   * @returns 
   */
  titleLogFunc(title: string, color: keyof typeof LogRepo.colors = "cyan"): (message: string, type?: LogType, data?: any, level?:string) => Promise<ILogObject> {
    return async (message: string, type: LogType = "info", data?: any, level?:string): Promise<ILogObject> => {
      const logMessage = `${LogRepo.colors[color]}[${title.trim()}]${LogRepo.colors.reset} ${message}`
      return this.log(logMessage, type, data, level)
    }
  }

  async log<TData = any>(message: string, type: LogType = "info", data?: TData, level?:string): Promise<ILogObject<TData>> {
    const log: ILogObject<TData> = {
      id: crypto.randomUUID(),
      type,
      level: level || "info",
      message: message,
      data: data,
      timestamp: Date.now(),
    }
    if(this.logMessageToStdout) {
      console.log(log.message)
      //console.log(`[${log.level}] ${log.message}`, log.data)
    }
    await this.publishLog(log)
    return log
  }

  async publishLog<TData = any>(log: ILogObject<TData>): Promise<void> {
    await this.hub.publish(this.queueKey,"log", log)
  }

  listenToLogStream(eventListener: LogEventHandler) {
    return this.hub.listen(this.queueKey, async (event) => {
      const log = event.data as ILogObject
      eventListener(log)      
    })
  }

  async clearLogQueue(): Promise<void> {
    const storeKey = this.queueKey
    await this.hub.delKey(storeKey)
  }
}

export default LogRepo

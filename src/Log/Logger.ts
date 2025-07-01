import { RedisHub } from "../RedisHub/RedisHub"
import type { ILogObject, LogEventHandler, LogType } from "./ILogObject"

// Debug utility
const debug = (...args: any[]) => {
  if (process.env.DEBUG) console.log(...args)
}


export const LOG_STORE_KEY = "logs" // Base key for log data
export const QUEUE_LOG_KEY = "logs"


export type LogId = { id: string } | string

export class Logger {
  static readonly LOG_STORE_KEY = LOG_STORE_KEY
  static readonly QUEUE_LOG_KEY = QUEUE_LOG_KEY
  logMessageToStdout: boolean = false
  hub: RedisHub
  storeKey: string
  queueKey: string  
  
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

  static async createLogger(opt: {
    prefix?: string,
    queueKey?: string,
    logMessageToStdout?: boolean,
  } = {}): Promise<Logger> {
    const hub = await RedisHub.createHub({ prefix: opt.prefix })
    const repo = new Logger({
      hub: hub,
      storeKey: LOG_STORE_KEY,
      queueKey: opt.queueKey || QUEUE_LOG_KEY,
    })
    await hub.waitReady()
    repo.logMessageToStdout = opt.logMessageToStdout || false
    return repo
  }

  constructor(opt: {
    hub: RedisHub,
    storeKey?: string,
    queueKey?: string,
    logMessageToStdout?: boolean,
  }) {
    this.hub = opt.hub
    this.storeKey = opt.storeKey || `${opt.hub.prefix}:${LOG_STORE_KEY}`
    this.queueKey = opt.queueKey || `${opt.hub.prefix}:${QUEUE_LOG_KEY}`
    this.logMessageToStdout = opt.logMessageToStdout || false
    debug(`[Logger] Initialized with storeKey: ${this.storeKey}, queueKey: ${this.queueKey}`)
  }

  /**
   * Creates a logging function with a specific title and color.
   * @param title 
   * @param color 
   * @returns 
   */
  titleLogFunc(title: string, color: keyof typeof Logger.colors = "cyan"): (message: string, type?: LogType, data?: any, level?:string) => Promise<ILogObject> {
    return async (message: string, type: LogType = "info", data?: any, level?:string): Promise<ILogObject> => {
      const logMessage = `${Logger.colors[color]}[${title.trim()}]${Logger.colors.reset} ${message}`
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


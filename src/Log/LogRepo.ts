import type { IRedisCacheEvent } from "../RedisHub/IRedisCacheEvent"
import RedisHub from "../RedisHub/RedisHub"
import RedisRepo, { type EntityId } from "../RedisRepo/RedisRepo"
import type { ILogObject, LogEventHandler, LogType } from "./ILogObject"

// Debug utility
const debug = (...args: any[]) => {
  if (process.env.DEBUG) console.log(...args)
}

export type LogId = { id: string } | string

export class LogRepo extends RedisRepo {
  static override async createRepo(opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}): Promise<LogRepo> {
    const hub = await RedisHub.createHub({ prefix: opt.prefix })
    const repo = new LogRepo(hub, opt)
    await repo.waitReady()
    return repo
  }

  constructor(hub: RedisHub, opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}) {
    super(hub, { baseKey: opt.baseKey || "logs", queueKey: opt.queueKey || "logQueue" })
  }

  getLogStoreKey(log: LogId, type: string = "log") {
    const id = this.getLogId(log)
    return `${this.baseKey}:${id}:${type}`
  }
  getLogQueueKey(log: LogId): string {
    return `${this.queueKey}`
  }
  getLogId(log: LogId): string {
    if (typeof log === "string") {
      if (!log) throw new Error("Log ID cannot be an empty string")
      return log
    }
    if (!log.id) throw new Error("Log object must have an 'id' property")
    return log.id
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
    await this.saveLog(log)
    return log

  }
  async saveLog<TData = any>(log: ILogObject<TData>): Promise<void> {
    if (!log || !log.id) throw new Error("Log object must have an 'id' property")
    const storeKey = this.getLogStoreKey(log)
    await this.hub.setVal(storeKey, log)
    await this.hub.publish(this.baseKey, log.type || "log", log)
  }

  async publishLog<TData = any>(log: ILogObject<TData>, eventType: string, data: object): Promise<void> {
    const id = this.getLogId(log)
    if (!id) throw new Error("Log ID is required to publish an event")
    const storeKey = this.getLogStoreKey(id, "events")
    await this.hub.publish(storeKey, eventType, data)
    await this.hub.publish(this.baseKey, eventType, { ...data, logId: id })
  }

  listenToLogStream(eventListener: LogEventHandler): void {
    const storeKey = this.baseKey
    this.hub.listen(storeKey, async (event) => {
      const log = event.data as ILogObject
      eventListener(log)
      return true
    })
  }

  async clearLogQueue(): Promise<void> {
    const storeKey = this.queueKey
    await this.hub.delKey(storeKey)
  }
}

export default LogRepo

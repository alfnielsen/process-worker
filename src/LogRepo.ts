import RedisHub, { type RedisCacheEvent } from "./RedisHub"
import RedisRepo, { type EntityId } from "./RedisRepo"

export type LogId = { id: string } | string

type ILogObject<TData = any> = {
  id: string
  type: string
  level: string
  message: string
  data?: TData
  timestamp?: number
}

export type LogEventHandler = (log: ILogObject) => void | boolean | Promise<void | boolean>
export type LogType = "info" | "warn" | "error" | "debug" | "trace" | string

export class LogRequest<TData = any> implements ILogObject<TData> {
  id: string
  type: string
  level: string
  message: string
  data?: TData
  timestamp: number
  events: RedisCacheEvent[] = []
  private _repo: LogRepo
  get repo(): LogRepo {
    return this._repo
  }

  get json(): ILogObject<TData> {
    return {
      id: this.id,
      type: this.type,
      level: this.level,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
    }
  }

  static create<TData = any>(
    opt: { type: string; level: string; message: string } & Partial<ILogObject<TData>>,
    repo: LogRepo
  ): LogRequest<TData> {
    return new LogRequest<TData>({
      id: opt.id || crypto.randomUUID(),
      type: opt.type,
      level: opt.level,
      message: opt.message,
      data: opt.data,
      timestamp: opt.timestamp || Date.now(),
    }, repo)
  }

  private constructor(opt: Partial<ILogObject<TData>> & { type: string; level: string; message: string }, repo: LogRepo) {
    this._repo = repo
    this.id = opt.id || crypto.randomUUID()
    this.type = opt.type
    this.level = opt.level
    this.message = opt.message
    this.data = opt.data
    this.timestamp = opt.timestamp || Date.now()
  }
}

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

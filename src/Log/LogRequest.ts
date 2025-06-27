import type { IRedisCacheEvent } from "../RedisHub/IRedisCacheEvent"
import type { ILogObject } from "./ILogObject"

export class LogRequest<TData = any> implements ILogObject<TData> {
  id: string
  type: string
  level: string
  message: string
  data?: TData
  timestamp: number
  events: IRedisCacheEvent[] = []

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

  private constructor(opt: Partial<ILogObject<TData>> & { type: string; level: string; message: string }) {    
    this.id = opt.id || crypto.randomUUID()
    this.type = opt.type
    this.level = opt.level
    this.message = opt.message
    this.data = opt.data
    this.timestamp = opt.timestamp || Date.now()
  }

  static create<TData = any>(
    opt: Partial<ILogObject<TData>>
  ): LogRequest<TData> {
    return new LogRequest<TData>({
      id: opt.id || crypto.randomUUID(),
      type: opt.type || "info",
      level: opt.level || "info",
      message: opt.message || "",
      data: opt.data,
      timestamp: opt.timestamp || Date.now(),
    })
  }
}

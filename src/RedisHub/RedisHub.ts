import Redis from "ioredis"
import type { IRedisCacheEvent } from "./IRedisCacheEvent"

// Debug utility
const debug = (...args: any[]) => {
  if (process.env.DEBUG) console.log(...args)
}

export class RedisHub {
  protected static redis: Redis
  protected static pub: Redis
  prefix: string = ""
  private _sub: Redis 

  static async createHub(opt: { prefix?: string } = {}) {
    const instance = new RedisHub(opt)
    if (!RedisHub.redis) {
      RedisHub.redis = new Redis()
    }
    if (!RedisHub.pub) {
      RedisHub.pub = new Redis() // Use a separate instance for publishing
    }
    // Wait for Redis to be ready
    await instance.waitReady()
    debug(`[RedisHub.createHub] RedisHub instance created with prefix: '${instance.prefix}'`)
    // Return the instance
    if (opt.prefix) {
      instance.prefix = opt.prefix
      debug(`[RedisHub.createHub] RedisHub prefix set to: '${instance.prefix}'`)
    }
    return instance
  }

  static async getStreamValues(
    redis: Redis = RedisHub.redis,
    stream: string, start: string = "-", end: string = "+", count: number = 1000
  ) {
    const streamItems = await redis.xrange(stream, start, end, "COUNT", count)
    const result: IRedisCacheEvent[] = []
    for (const streamItem of streamItems) {
      const [id, item] = streamItem
      const [type, data] = item
      if (!id || !type) {
        console.warn(`Invalid item format in stream ${stream}: ${JSON.stringify(streamItem)}`)
        continue // Skip invalid items
      }
      const parsedData = data ? JSON.parse(data) : {}
      const event: IRedisCacheEvent = {
        id: id,
        type: type,
        data: parsedData,
      }
      result.push(event)
    }
    return result
  }

  static listen<TData extends object = object>(
    sub: Redis,
    stream: string,
    handler: (event: IRedisCacheEvent<TData>) => void | boolean | Promise<void | boolean>
  ) {
    let lastId = "$"
    const listenForNext = async () => {
      const results = await sub.xread("BLOCK", 0, "STREAMS", stream, lastId)
      if (results === null) {
        listenForNext()
        return
      }
      const res = results[0]
      if (!res || res.length !== 2) {
        throw new Error(`Unexpected response from Redis: ${JSON.stringify(res)}`)
      }
      const [_, messages] = res
      for (const [id, [type, data]] of messages) {
        const _data = data ? JSON.parse(data) : {}
        if (!id || !type) {
          console.warn(`Invalid message format in stream ${stream}: ${JSON.stringify(messages)}`)
          continue
        }
        const event: IRedisCacheEvent<TData> = { id, type, data: _data }
        const response = handler(event)
        const stop = response instanceof Promise ? await response : response
        if (stop === false || event.type === "complete" || stop === true) {
          return
        }
      }
      const last = messages[messages.length - 1]
      lastId = last?.[0] ?? "$"
      await listenForNext()
    }
    listenForNext()
    // return unsubscribe
    return () => {
      sub.unsubscribe(stream)
      debug(`[RedisHub.listen] Unsubscribed from stream: ${stream}`)
    }

  }

  protected constructor(opt: { prefix?: string } = {}) {
    this.prefix = opt.prefix || this.prefix
    if (!RedisHub.redis) {
      RedisHub.redis = new Redis()
    }
    this._sub = new Redis() // Use the same Redis instance for subscribing
    if (!RedisHub.pub) {
      RedisHub.pub = new Redis() // Use a separate instance for publishing
    }
  }
  get redis() {
    return RedisHub.redis
  }
  get sub() {
    return this._sub
  }
  get pub() {
    return RedisHub.pub
  }

  private key(key: string, ignorePrefix: boolean = false) {
    if (ignorePrefix || !this.prefix) return key
    // Always add a colon between prefix and key
    const k = `${this.prefix.endsWith(":") ? this.prefix : this.prefix + ":"}${key}`
    debug(`[RedisHub.key] prefix: '${this.prefix}', key: '${key}', result: '${k}'`)
    return k
  }

  async quit() {
    debug("[RedisHub.quit] Quitting RedisHub...")
    await this.sub?.quit()
    debug("[RedisHub.quit] Subscriber connection closed.")
    await this.redis?.quit()
    debug("[RedisHub.quit] Redis connection closed.")
    await this.pub?.quit()
  }

  async publish(stream: string, type: string, payload: any) {
    if (!stream || !type) {
      throw new Error("Stream and type are required for publishing")
    }
    const _key = this.key(stream)
    this.pub.xadd(_key, "*", type, JSON.stringify(payload))
    return { stream, payload }
  }
  
  async setVal(key: string, value: any, ignorePrefix: boolean = false) {
    const _key = this.key(key)
    await this.redis.set(_key, JSON.stringify(value))
    return this
  }

  async getVal<T>(key: string, ignorePrefix: boolean = false): Promise<T | undefined> {
    const _key = this.key(key, ignorePrefix)
    const value = await this.redis.get(_key)
    return value ? (JSON.parse(value) as T) : undefined
  }

  async getRawVal(key: string, ignorePrefix: boolean = false): Promise<string | undefined> {
    const _key = this.key(key, ignorePrefix)
    const value = await this.redis.get(_key)
    return value ? value : undefined
  }
  async delKey(key: string, ignorePrefix: boolean = false) {
    const _key = this.key(key, ignorePrefix)
    await this.redis.del(_key)
    return this
  }

  async delKeys(pattern: string, ignorePrefix: boolean = false) {
    const _key = this.key(pattern, ignorePrefix)
    const foundKeys = await this.redis.keys(_key)

    if (foundKeys.length === 0) {
      return this // No keys to delete
    }
    const pipeline = this.redis.pipeline()
    for (const key of foundKeys) {
      pipeline.del(key)
    }
    await pipeline.exec()
    return this
  }

  async getKeys(pattern: string, ignorePrefix: boolean = false): Promise<string[]> {
    const _key = this.key(pattern, ignorePrefix)
    const keys = await this.redis.keys(_key)
    return keys
  }

  listen<TData extends object = object>(
    stream: string,
    handler: (message: IRedisCacheEvent) => void | boolean | Promise<void | boolean>,
    ignorePrefix: boolean = false
  ) {
    const _key = this.key(stream, ignorePrefix)
    // Start listening for messages on the stream
    return RedisHub.listen<TData>(
      this._sub, // Use the subscriber instance
      _key,
      handler
  )
  }

  async getStreamValues(
    stream: string,
    start: string = "-",
    end: string = "+",
    count: number = 1000,
    ignorePrefix: boolean = false
  ) {
    const _key = this.key(stream, ignorePrefix)
    return await RedisHub.getStreamValues(
      this.redis,  
      _key, start, end, count)
  }

  async waitReady() {
    if (this._sub) {
      await this._waitReady(this._sub)      
    }
    await this._waitReady(this.redis)
    await this._waitReady(this.pub)
    debug(`[RedisHub.waitReady] RedisHub is ready with prefix: '${this.prefix}'`)
  }

  private async _waitReady(repo: any) {
    let ready = false
    for (let i = 0; i < 20 && !ready; i++) {
      try {
        // Use the correct Redis instance method for ping
        if (typeof repo.ping === "function") {
          await repo.ping()
          ready = true
        } else {
          throw new Error("Invalid Redis instance: missing ping method")
        }
      } catch (e) {
        await Bun.sleep(100)
        debug(`[RedisHub.waitReady] Attempt ${i + 1}: Redis not ready yet, retrying...`)
      }
    }
    if (!ready) throw new Error("Redis connection not ready")
  }
}

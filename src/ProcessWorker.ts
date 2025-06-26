import { createClient, type RedisArgument, type RedisClientType } from "redis"

/**
 * Options for configuring a ProcessWorker instance.
 */
export interface ProcessWorkerOptions {
  /**
   * Optional prefix for the Redis keys used by the worker.
   * This can be useful for namespacing keys in a shared Redis instance.
   * Default is undefined, meaning no prefix will be used.
   */
  prefix?: string

  /**
   * The name of the worker, used for logging and identification.
   */
  workerName?: string
  /**
   * Whether to log messages to stdout.
   * Default is false.
   * If true, logs will be printed to the console.
   * Otherwise, logs will only be posted to the Redis stream.
   */
  logStdout?: boolean
  /**
   * Interval in seconds for posting status logs.
   * This is useful for monitoring worker health and performance,
   * and if the worker is actually running.
   * Default is 10 seconds.
   * Set to 0 to disable status logging.
   * 
   * This is similar to a pulse check, allowing you to see if the worker is active.
   * 
   */
  postStatusLogInterval?: number
  /**
   * Function or object providing status data to be included in status logs.
   * This can be used to provide additional context or metrics about the worker's state.
   * If a function is provided, it will be called to get the status data.
   * If an object is provided, it will be used directly.
   * Default is undefined, meaning no status data will be included.
   */
  statusData?: (() => Record<string, any>) | Record<string, any>
}

/**
 * ProcessWorker is a helper class for creating background workers that can listen to streams, post messages,
 * log messages, and use a global cache and stream. It provides a simple interface for decoupling worker logic
 * from stream handling logic, and enables decoupled communication between the worker and other processes.
 */
export class ProcessWorker {
  logStdout: boolean
  postStatusLogInterval: number
  statusData: (() => Record<string, any>) | Record<string, any> | undefined
  private workerName: string
  private redis: RedisClientType | undefined // Redis client for interacting with the global cache and logging streams
  private subscriber: RedisClientType | undefined // Redis subscriber for listening to streams
  private workerSessionId: string
  private _started = false
  /**
   * Indicates whether the worker has been started.
   * This is true after the worker has been initialized and connected to Redis.
   */
  get started() {
    return this._started
  }
  /**
   * Returns the Redis client used by the worker.
   * This can be used to perform additional Redis operations if needed.
   */
  get redisClient() {
    return this.redis
  }
  /**
   * Returns the Redis subscriber client used by the worker.
   * This can be used to listen to streams and receive messages.
   */
  get subscriberClient() {
    return this.subscriber
  }
  /**
   * Returns the unique session ID for this worker instance.
   * This can be used to track logs and messages related to this specific worker session.
   */
  get sessionId() {
    return this.workerSessionId
  }

  /**
   * Constructs a new ProcessWorker instance with the given options.
   * @param options Configuration options for the worker.
   */
  private constructor(options: ProcessWorkerOptions) {
    this.workerName = options.workerName || `worker-${crypto.randomUUID()}`
    this.logStdout = options.logStdout ?? false
    this.postStatusLogInterval = options.postStatusLogInterval ?? 10
    this.statusData = options.statusData
    this.workerSessionId = crypto.randomUUID()
  }

  /**
   * Overload: Starts and initializes a new ProcessWorker instance with only a worker name.
   * @param workerName The name of the worker.
   * @returns A started ProcessWorker instance.
   */
  static async start(workerName: string): Promise<ProcessWorker>
  /**
   * Starts and initializes a new ProcessWorker instance.
   * @param options Configuration options for the worker.
   * @returns A started ProcessWorker instance.
   */
  static async start(options: ProcessWorkerOptions): Promise<ProcessWorker>
  static async start(
    optionsOrName: ProcessWorkerOptions | string,
  ): Promise<ProcessWorker> {
    const options: ProcessWorkerOptions =
      typeof optionsOrName === "string"
        ? { workerName: optionsOrName }
        : optionsOrName
    const worker = new ProcessWorker(options)
    await worker.start()
    if (!worker.redis || !worker.subscriber) {
      throw new Error("Failed to connect to Redis")
    }
    return worker
  }

  async onEvent(
    type: "set" | "del" | "expired" | "evicted" | "rename_from" | "rename_to" | "expire",
    callback: (value: any) => void
  ){
    const subscriber = this.subscriber
    if (!this._started || !subscriber) throw new Error("Worker not started")
      const dbIndex = 0 // Assuming default DB index is 0, adjust if needed
    const notificationChannel = `__keyspace@${dbIndex}__:*`
    await subscriber.subscribe(notificationChannel, (channel, notificationType) => {
      const key = channel.split(":")[2]
      console.log(`Received notification: [${channel}] ${notificationType} for key: ${key}`)
      callback(key)
    })

  }


//     console.log('Key "' + key + '" set!');
//     break;
//   case EVENT_DEL:
//     console.log('Key "' + key + '" deleted!');
//     break;
//   }
// });

// client.subscribe(EVENT_SET, EVENT_DEL);
    
  
  /**
   * Posts a message to a specific stream.
   * @param type The stream name/type.
   * @param data The message data to post.
   * @param redisStreamId The Redis stream ID (default: "*").
   * @returns The stream ID of the posted message.
   */
  async post<T extends Record<string, RedisArgument> >(
    type: string,
    data: T,
    redisStreamId: string = "*"
  ) {
    if (!this._started) {
      new Error("Worker not started")
    }
    //console.log(`Posting to stream: ${type} with ID: ${redisStreamId}`, data)
    const streamId = await this.redis?.xAdd(`${type}`, redisStreamId, data)
    //console.log(`Posted to stream: ${type} with ID: ${streamId}`, data)
    return streamId
  }


  /**
   * Retrieves data from the global cache table.
   * @param key The cache key.
   * @param defaultValue The default value to return if the key is not found.
   * @returns The value associated with the key, or the default value.
   */
  async get<T = any>(
    key: string,
    defaultValue?: T
  ): Promise<T| undefined> {
    if (!this._started) throw new Error("Worker not started")
    let value = await this.redis?.get(key)
    if (value === null || value === undefined) {
      return defaultValue !== undefined ? defaultValue : undefined as T
    }
    try {
      return JSON.parse(value)
    } catch {
      return value as T
    }
  }

  /**
   * Stores data in the global cache table.
   * @param key The cache key.
   * @param value The value to store.
   */
  async set<T = any>(
    key: string,
    value: T
  ): Promise<void> {
    if (!this._started || !this.redis) throw new Error("Worker not started")
    let storeValue: string
    if (typeof value === "object" && value !== null) {
      storeValue = JSON.stringify(value)
    } else {
      storeValue = String(value)
    }
    console.log(`Setting key "${key}" with value:`, storeValue)
    await this.redis.set(key, storeValue)
  }

  /**
   * Initializes the worker, connects to Redis, and starts status logging.
   */
  async start() {
    if (this._started) return
    this.redis = createClient()
    this.subscriber = createClient()
    // Enable keyspace notifications for subscribing to key events (keys + expiration)
    // https://redis.io/docs/latest/develop/use/keyspace-notifications/
    await Promise.all([
      this.redis.connect(),
      this.subscriber.connect()
    ])
    await this.subscriber.configSet("notify-keyspace-events", "Ex");

    this.redis.on("error", (err: any) => {
      this.log(`Redis error: ${err.message}`, { error: err.message })
    })
    this.subscriber.on("error", (err: any) => {
      this.log(`Redis subscriber error: ${err.message}`, { error: err.message })
    })
    this.log(`${this.workerName} started`, {
      workerName: this.workerName,
      process: {
        ppid: process.ppid,
        cwd: process.cwd(),
        isTTY: process.stdout.isTTY,
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || "development",
      },
    })
    this._started = true
    if (this.postStatusLogInterval > 0) {
      setInterval(() => {
        const createdTime = new Date().toISOString()
        const data = typeof this.statusData === "function" ? this.statusData() : this.statusData || {}
        this.log(`Worker-Status: ${this.workerName} - "${createdTime}"`, {
          createdTime,
          process: {
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
          },
          ...data,
        })
      }, this.postStatusLogInterval * 1000)
    }
  }

  /**
   * Logs a message to the global logging stream and optionally to stdout.
   * @param msg The log message.
   * @param data Additional data to include in the log entry.
   */
  log(msg: string, data: Record<string, any> = {}) {
    const entry: any = {
      worker: this.workerName,
      workerSessionId: this.workerSessionId,
      logId: crypto.randomUUID(),
      createdTime: data?.createdTime || new Date().toISOString(),
      message: msg,
      error: data?.error || "",
      data: JSON.stringify(data),
    }
    if (this.logStdout) {
      if (data && data.error) {
        console.error(`[${this.workerName}-Error] "${msg}"`, JSON.stringify(entry, null, 2))
      } else {
        console.log(`[${this.workerName}] "${msg}"`, JSON.stringify(entry, null, 2))
      }
    }
    if (this.redis && this.redis.xAdd) {
      this.redis.xAdd("logs", "*", entry)
    }
  }

  /**
   * Listens to a specific stream and handles incoming messages with a callback.
   * @param pattern The stream name/pattern to listen to.
   * @param onMessage Callback function to handle incoming messages.
   * @param lastId The last stream ID to start listening from (default: "$" for latest).
   */
  on<T = any>(
    pattern: string,
    onMessage: (data: T) => Promise<void> | void,
    lastId: string = "$"
  ) {
    const subscriber = this.subscriber
    const log = this.log.bind(this)
    let unsubscribe = false
    async function loop(currentId: string) {
      if (unsubscribe) {
        // This stops the reading, and exits the loop
        log(`Stopped listening to stream: ${pattern}`)
        return
      }
      try {
        const response = await subscriber?.xRead(
          [{ key: pattern, id: currentId }],
          { BLOCK: 0 }
        )
        if (Array.isArray(response)) {
          for (const stream of response) {
            if (
              stream &&
              typeof stream === "object" &&
              "messages" in stream &&
              Array.isArray((stream as any).messages)
            ) {
              for (const message of (stream as any).messages) {
                currentId = message.id
                onMessage(message.message as T)
              }
            }
          }
        }
      } catch (err) {
        log("Error in XREAD loop", { error: err instanceof Error ? err.message : String(err) })
        await new Promise(res => setTimeout(res, 500))
      }
      setImmediate(() => loop(currentId))
    }
    loop(lastId)
    // return a cleanup function to stop listening
    return () => {
      unsubscribe = true
    }
  }

  /**
   * Shuts down the worker and disconnects from Redis.
   * @param reason The reason for shutdown (default: "manual").
   */
  async shutdown(reason = "manual") {
    if (!this._started) return
    this.log(`Shutting down ProcessWorker: ${reason}`)
    try {
      await this.redis?.quit?.()
      await this.subscriber?.quit?.()
    } catch (err) {
      this.log(`Error during shutdown: ${(err as Error).message}`, { error: (err as Error).message })
    }
    this._started = false
  }
}
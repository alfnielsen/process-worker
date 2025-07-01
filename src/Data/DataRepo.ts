// DataRepo: A generic data repository for storing, retrieving, and streaming data objects in Redis.
// Supports main data object, subkey storage, event publishing/listening, and dynamic sub-references.
import {RedisHub} from "../RedisHub/RedisHub"
import {RedisRepo} from "../RedisRepo/RedisRepo"
import createDebug from "debug"

const debug = createDebug("DataRepo")

export class Data<IData extends object = object> extends RedisRepo {
  // Name of the data object (used in keys)
  name: string
  // The main data object
  data: IData = {} as IData
  // Redis key for storing the main data
  // The prefix for this data instance (public for test access)
  public prefix: string

  /**
   * Get a Data instance. Loads or creates if not found.
   * @param opt - Options for data instance (name, prefix, optional initial data)
   */
  static async get<IData extends object = object>(opt: {
    name: string,
    prefix: string,
    data?: IData
  }): Promise<Data<IData>> {
    const hub = await RedisHub.createHub({ prefix: "" })
    const repo = new Data<IData>({
      name: opt.name,
      hub,
      prefix: opt.prefix,
      storeKey: `${opt.prefix}:data:${opt.name}`,
      queueKey: `${opt.prefix}:dataQueue:${opt.name}`,
    })
    await repo.load()
    if (opt.data) {
      await repo.setData(opt.data)
    }
    return repo
  }

  /**
   * Constructor for Data. Use static get() for most use cases.
   */
  constructor(opt: {
    name: string,
    hub: RedisHub,
    prefix?: string,
    storeKey?: string,
    queueKey?: string,
  }) {
    super(opt.hub, {
      prefix: opt.prefix || "",
      storeKey: opt.storeKey || `${opt.prefix || ""}:data:${opt.name}`,
      queueKey: opt.queueKey || `${opt.prefix || ""}:dataQueue:${opt.name}`,
    })
    this.name = opt.name
    this.prefix = opt.prefix || ""
    this.storeKey = opt.storeKey || `${opt.prefix || ""}:data:${opt.name}`
    this.queueKey = opt.queueKey || `${opt.prefix || ""}:dataQueue:${opt.name}`
    this.hub = opt.hub
  }

  /**
   * Load the main data object and metadata from Redis.
   * If not found, saves the initial state.
   */
  async load(): Promise<void> {
    const storeKey = this.storeKey
    const val = await this.hub.getVal<{ name: string; storeKey: string; queueKey: string; prefix: string; data?: IData }>(storeKey)
    if (!val) {
      await this.save()
    } else {
      this.name = val.name
      this.storeKey = val.storeKey
      this.queueKey = val.queueKey
      this.data = val.data || ({} as IData)
    }
  }

  /**
   * Save the main data object and metadata to Redis.
   */
  async save(): Promise<void> {
    const storeKey = this.storeKey
    const data = {
      name: this.name,
      storeKey: this.storeKey,
      queueKey: this.queueKey,
      data: this.data
    }
    await this.hub.setVal(storeKey, data)
  }

  /**
   * Get the main data object from Redis.
   * @returns The main data object
   */
  async getData(): Promise<IData> {
    const storeKey = this.storeKey
    const val = await this.hub.getVal<{ data: IData }>(storeKey)
    this.data = val?.data || ({} as IData)
    return this.data
  }

  /**
   * Set and save the main data object to Redis.
   * @param data - The new data object
   */
  async setData(data: IData): Promise<void> {
    this.data = data
    await this.save()
  }

  /**
   * Get a value for a subkey (not the main data object).
   * @param key - The subkey name
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    return await this.hub.getVal<T>(`${this.storeKey}:${key}`)
  }
  /**
   * Set a value for a subkey (not the main data object).
   * @param key - The subkey name
   * @param value - The value to store
   */
  async set<T = any>(key: string, value: T): Promise<void> {
    await this.hub.setVal(`${this.storeKey}:${key}`, value)
  }

  /**
   * Publish an event to the data's event stream.
   * @param event - The event object (must have a type)
   */
  async publish<T extends { type: string; data?: any }>(event: T): Promise<void> {
    await this.hub.publish(`${this.storeKey}:events`, event.type, event.data ?? event)
  }

  /**
   * Listen for events on the data's event stream.
   * @param cb - Callback for each event message
   */
  async listen<T extends object>(cb: (msg: T) => void): Promise<void> {
    this.hub.listen<T>(`${this.storeKey}:events`, (event) => {
      cb(event.data as T)
    })
  }

  /**
   * Create a dynamic sub-repo for a type/category under this data object.
   * @param typeName - The type/category name
   * @returns A new Data instance scoped to the type
   */
  subType(typeName: string): Data<IData> {
    return new Data<IData>({
      name: this.name,
      hub: this.hub,
      prefix: `${this.storeKey}:${typeName}`,
      storeKey: `${this.storeKey}:${typeName}`,
      queueKey: `${this.storeKey}:${typeName}:queue`,
    })
  }

}

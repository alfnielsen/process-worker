import {RedisHub} from "../RedisHub/RedisHub"
import {RedisRepo,  type EntityId } from "../RedisRepo/RedisRepo"
import createDebug from "debug"
import { Data } from "./DataRepo"
import { Logger } from "../Log/Logger"
import { RedisHubSocket } from "../RedisHub/RedisHubSocket"

const debug = createDebug("ProjectRepo")

export class Project<ISettings extends object = object> extends RedisRepo {
  static storeKeyPrefix = "projects" // Base key for project data
  static queueKeyPrefix = "projectEvents" // Key for project request queue
  static globalPrefix = "" // Global prefix for all projects
  // All Data is saved at `${prefix}:${type}:${name|id}...`
  name: string
  prefix: string = ""
  settings: ISettings = {} as ISettings
  override storeKey: string
  override queueKey: string
  override hub: RedisHub
  logger: Logger // Logger instance for this project

  /**
   * Get a DataRepo instance.
   * It is loaded or created if it does not exist.
   * @param opt 
   * @returns 
   */
  static async project<ISettings extends object = object>(opt: {
    name: string,
    prefix: string
    logMessageToStdout?: boolean,
    settings?: ISettings
  }): Promise<Project<ISettings>> {
    // Global space (prefix) for loading projects
    const hub = await RedisHub.createHub({ prefix: Project.globalPrefix }) 
    const project = new Project<ISettings>({
      name: opt.name,
      hub: hub, 
      prefix: opt.prefix,
      // Global store keys (Normally "projects:<name>")
      storeKey: `${Project.storeKeyPrefix}:${opt.name}`,
      // Global queue keys (Normally "projectEvents:<name>")
      queueKey: `${Project.queueKeyPrefix}:${opt.name}`,
      settings: opt.settings // Pass initial settings to constructor
    })
    // Set settings on the instance before load, so load/save will persist them
    if (opt.settings) project.settings = opt.settings
    await project.load()
    // Ensure instance settings are in sync after load
    project.settings = await project.getSettings()
    // Change the project scope (add prefix) - Update the HUB prefix
    project.hub.prefix = Project.globalPrefix + opt.prefix
    // Create the RedisHub instance
    await hub.waitReady()
    return project
  }

  constructor(
    opt: {
      name: string,
      hub: RedisHub,
      logger?: Logger,
      prefix?: string,
      storeKey?: string,
      queueKey?: string,
      settings?: ISettings
    }
  ) {
    super(opt.hub, {
      prefix: opt.prefix || "",
      storeKey: opt.storeKey || `${Project.storeKeyPrefix}:${opt.name}`,
      queueKey: opt.queueKey || `${Project.queueKeyPrefix}:${opt.name}`,
    })
    this.name = opt.name
    this.prefix = opt.prefix || ""
    this.storeKey = opt.storeKey || `${Project.storeKeyPrefix}:${opt.name}`
    this.queueKey = opt.queueKey || `${Project.queueKeyPrefix}:${opt.name}`
    this.hub = opt.hub
    this.logger = opt.logger || new Logger({
      hub: this.hub,
      storeKey: Logger.LOG_STORE_KEY,
      queueKey: Logger.QUEUE_LOG_KEY,
      logMessageToStdout: false, // Default to false, can be overridden
    })
    this.settings = opt.settings || ({} as ISettings)    
  }

  async load(_settings?: ISettings): Promise<void> {
    const storeKey = this.storeKey     
    const val = await this.hub.getVal<{
      name: string,
      storeKey: string,
      queueKey: string,
      prefix: string,
      settings?: ISettings
    }>(storeKey)
    if (!val) {
      // Use the instance's settings property, which should be set by the constructor or static method
      await this.save() // Save the initial state if not found
    } else {
      this.name = val.name
      this.storeKey = val.storeKey
      this.queueKey = val.queueKey
      this.prefix = val.prefix || ""
      this.settings = val.settings || ({} as ISettings)
    }    
  } 

  async save(): Promise<void> {
    const storeKey = this.storeKey
    const data = {
      name: this.name,
      storeKey: this.storeKey,
      queueKey: this.queueKey,
      prefix: this.prefix,
      settings: this.settings
    }
    await this.hub.setVal(storeKey, data)
  }

  // Settings management
  async getSettings(): Promise<ISettings> {
    const storeKey = this.storeKey
    const val = await this.hub.getVal<any>(storeKey)
    // Defensive: if val.settings exists, use it; if val looks like settings, use it; else return {}
    if (val && typeof val === "object" && "settings" in val && val.settings && typeof val.settings === "object") {
      this.settings = val.settings
    } else if (val && typeof val === "object" && Object.keys(val).length && !("name" in val) && !("storeKey" in val)) {
      // If val is not the full project object, but looks like settings
      this.settings = val as ISettings
    } else {
      this.settings = {} as ISettings
    }
    return this.settings
  }

  async setSettings(settings: ISettings): Promise<void> {
    this.settings = settings
    await this.save()
  }

  // Publish/Listen (event stream)
  async publish<T extends { type: string; data?: any }>(event: T): Promise<void> {
    await this.hub.publish(`events:${this.name}`, event.type, event.data ?? event)
  }

  async listen<T extends object>(cb: (msg: T) => void): Promise<void> {
    this.hub.listen<T>(`events:${this.name}`, (event) => {
      cb(event.data as T)
    })
  }

  // Generic get/set for project data
  async get<T = any>(key: string): Promise<T | undefined> {
    return await this.hub.getVal<T>(`data:${this.name}:${key}`)
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    await this.hub.setVal(`data:${this.name}:${key}`, value)
  }

  
  /**
   * Create a dynamic type/category under this data object.
   * @param typeName - The type/category name
   * @returns A new Data instance scoped to the type
   */
  type<IData extends object>(typeName: string): Data<IData> {
    return new Data({
      name: this.name,
      hub: this.hub,
      prefix: `${this.prefix}:${typeName}`,
      storeKey: `${this.prefix}:${typeName}`,
      queueKey: `${this.prefix}:${typeName}:queue`,
    })
  }

  /**
   * Create a logger instance for this data repo.
   * @param opt 
   * @returns 
   */
  createLogger(title: string, color: keyof typeof Logger.colors = "cyan") {
    return this.logger.titleLogFunc(title, color)
  }

  /**
   * Create a websocket logger function for this project.
   * @param opt 
   * @returns 
   */
  async createHubWebSocket() {
    const hubSocket = await RedisHubSocket.createHub({ prefix: this.hub.prefix })
    return hubSocket
  }

}

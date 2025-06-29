import {RedisHub} from "../RedisHub/RedisHub"

// EntityId can be a string or an object with an id property
export type EntityId = { id: string } | string

/**
 * RedisRepo: Base class for repositories using Redis for storage.
 * Provides methods for creating a RedisHub, managing entity keys, and waiting for readiness.
 */
export class RedisRepo {
  hub: RedisHub // The RedisHub instance used for Redis operations
  baseKey: string // The base key for storing entities
  queueKey: string // The key for the entity queue

  /**
   * Create a RedisHub instance with an optional prefix.
   */
  static async createHub(opt: {
    prefix?: string,
  }) {
    const hub = await RedisHub.createHub({ prefix: opt.prefix })
    return hub        
  }

  /**
   * Create a RedisRepo instance with optional baseKey and queueKey.
   * This also creates a RedisHub instance.
   */
  static async createRedisRepo(opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,  
  } = {}): Promise<RedisRepo> {
    // Create hub and repo
    const hub = await this.createHub({ prefix: opt.prefix })
    const repo = new RedisRepo(hub, opt)
    return repo
  }

  /**
   * Constructor for RedisRepo.
   * @param redisHub The RedisHub instance
   * @param opt Optional settings for baseKey and queueKey
   */
  constructor(redisHub:RedisHub, opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}) {
    this.hub = redisHub
    this.baseKey = opt.baseKey || "entities"
    this.queueKey = opt.queueKey || "entityQueue"
  }

  /**
   * Get the string ID from an EntityId (string or object with id).
   * Throws if the ID is missing or invalid.
   */
  protected getEntityId(entity: EntityId): string {
    if (typeof entity === "string") {
      if (!entity) {
        throw new Error("Entity ID cannot be an empty string")
      }
      return entity
    }
    if (!entity.id) {
      throw new Error("Entity object must have an 'id' property")
    }
    return entity.id
  }
  
    // Redis keys for action data
    getStoreKey(action: EntityId, type: string = "data"): string {
      const id = this.getEntityId(action)
      const key = `${this.baseKey}:${id}:${type}`
      //console.log(`[ActionRepo.getActionStoreKey] id: ${id}, type: ${type}, key: ${key}`)
      return key
    }
    
     getQueueKey(action: EntityId): string {
      const id = this.getEntityId(action)
      return `${this.queueKey}`
      //return `${this.queueKey}:${id}`
     }
  
  /**
   * Wait for the underlying RedisHub to be ready.
   */
  waitReady(): Promise<void> {
    return this.hub.waitReady()
  }
}

export default RedisRepo

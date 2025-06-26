import RedisHub from "./RedisHub"

export type EntityId = { id: string } | string

export class RedisRepo {
  hub: RedisHub
  baseKey: string
    queueKey: string
    
    static async createHub(opt: {
        prefix?: string,
    }) {
        const hub = await RedisHub.createHub({ prefix: opt.prefix })
        return hub        
    }
    static async createRepo(opt: {
        prefix?: string,
        baseKey?: string,
        queueKey?: string,  
    } = {}): Promise<RedisRepo> {
        //create hub and repo
        const hub = await this.createHub({ prefix: opt.prefix })
        const repo = new RedisRepo(hub, opt)
        return repo
  }

  constructor(redisHub:RedisHub, opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}) {
    this.hub = redisHub
    this.baseKey = opt.baseKey || "entities"
    this.queueKey = opt.queueKey || "entityQueue"
  }

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
  waitReady(): Promise<void> {
    return this.hub.waitReady()
  }
}

export default RedisRepo

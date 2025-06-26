import RedisHub from "./RedisHub"

export type EntityId = { id: string } | string

export class RedisRepo {
  hub: RedisHub
  baseKey: string
  queueKey: string

  constructor(opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}) {
    this.hub = RedisHub.createHub({ prefix: opt.prefix })
    this.baseKey = opt.baseKey || "action"
    this.queueKey = opt.queueKey || "actionQueue"
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
}

export default RedisRepo

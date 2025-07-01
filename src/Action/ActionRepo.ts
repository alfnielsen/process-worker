import {RedisHub} from "../RedisHub/RedisHub"
import  {RedisRepo,  type EntityId } from "../RedisRepo/RedisRepo"
import { ActionRequest } from "./ActionRequest"
import createDebug from "debug"
import type { IActionObject, IActionObjectAny, IActionObjectWithEvents, ActionEventHandler, ActionQueueEventHandler, ActionStatus } from "./IActionRequest"
const debug = createDebug("ActionRepo")

export class ActionRepo extends RedisRepo {
  static  async createActionRepo(opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}): Promise<ActionRepo> {
    const hub = await RedisHub.createHub({ prefix: opt.prefix })
    const repo = new ActionRepo(hub, opt)
    await repo.waitReady()
    return repo
  }

  constructor(hub:RedisHub, opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}) {
    super(hub, opt)
  }


  
  create<
    TArg extends object,
    TData extends object = object,
    TError extends object | undefined = undefined,
    TOutput extends object | undefined = undefined,
  >(
    opt: { name: string } & Partial<IActionObject<TArg, TData, TError, TOutput>>,
  ): ActionRequest<TArg, TData, TError, TOutput> {
    // Provide all needed functions to ActionRequest
    return new ActionRequest<TArg, TData, TError, TOutput>(
      {
        id: opt.id || (crypto.randomUUID() as string),
        name: opt.name || "Unnamed Action",
        created: Date.now(),
        arg: opt.arg || ({} as TArg),
        data: opt.data || ({} as TData),
        error: opt.error,
        output: opt.output,
        status: opt.status || "pending",
        events: (opt as any).events || [],
      },
      {
        publish: (action: ActionRequest<any, any, any, any>, eventType: string, data: object) => this.publish(action, eventType, data),
        publishToRequestQueue: (action: ActionRequest<any, any, any, any>) => this.publishToRequestQueue(action),
        listen: (action: ActionRequest<any, any, any, any>, handler: ActionEventHandler) => this.listen(action, handler),
        getVal: (action: ActionRequest<any, any, any, any>, type: string) => this.getVal(action, type),
        setVal: (action: ActionRequest<any, any, any, any>, type: string, value: any) => this.setVal(action, type, value),
        saveAction: (action: ActionRequest<any, any, any, any>) => this.saveAction(action),
      }
    )
  }

  fromJSON<
    TArg extends object,
    TData extends object,
    TError extends object | undefined,
    TOutput extends object | undefined,
    >(
      json: string | object,
  ): ActionRequest<TArg, TData, TError, TOutput> {
    try {
      const parsed = typeof json === "string" ? JSON.parse(json) : json
      if (!parsed || !parsed.id || !parsed.name) {
        throw new Error("Invalid action object: must contain 'id' and 'name' properties")
      }
      const data: IActionObjectWithEvents<TArg, TData, TError, TOutput> = {
        id: parsed.id,
        name: parsed.name,
        created: parsed.created || Date.now(),
        arg: parsed.arg || {},
        data: parsed.data || {},
        error: parsed.error,
        output: parsed.output || {},
        status: parsed.status || "pending",
        events: parsed.events || [],
      }
      const parsedEvents = Array.isArray(parsed.events) ? parsed.events : []
      if (parsedEvents.length > 0) {
        data.events = parsedEvents.map((event: any) => ({
          id: event.id || (crypto.randomUUID() as string),
          type: event.type || "unknown",
          sender: event.sender,
          time: event.time || Date.now(),
          data: event.data || {},
        }))
      }
      // Use the new ActionRequest constructor
      return new ActionRequest<TArg, TData, TError, TOutput>(
        data,
        {
          publish: (action: ActionRequest<any, any, any, any>, eventType: string, d: object) => this.publish(action, eventType, d),
          publishToRequestQueue: (action: ActionRequest<any, any, any, any>) => this.publishToRequestQueue(action),
          listen: (action: ActionRequest<any, any, any, any>, handler: ActionEventHandler) => this.listen(action, handler),
          getVal: (action: ActionRequest<any, any, any, any>, type: string) => this.getVal(action, type),
          setVal: (action: ActionRequest<any, any, any, any>, type: string, value: any) => this.setVal(action, type, value),
          saveAction: (action: ActionRequest<any, any, any, any>) => this.saveAction(action),
        }
      )
    } catch (error) {
      throw new Error(`Failed to parse action object: ${error}`)
    }
  }

  // load an action from the store
   async loadAction<
    TArg extends object = object,
    TData extends object = object,
    TError extends object | undefined = undefined,
    TOutput extends object | undefined = undefined,
  >(id: EntityId, restore = false): Promise<ActionRequest<TArg, TData, TError, TOutput> | undefined> {
    const storeKey = this.getStoreKey(id)
    debug(`[ActionRepo.loadAction] storeKey: ${storeKey}`)
    const directVal = await this.hub.redis.get(storeKey)
    debug(`[ActionRepo.loadAction] direct redis.get: ${directVal}`)
    // Use getRawVal to get the raw string, then parse
    const rawValue = await this.hub.getRawVal(storeKey)
    debug(`[ActionRepo.loadAction] value from hub.getRawVal: ${rawValue}`)
    if (!rawValue) {
      return undefined
    }
    const value = JSON.parse(rawValue)
    const action = this.fromJSON<TArg, TData, TError, TOutput>(value)
    if (restore) {
      await action.restoreAll()
    }
    return action
  }

   async saveAction<
    TArg extends object = object,
    TData extends object = object,
    TError extends object | undefined = undefined,
    TOutput extends object | undefined = undefined,
  >(action: ActionRequest<TArg, TData, TError, TOutput>): Promise<void> {
    if (!action || !action.id) {
      throw new Error("Action object must have an 'id' property")
    }
    const storeKey = this.getStoreKey(action)
    debug(`[ActionRepo.saveAction] storeKey: ${storeKey}`)
    const serialized = JSON.stringify(action.jsonWithEvents)
    debug(`[ActionRepo.saveAction] serialized: ${serialized}`)
    await this.hub.setVal(storeKey, action.jsonWithEvents)
    const verify = await this.hub.getVal(storeKey)
    debug(`[ActionRepo.saveAction] verify getVal: ${verify}`)
    const directVal = await this.hub.redis.get(storeKey)
    debug(`[ActionRepo.saveAction] direct redis.get: ${directVal}`)
  }


  /**
   * Publishes an event to the action stream.
   * @param eventType
   * @param data
   */
   async publish(action: EntityId, eventType: string, data: object): Promise<void> {
    const id = this.getEntityId(action)
    if (!id) {
      throw new Error("Action ID is required to publish an event")
    }
    const storeKey = this.getStoreKey(id, "events")
    await this.hub.publish(storeKey, eventType, data)
  }

  /**
   * Publishes an event to the action stream.
   * @param eventType
   * @param data
   */
   async publishToRequestQueue<
    TArg extends object = object,
    TData extends object = object,
    TError extends object | undefined = undefined,
    TOutput extends object | undefined = undefined,
    >(action: ActionRequest<TArg, TData, TError, TOutput>): Promise<void> {
    const id = this.getEntityId(action)
    if (!id) {
      throw new Error("Action ID is required to publish an event")
    }
    debug(`[ActionRepo.publishToRequestQueue] queueKey: ${this.queueKey}`)
    await this.hub.publish(this.queueKey, "action", action.json)
  }

   listenToRequestQueue(
    eventListener: ActionQueueEventHandler
  ): void {
    const storeKey = this.queueKey
    debug(`Listening to action request queue: ${storeKey}`)
    this.hub.listen(storeKey, async (event) => {
      debug(`[ActionRepo.listenToRequestQueue] Received event: ${JSON.stringify(event)}`)
      const action = event.data as IActionObjectAny
      eventListener(action)
      return true // Continue listening
    })
  }
   async clearRequestQueue(): Promise<void> {
    const storeKey = this.queueKey
    // console.log(`Clearing action request queue: ${storeKey}`)
    await this.hub.delKey(storeKey)
  }

   listen(action: EntityId, eventListener: ActionEventHandler): void {
    const storeKey = this.getStoreKey(action, "events")
    this.hub.listen(storeKey, eventListener)
  }

   async getVal<T>(action: EntityId, type: string): Promise<T | undefined> {
    const storeKey = this.getStoreKey(action, type)
    const value = await this.hub.getVal<T>(storeKey)
    return value
  }

   async setVal(action: EntityId, type: string, value: any): Promise<void> {
    const storeKey = this.getStoreKey(action, type)
    await this.hub.setVal(storeKey, value)
  }
}




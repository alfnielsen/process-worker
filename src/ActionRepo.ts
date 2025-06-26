import RedisHub, { type RedisCacheEvent } from "./RedisHub"

export type ActionId = { id: string } | string

export type IActionObject<
  TArg extends object,
  TData extends object,
  TError extends object | undefined,
  TOutput extends object | undefined,
> = {
  id: string
  name: string
  created: number
  arg: TArg
  data: TData
  status: ActionStatus
  error: TError | undefined
  output: TOutput | undefined
  }
export type IActionObjectAny = IActionObject<any, any, any, any>

export type IActionObjectWithEvents<
  TArg extends object,
  TData extends object,
  TError extends object | undefined,
  TOutput extends object | undefined,
> = IActionObject<TArg, TData, TError, TOutput> & {
  events: RedisCacheEvent[]
}

export type ActionEventHandler = (event: RedisCacheEvent) => void | boolean | Promise<void | boolean>
export type ActionQueueEventHandler = (action: IActionObjectAny) => void | boolean | Promise<void | boolean>
export type ActionStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export class ActionRequest<
  TArg extends object = object,
  TData extends object = object,
  TError extends object | undefined = undefined,
  TOutput extends object | undefined = undefined,
> implements IActionObject<TArg, TData, TError, TOutput>
{
  // data
  name: string
  id: string = crypto.randomUUID() as string
  created: number = Date.now()
  arg: TArg = {} as TArg
  // data (will be updated during the action)
  status: ActionStatus = "pending"
  data: TData = {} as TData
  error: TError | undefined = undefined
  output: TOutput | undefined = undefined
  // events (added during the action)
  events: RedisCacheEvent[] = []

  private _repo: ActionRepo
  get repo(): ActionRepo {
    return this._repo
  }


  /** Get the JSON representation of the action (Its a property) */
  get json(): IActionObject<TArg, TData, TError, TOutput> {
    return {
      id: this.id,
      name: this.name,
      created: this.created,
      arg: this.arg,
      data: this.data,
      error: this.error,
      output: this.output,
      status: this.status,
    }
  }
  /** Get the JSON representation of the action with events */
  get jsonWithEvents(): IActionObjectWithEvents<TArg, TData, TError, TOutput> {
    return {
      id: this.id,
      name: this.name,
      created: this.created,
      arg: this.arg,
      data: this.data,
      error: this.error,
      output: this.output,
      status: this.status,
      events: this.events,
    }
  }

  static create<
    TArg extends object,
    TData extends object = object,
    TError extends object | undefined = undefined,
    TOutput extends object | undefined = undefined,
  >(
    opt: { name: string } & Partial<IActionObject<TArg, TData, TError, TOutput>>,
    repo: ActionRepo = ActionRepo.createRepo()
  ): ActionRequest<TArg, TData, TError, TOutput> {
    const action = new ActionRequest<TArg, TData, TError, TOutput>({
      id: opt.id || (crypto.randomUUID() as string),
      name: opt.name || "Unnamed Action",
      created: Date.now(),
      arg: opt.arg || ({} as TArg),
      data: opt.data || ({} as TData),
      error: opt.error,
      output: opt.output,
      status: opt.status || "pending",
    }, repo)
    return action
  }


  private constructor(
    action: IActionObject<TArg, TData, TError, TOutput> | IActionObjectWithEvents<TArg, TData, TError, TOutput>,
    repo: ActionRepo = ActionRepo.createRepo()
  ) {
    this._repo = repo;
    this.name = action.name
    this.id = action.id
    this.created = action.created
    this.arg = action.arg
    this.data = action.data
    this.error = action.error
    this.output = action.output
    this.status = action.status || "pending"
    this.events = (action as IActionObjectWithEvents<TArg, TData, TError, TOutput>).events || []
  }


  // extensions for repo:
  async publish(eventType: string, data: object): Promise<void> {
    return this.repo.publish(this, eventType, data)
  }

  async publishToRequestQueue(): Promise<void> {
    return this.repo.publishToRequestQueue(this)
  }

  listen(eventListener: ActionEventHandler): void {
    this.repo.listen(this, eventListener)
  }
  // Getters
  async getStatus(): Promise<ActionStatus> {
    const status = await this.repo.getVal<ActionStatus>(this, "status")
    if (status) {
      this.status = status
    }
    return this.status
  }
  async getData(): Promise<TData> {
    const data = await this.repo.getVal<TData>(this, "data")
    if (data) {
      this.data = data
    }
    return this.data
  }
  async getError(): Promise<TError | undefined> {
    this.error = await this.repo.getVal<TError | undefined>(this, "error")
    return this.error
  }
  async getOutput(): Promise<TOutput | undefined> {
    this.output = await this.repo.getVal<TOutput | undefined>(this, "output")
    return this.output
  }
  // Setters
  async setStatus(value: ActionStatus): Promise<void> {
    this.status = value
    return this.repo.setVal(this, "status", value)
  }
  async setData(value: TData, notify = false): Promise<void> {
    this.data = value
    await this.repo.setVal(this, "data", value)
    if (notify) {
      await this.publish("data", { action: this.json, data: value })
    }
  }
  async setOutput(value: TOutput | undefined): Promise<void> {
    this.output = value
    return this.repo.setVal(this, "output", value)
  }
  async setError(value: TError | undefined): Promise<void> {
    this.error = value
    return this.repo.setVal(this, "error", value)
  }

  async save(): Promise<void> {
    // Save the action to Redis store
    await this.repo.saveAction(this)
  }
  // Save all data to Redis store
  async saveAll(): Promise<void> {
    // Save the action to Redis store
    await this.save()
    await this.setStatus(this.status)
    await this.setData(this.data)
    await this.setOutput(this.output)
    await this.setError(this.error)
  }

  // Restore the action from Redis store
  async restoreAll(): Promise<void> {
    // Save the action with events to Redis store
    await this.getStatus()
    await this.getData()
    await this.getError()
    await this.getOutput()
  }

  // actions
  async start(): Promise<void> {
    // Save the action to Redis store
    this.status = "running"
    await this.save()
    // Post request event
    await this.publish("request", { action: this.json })
    await this.publishToRequestQueue()
  }

  async complete(output: TOutput): Promise<void> {
    await this.setStatus("completed")
    await this.publish("completed", { action: this.json, output })
  }

  async cancel(reason: string): Promise<void> {
    await this.setStatus("cancelled")
    await this.setError({ message: reason } as TError)
    await this.publish("cancelled", { action: this.json, reason })
  }
  async fail(error: TError): Promise<void> {
    await this.setStatus("failed")
    await this.setError(error)
    await this.publish("failed", { action: this.json, error })
  }
}

export class ActionRepo {
  baseKey = "action"
  queueKey = "actionQueue"
  hub = RedisHub.createHub()

  static createRepo(opt: {
    prefix?: string,
    baseKey?: string,
    queueKey?: string,
  } = {}): ActionRepo {
    const repo = new ActionRepo()
    repo.hub.prefix = repo.baseKey
    if (opt.prefix) {
      repo.hub.prefix = opt.prefix
    }
    if (opt.baseKey) {
      repo.baseKey = opt.baseKey
    }
    return new ActionRepo()
  }

  private constructor() {
    // Initialize the ActionRepo with a RedisHub instance
  }

  // Redis keys for action data
   getActionStoreKey(action: ActionId, type: string = "request") {
    const id = this.getActionId(action)
    return `${this.baseKey}:${id}:${type}`
  }
   getActionRequestQueueKey(action: ActionId): string {
    const id = this.getActionId(action)
    return `${this.queueKey}`
    //return `${this.queueKey}:${id}`
  }
   getActionId(action: ActionId): string {
    if (typeof action === "string") {
      if (!action) {
        throw new Error("Action ID cannot be an empty string")
      }
      return action
    }
    if (!action.id) {
      throw new Error("Action object must have an 'id' property")
    }
    return action.id
   }
  
  create<
    TArg extends object,
    TData extends object = object,
    TError extends object | undefined = undefined,
    TOutput extends object | undefined = undefined,
  >(
    opt: { name: string } & Partial<IActionObject<TArg, TData, TError, TOutput>>,    
  ): ActionRequest<TArg, TData, TError, TOutput> {
    return ActionRequest.create<TArg, TData, TError, TOutput>(opt)    
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
      const action = ActionRequest.create<TArg, TData, TError, TOutput>(data, this)
      return action
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
  >(id: ActionId, restore = false): Promise<ActionRequest<TArg, TData, TError, TOutput> | undefined> {
    const storeKey = this.getActionStoreKey(id)
    const value = await this.hub.getVal(storeKey)
    if (!value) {
      return undefined
    }
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
    const storeKey = this.getActionStoreKey(action)
    await this.hub.setVal(storeKey, action.jsonWithEvents)
  }


  /**
   * Publishes an event to the action stream.
   * @param eventType
   * @param data
   */
   async publish(action: ActionId, eventType: string, data: object): Promise<void> {
    const id = this.getActionId(action)
    if (!id) {
      throw new Error("Action ID is required to publish an event")
    }
    const storeKey = this.getActionStoreKey(id, "events")
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
    const id = this.getActionId(action)
    if (!id) {
      throw new Error("Action ID is required to publish an event")
    }
    await this.hub.publish(this.queueKey, "action", action.json)
  }

   listenToRequestQueue(
    eventListener: ActionQueueEventHandler
  ): void {
    const storeKey = this.queueKey
     console.log(`Listening to action request queue: ${storeKey}`)
    this.hub.listen(storeKey, async (event) => {
       console.log(`Received action request event: ${JSON.stringify(event)}`)
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

   listen(action: ActionId, eventListener: ActionEventHandler): void {
    const storeKey = this.getActionStoreKey(action, "events")
    this.hub.listen(storeKey, eventListener)
  }

   async getVal<T>(action: ActionId, type: string): Promise<T | undefined> {
    const storeKey = this.getActionStoreKey(action, type)
    const value = await this.hub.getVal<T>(storeKey)
    return value
  }

   async setVal(action: ActionId, type: string, value: any): Promise<void> {
    const storeKey = this.getActionStoreKey(action, type)
    await this.hub.setVal(storeKey, value)
  }
}

export default ActionRepo

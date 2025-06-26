import type { RedisCacheEvent } from "../RedisHub/RedisHub"
import type { ActionStatus, IActionObject, IActionObjectWithEvents, ActionEventHandler } from "./ActionRepo"

export class ActionRequest<
  TArg extends object = object,
  TData extends object = object,
  TError extends object | undefined = undefined,
  TOutput extends object | undefined = undefined,
> implements IActionObject<TArg, TData, TError, TOutput> {
  name: string
  id: string = crypto.randomUUID() as string
  created: number = Date.now()
  arg: TArg = {} as TArg
  status: ActionStatus = "pending"
  data: TData = {} as TData
  error: TError | undefined = undefined
  output: TOutput | undefined = undefined
  events: RedisCacheEvent[] = []

  // Decoupled: pass in all needed functions
  private _publish: (action: any, eventType: string, data: object) => Promise<void>
  private _publishToRequestQueue: (action: any) => Promise<void>
  private _listen: (action: any, handler: ActionEventHandler) => void
  private _getVal: <T>(action: any, type: string) => Promise<T | undefined>
  private _setVal: (action: any, type: string, value: any) => Promise<void>
  private _saveAction: (action: any) => Promise<void>

  constructor(
    action: IActionObject<TArg, TData, TError, TOutput> | IActionObjectWithEvents<TArg, TData, TError, TOutput>,
    opts: {
      publish: (action: any, eventType: string, data: object) => Promise<void>
      publishToRequestQueue: (action: any) => Promise<void>
      listen: (action: any, handler: ActionEventHandler) => void
      getVal: <T>(action: any, type: string) => Promise<T | undefined>
      setVal: (action: any, type: string, value: any) => Promise<void>
      saveAction: (action: any) => Promise<void>
    }
  ) {
    this.name = action.name
    this.id = action.id
    this.created = action.created
    this.arg = action.arg
    this.data = action.data
    this.error = action.error
    this.output = action.output
    this.status = action.status || "pending"
    this.events = (action as IActionObjectWithEvents<TArg, TData, TError, TOutput>).events || []
    this._publish = opts.publish
    this._publishToRequestQueue = opts.publishToRequestQueue
    this._listen = opts.listen
    this._getVal = opts.getVal
    this._setVal = opts.setVal
    this._saveAction = opts.saveAction
  }

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
  get jsonWithEvents(): IActionObjectWithEvents<TArg, TData, TError, TOutput> {
    return {
      ...this.json,
      events: this.events,
    }
  }

  async publish(eventType: string, data: object): Promise<void> {
    return this._publish(this, eventType, data)
  }

  async publishToRequestQueue(): Promise<void> {
    return this._publishToRequestQueue(this)
  }

  listen(eventListener: ActionEventHandler): void {
    this._listen(this, eventListener)
  }

  async getStatus(): Promise<ActionStatus> {
    const status = await this._getVal<ActionStatus>(this, "status")
    if (status) {
      this.status = status
    }
    return this.status
  }
  async getData(): Promise<TData> {
    const data = await this._getVal<TData>(this, "data")
    if (data) {
      this.data = data
    }
    return this.data
  }
  async getError(): Promise<TError | undefined> {
    this.error = await this._getVal<TError | undefined>(this, "error")
    return this.error
  }
  async getOutput(): Promise<TOutput | undefined> {
    this.output = await this._getVal<TOutput | undefined>(this, "output")
    return this.output
  }
  async setStatus(value: ActionStatus): Promise<void> {
    this.status = value
    return this._setVal(this, "status", value)
  }
  async setData(value: TData, notify = false): Promise<void> {
    this.data = value
    await this._setVal(this, "data", value)
    if (notify) {
      await this.publish("data", { action: this.json, data: value })
    }
  }
  async setOutput(value: TOutput | undefined): Promise<void> {
    this.output = value
    return this._setVal(this, "output", value)
  }
  async setError(value: TError | undefined): Promise<void> {
    this.error = value
    return this._setVal(this, "error", value)
  }
  async save(): Promise<void> {
    await this._saveAction(this)
  }
  async saveAll(): Promise<void> {
    await this.save()
    await this.setStatus(this.status)
    await this.setData(this.data)
    await this.setOutput(this.output)
    await this.setError(this.error)
  }
  async restoreAll(): Promise<void> {
    await this.getStatus()
    await this.getData()
    await this.getError()
    await this.getOutput()
  }
  async start(): Promise<void> {
    this.status = "running"
    await this.save()
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

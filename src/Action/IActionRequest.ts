import type { IRedisCacheEvent } from "../RedisHub/IRedisCacheEvent"

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
  events: IRedisCacheEvent[]
}

export type ActionEventHandler = (event: IRedisCacheEvent) => void | boolean | Promise<void | boolean>
export type ActionQueueEventHandler = (action: IActionObjectAny) => void | boolean | Promise<void | boolean>
export type ActionStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

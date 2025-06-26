// Log types and interfaces for LogRepo and related modules

export type LogType = "info" | "warn" | "error" | "debug" | "trace" | string

export type ILogObject<TData = any> = {
  id: string
  type: string
  level: string
  message: string
  data?: TData
  timestamp?: number
}

export type LogEventHandler = (log: ILogObject) => void | boolean | Promise<void | boolean>

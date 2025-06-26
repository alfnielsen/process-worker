// Worker types for WorkerRepo and related modules

export type WorkerStatus = "idle" | "busy" | "offline" | "error"

export interface IWorkerInfo {
  id: string
  name: string
  status: WorkerStatus
  lastSeen: number
  meta?: Record<string, any>
}

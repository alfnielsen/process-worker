import type { WorkerStatus, IWorkerInfo } from "./WorkerRepo"

/**
 * Worker: Represents a worker instance with methods to update and persist its state.
 * Now decoupled from WorkerRepo.
 */
export class Worker implements IWorkerInfo {
  id: string
  name: string
  status: WorkerStatus
  lastSeen: number
  meta?: Record<string, any>
  // Remove direct reference to WorkerRepo
  private _saveWorker: (info: IWorkerInfo) => Promise<void>

  constructor(info: IWorkerInfo, saveWorker: (info: IWorkerInfo) => Promise<void>) {
    this.id = info.id
    this.name = info.name
    this.status = info.status
    this.lastSeen = info.lastSeen
    this.meta = info.meta
    this._saveWorker = saveWorker
  }

  get json(): IWorkerInfo {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      lastSeen: this.lastSeen,
      meta: this.meta || {}
    }
  }

  // Save the worker info to Redis
  async save(): Promise<void> {
    await this._saveWorker(this.json)
  }

  // Update the status and save
  async setStatus(status: WorkerStatus): Promise<void> {
    this.status = status
    this.lastSeen = Date.now()
    await this.save()
  }

  // Update the heartbeat (lastSeen)
  async heartbeat(): Promise<void> {
    this.lastSeen = Date.now()
    await this.save()
  }
}

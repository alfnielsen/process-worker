import RedisHub from "./RedisHub/RedisHub"
import RedisRepo, { type EntityId } from "./RedisRepo"
import { Worker } from "./Worker"

/**
 * WorkerRepo: Manages worker metadata and status in Redis.
 * Stores and retrieves worker information, status, and heartbeats.
 */
export type WorkerStatus = "idle" | "busy" | "offline" | "error"

export interface IWorkerInfo {
  id: string
  name: string
  status: WorkerStatus
  lastSeen: number
  meta?: Record<string, any>
}

export class WorkerRepo extends RedisRepo {
  static override async createRepo(opt: {
    prefix?: string,
    baseKey?: string,
  } = {}): Promise<WorkerRepo> {
    const hub = await RedisHub.createHub({ prefix: opt.prefix })
    const repo = new WorkerRepo(hub, opt)
    await repo.waitReady()
    return repo
  }

  constructor(hub: RedisHub, opt: {
    prefix?: string,
    baseKey?: string,
  } = {}) {
    // Default baseKey to 'worker' if not provided
    super(hub, { ...opt, baseKey: opt.baseKey || "worker" })
  }

  getWorkerKey(workerId: EntityId): string {
    const id = this.getEntityId(workerId)
    return `${this.baseKey}:worker:${id}`
  }

  async saveWorker(info: IWorkerInfo): Promise<void> {
    const key = this.getWorkerKey(info.id)
    if (process.env.DEBUG) console.log('[WorkerRepo.saveWorker] Saving to key:', key)
    await this.hub.setVal(key, info)
  }

  async getWorker(workerId: EntityId): Promise<IWorkerInfo | undefined> {
    const key = this.getWorkerKey(workerId)
    return await this.hub.getVal<IWorkerInfo>(key)
  }

  async setStatus(workerId: EntityId, status: WorkerStatus): Promise<void> {
    const info = await this.getWorker(workerId)
    if (info) {
      info.status = status
      info.lastSeen = Date.now()
      await this.saveWorker(info)
    }
  }

  async heartbeat(workerId: EntityId): Promise<void> {
    const info = await this.getWorker(workerId)
    if (info) {
      info.lastSeen = Date.now()
      await this.saveWorker(info)
    }
  }

  async listWorkers(): Promise<IWorkerInfo[]> {
    // Build the correct pattern with prefix for Redis
    const prefix = this.hub.prefix ? (this.hub.prefix.endsWith(":") ? this.hub.prefix : this.hub.prefix + ":") : ""
    const pattern = `${prefix}worker:worker:*`
    if (process.env.DEBUG) console.log('[WorkerRepo.listWorkers] Pattern:', pattern)
    const keys = await this.hub.redis.keys(pattern)
    if (process.env.DEBUG) console.log('[WorkerRepo.listWorkers] Found keys:', keys)
    const workers: IWorkerInfo[] = []
    for (const key of keys) {
      const info = await this.hub.getVal<IWorkerInfo>(key, true)
      if (info) workers.push(info)
    }
    return workers
  }

  /**
   * Returns all workers as Worker instances (not just plain info objects)
   */
  async getAllWorkers(): Promise<Worker[]> {
    const infos = await this.listWorkers()
    // Pass a saveWorker function to each Worker instance
    return infos.map(info => new Worker(info, (i) => this.saveWorker(i)))
  }
}

export default WorkerRepo

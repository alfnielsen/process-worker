import { describe, it, expect, afterAll } from "bun:test"
import { sleep } from "bun"
import WorkerRepo from "../src/Worker/WorkerRepo"
import { Worker } from "../src/Worker/Worker"
import type { IWorkerInfo } from "../src/client"

const prefix = "__test__worker-repo__"

const debug = (...args: any[]) => {
  if (false) return // Enable for debugging
  if (process.env.DEBUG) console.log(...args)
}

describe("WorkerRepo", () => {
  afterAll(async () => {
    // Clean up all test keys in Redis for this prefix after all tests
    const repo = await WorkerRepo.startWorker({ prefix })
    await repo.hub.delKeys(`${repo.hub.prefix}*`, true)
  })

  it("should save and retrieve a worker", async () => {
    // Test saving a worker and retrieving it by ID
    const repo = await WorkerRepo.startWorker({ prefix })
    const workerId = crypto.randomUUID() as string
    const info: IWorkerInfo = {
      id: workerId,
      name: "worker-1",
      status: "idle",
      lastSeen: Date.now(),
      meta: { foo: "bar" },
    }
    const worker = new Worker(info, i => repo.saveWorker(i))
    await worker.save()
    const loaded = await repo.getWorker(workerId)
    expect(loaded).toBeDefined()
    expect(loaded?.id).toBe(workerId)
    expect(loaded?.name).toBe("worker-1")
    expect(loaded?.status).toBe("idle")
    expect(loaded?.meta?.foo).toBe("bar")
  })

  it("should update status and heartbeat", async () => {
    // Test updating a worker's status and heartbeat (lastSeen)
    const repo = await WorkerRepo.startWorker({ prefix })
    const workerId = crypto.randomUUID() as string
    const info: IWorkerInfo = {
      id: workerId,
      name: "worker-2",
      status: "idle",
      lastSeen: Date.now(),
    }
    const worker = new Worker(info, i => repo.saveWorker(i))
    await worker.save()
    await worker.setStatus("busy")
    let loaded = await repo.getWorker(workerId)
    expect(loaded?.status).toBe("busy")
    const prevLastSeen = loaded?.lastSeen
    await sleep(10)
    await worker.heartbeat()
    loaded = await repo.getWorker(workerId)
    expect(loaded?.lastSeen).toBeGreaterThan(prevLastSeen!)
  })

  it("should list all workers", async () => {
    // Test listing multiple workers after saving them
    const repo = await WorkerRepo.startWorker({ prefix })
    // Add two workers
    const w1 = new Worker({ id: crypto.randomUUID() as string, name: "w1", status: "idle", lastSeen: Date.now() }, i => repo.saveWorker(i))
    const w2 = new Worker({ id: crypto.randomUUID() as string, name: "w2", status: "busy", lastSeen: Date.now() }, i => repo.saveWorker(i))
    await w1.save()
    await w2.save()
    const workers = await repo.listWorkers()
    const names = workers.map(w => w.name)
    expect(names).toContain("w1")
    expect(names).toContain("w2")
  })

  it("should get all workers as Worker instances", async () => {
    // Test retrieving all workers as Worker class instances
    const repo = await WorkerRepo.startWorker({ prefix })
    // Add two workers
    const w1 = new Worker({ id: crypto.randomUUID() as string, name: "w1", status: "idle", lastSeen: Date.now() }, i => repo.saveWorker(i))
    const w2 = new Worker({ id: crypto.randomUUID() as string, name: "w2", status: "busy", lastSeen: Date.now() }, i => repo.saveWorker(i))
    await w1.save()
    await w2.save()
    const workers = await repo.getAllWorkers()
    const names = workers.map(w => w.name)
    expect(names).toContain("w1")
    expect(names).toContain("w2")
    // Ensure all are Worker instances
    expect(workers.every(w => w instanceof Worker)).toBe(true)
  })
})

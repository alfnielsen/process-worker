import { describe, it, expect } from "bun:test"
import { ProcessWorker } from "../ProcessWorker"
import { sleep } from "bun"

describe("ProcessWorker", () => {
  it("should start a worker with only workerName (overload)", async () => {
    const w = await ProcessWorker.start("overload-worker")
    expect(w).toBeDefined()
    expect(w.sessionId).toBeDefined()
    await w.shutdown()
  })

  it("should set and get values from the global cache", async () => {
    const worker = await ProcessWorker.start({ workerName: "test-worker-cache", logStdout: false, postStatusLogInterval: 0 })
    await worker.set("test-key", { foo: "bar" })
    const value = await worker.get("test-key")
    expect(value).toEqual({ foo: "bar" })
    await worker.shutdown()
  })

  it("should return default value if key is missing in cache", async () => {
    const worker = await ProcessWorker.start({ workerName: "test-worker-default", logStdout: false, postStatusLogInterval: 0 })
    const value = await worker.get("missing-key", 42)
    expect(value).toBe(42)
    await worker.shutdown()
  })

  it("should log messages to the log stream", async () => {
    const worker = await ProcessWorker.start({ workerName: "test-worker-log", logStdout: false, postStatusLogInterval: 0 })
    expect(() => worker.log("test log message", { foo: 1 })).not.toThrow()
    await worker.shutdown()
  })

  it("should post and receive messages on a stream", async () => {
    const worker = await ProcessWorker.start({ workerName: "test-worker-stream", logStdout: false, postStatusLogInterval: 0 })
    const got: any[] = []
    const streamName = `test-stream:test-stream-${Date.now()}`
    await sleep(100)
    worker.on(streamName, msg => {
      got.push(msg)
    })
    await sleep(100)
    await worker.post(streamName, { type: "test", data: "Hello, World!" })
    await sleep(200)
    expect(got.length).toBeGreaterThan(0)
    expect(got[0]).toMatchObject({ type: "test", data: "Hello, World!" })
    worker.shutdown()
  })

  it("should shutdown gracefully", async () => {
    const worker = await ProcessWorker.start("shutdown-worker")
    await expect(worker.shutdown()).resolves.toBeUndefined()
  })
})

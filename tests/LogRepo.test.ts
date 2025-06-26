import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { sleep } from "bun"
import LogRepo, { LogRequest } from "../src/LogRepo"

const prefix = "__test__log-repo__"
let repo: LogRepo



beforeAll(async () => {
  repo = await LogRepo.createRepo({
    prefix
  })
})
afterAll(async () => {
  // Optionally clean up test keys here
  await repo.hub.delKeys(`${repo.hub.prefix}*`, true)
})


describe("LogRepo", () => {
  it("should add and retrieve a log entry", async () => {
    const logId = crypto.randomUUID() as string
    const logEntry = LogRequest.create({
      id: logId,
      type: "test",
      level: "info",
      message: "Test log entry",
      data: { foo: "bar" },
    }, repo)
    await repo.saveLog(logEntry)
    await sleep(100)
    const storeKey = repo.getLogStoreKey(logId)
    const log = await repo.hub.getVal(storeKey) as any
    expect(log).toBeDefined()
    expect(log.id).toBe(logId)
    expect(log.message).toBe("Test log entry")
    expect(log.level).toBe("info")
    expect(log.data).toEqual({ foo: "bar" })
  })

  it("should filter logs by level (manual check)", async () => {
    const logId = crypto.randomUUID() as string
    const logEntry = LogRequest.create({
      id: logId,
      type: "test",
      level: "error",
      message: "Error log entry",
      data: {},
    }, repo)
    await repo.saveLog(logEntry)
    await sleep(100)
    const storeKey = repo.getLogStoreKey(logId)
    const log = await repo.hub.getVal(storeKey) as any
    expect(log).toBeDefined()
    expect(log.id).toBe(logId)
    expect(log.level).toBe("error")
  })

  it("should listen to log stream and receive log entries", async () => {
    const got: any[] = []
    repo.listenToLogStream(log => {
      got.push(log)
    })
    const logId = crypto.randomUUID() as string
    const logEntry = LogRequest.create({
      id: logId,
      type: "test",
      level: "info",
      message: "Streamed log entry",
      data: { bar: "baz" },
    }, repo)
    await repo.saveLog(logEntry)
    await sleep(150)
    expect(got.length).toBeGreaterThan(0)
    const log = got.find(l => l.id === logId)
    expect(log).toBeDefined()
    expect(log.message).toBe("Streamed log entry")
    expect(log.level).toBe("info")
    expect(log.data).toEqual({ bar: "baz" })
  })
})

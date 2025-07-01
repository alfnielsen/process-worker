import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { sleep } from "bun"
import {LogRepo} from "../src/Log/LogRepo"
import type { ILogObject } from "../src/Log/ILogObject"

const prefix = "__test__log-repo__"
let repo: LogRepo


beforeAll(async () => {
  repo = await LogRepo.createLogger({
    prefix
  })
})

afterAll(async () => {
  // Optionally clean up test keys here
  await repo.hub.delKeys(`${repo.hub.prefix}*`, true)
})


describe("LogRepo", () => {  
  it("should listen to log stream and receive log entries", async () => {
    const got: any[] = []
    const unsubscribe = repo.listenToLogStream(log => {
      // console.log("Log received in listener:", log) // Debug output
      got.push(log)
    })
    await sleep(300) // Increased wait for the listener to be ready
    const logId = crypto.randomUUID() as string
    const logEntry: ILogObject ={
      id: logId,
      type: "test",
      level: "info",
      message: "Streamed log entry",
      data: { bar: "baz" },
      timestamp: Date.now()
    }
    await repo.publishLog(logEntry) // 1
    await repo.publishLog(logEntry) // 2
    await repo.log("Test log entry", "info", { foo: "bar" }, "info") // 3
    await sleep(150) 
    unsubscribe() // Unsubscribe from the log stream listener
    await sleep(150) 
    expect(got.length).toBe(3)
    await repo.log("Not listened log", "info", { foo: "baz" }, "info") // still 3, has unsubscribed
    expect(got.length).toBe(3)
    // console.log("All logs received:", got.length) // Debug output
    const log = got.find(l => l.id === logId)
    expect(log).toBeDefined()
    expect(log.message).toBe("Streamed log entry")
    expect(log.level).toBe("info")
    expect(log.data).toEqual({ bar: "baz" })

    const all = await repo.hub.getStreamValues(repo.queueKey)
    expect(all.length).toBeGreaterThanOrEqual(3) // Ensure we have at least 3 logs in the stream
    // console.log("All logs in stream:", all) // Debug output

    
  })
})

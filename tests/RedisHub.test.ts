import { describe, it, expect, afterAll, beforeAll } from "bun:test"
import RedisHub from "../src/RedisHub/RedisHub"
import { sleep } from "bun"

const prefix = "__test__redis-hub__"
let redisHub: RedisHub


describe("RedisHub", () => {
  beforeAll(async () => {
    redisHub = await RedisHub.createHub({ prefix })
  })
  
  afterAll(async () => {
    // Clean up test keys
    await redisHub.delKeys(`${prefix}*`, true)
  })

  it("should create a RedisHub instance", () => {
    expect(redisHub).toBeDefined()
    expect(redisHub.redis).toBeDefined()
    expect(redisHub.sub).toBeDefined()
    expect(redisHub.pub).toBeDefined()
  })

  it("should set and get a value", async () => {
    await redisHub.setVal("test-key", "test-value")
    const value = await redisHub.getVal("test-key")
    expect(value).toBe("test-value")
  })

  it("should getRaw a value", async () => {
    await redisHub.setVal("test-raw-key", { foo: "bar" })
    const value = await redisHub.getRawVal("test-raw-key")
    expect(typeof value).toBe("string")
    if (value !== undefined) {
      const jsonValue = JSON.parse(value)
      expect(jsonValue).toBeDefined() 
      expect(jsonValue).toEqual({ foo: "bar" })
    } else {
      throw new Error("getRaw returned null")
    }
  })

  it("should delete a value", async () => {
    await redisHub.setVal("test-del-key", "to-delete")
    await redisHub.delKey("test-del-key")
    const value = await redisHub.getVal("test-del-key")
    expect(value).toBeUndefined()
  })

  it("should post and listen to a stream", async () => {
    const got: any[] = []
    const unsubscribe = redisHub.listen("test-stream", msg => {
      // console.log("Received message (IN):", msg)
      got.push(msg)
    })
    await redisHub.publish("test-stream", "test-type", { foo: "bar" })
    await sleep(100)
    expect(got.length).toBeGreaterThan(0)
    const msg = got[0]
     console.log("Received message[0]:", msg)
    expect(msg).toHaveProperty("id")
    expect(msg).toHaveProperty("type")
    expect(msg).toHaveProperty("data")
    expect(msg.data).toBeDefined()
    expect(msg.data).toEqual({ foo: "bar" })
    unsubscribe()
    
  })

  it("should delete keys by pattern", async () => {
    await redisHub.setVal("test-del-pattern-1", "value1")
    await redisHub.setVal("test-del-pattern-2", "value2")
    console.log("Setting up keys for deletion")
    const keyCount = await redisHub.getKeys("test-del-pattern-*")
    console.log("Keys to delete:", keyCount)
    expect(keyCount.length).toBe(2)
    await redisHub.delKeys("test-del-pattern-*")
    const value1 = await redisHub.getVal("test-del-pattern-1")
    const value2 = await redisHub.getVal("test-del-pattern-2")
    expect(value1).toBeUndefined()
    expect(value2).toBeUndefined()

    // Test deleting non-existing keys
    await redisHub.delKeys("non-existing-pattern-*")
    const nonExistingValue = await redisHub.getVal("non-existing-pattern-1")
    expect(nonExistingValue).toBeUndefined()

    // Test deleting keys of streams
    await redisHub.publish("test-stream-1", "test-type", { foo: "bar" })
    await redisHub.publish("test-stream-2", "test-type", { foo: "baz" })
    const stream1Value = await redisHub.getStreamValues("test-stream-1")
    expect(stream1Value).toBeDefined()
    expect(stream1Value.length).toBeGreaterThan(0)
    await redisHub.delKeys("test-stream-*") // Delete all streams
    const stream1ValueAfterDelete = await redisHub.getStreamValues("test-stream-1")
    expect(stream1ValueAfterDelete).toBeDefined()
    expect(stream1ValueAfterDelete.length).toBe(0)
  })

})

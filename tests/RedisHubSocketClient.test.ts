import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { sleep } from "bun"
import { RedisHubSocket } from "../src/RedisHub/RedisHubSocket"
import { RedisHubSocketClient } from "../src/RedisHub/RedisHubSocketClient"

const PORT = 34568
const WS_URL = `ws://localhost:${PORT}`

describe("RedisHubSocketClient integration", () => {
  let server: any
  beforeAll(async () => {
    const hubSocket = await RedisHubSocket.createHub({ prefix: "__test__redis-hub-socket-client__" })
    server = await hubSocket.listen({ port: PORT })
    await sleep(50)
  })
  afterAll(async () => {
    server?.stop?.()
    await sleep(50)
  })

  it("should connect and receive published messages", async () => {
    const client = await RedisHubSocketClient.connect(WS_URL)
    const got: any[] = []
    client.listen("test-stream", msg => {
      got.push(msg)
    })
    await sleep(200) // Increased delay to ensure subscription is active
    await client.publish("test-stream", "test", { foo: "bar" })
    await sleep(100)
    expect(got.length).toBe(1)
    expect(got[0].data).toEqual({ foo: "bar" })
    client.close()
  })

  it("should support setVal/getVal/delKey", async () => {
    const client = await RedisHubSocketClient.connect(WS_URL)
    await client.awaitReady()
    const setRes = await client.setVal("foo", "bar")
    expect(setRes.ok).toBe(true)
    const getRes = await client.getVal<string>("foo")
    expect(getRes === "bar" || (getRes && (getRes as any).value === "bar")).toBe(true)
    const delRes = await client.delKey("foo")
    expect(delRes.ok).toBe(true)
    client.close()
  })

  it("should support getStreamValues", async () => {
    const client = await RedisHubSocketClient.connect(WS_URL)
    await client.awaitReady()
    await client.publish("stream-x", "foo", { bar: 1 })
    await sleep(50)
    const res = await client.getStreamValues("stream-x")
    expect(Array.isArray(res.values)).toBe(true)
    expect(res.values.length).toBeGreaterThan(0)
    expect(res.values[0].type).toBe("foo")
    client.close()
  })
})

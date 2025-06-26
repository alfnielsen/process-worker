import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { sleep } from "bun"
import { RedisHubSocket } from "../../src/RedisHubSocket"

const PORT = 34567
const WS_URL = `ws://localhost:${PORT}`

describe("RedisHubSocket WebSocket server", () => {
  let server: any
  beforeAll(async () => {
    const hubSocket = new RedisHubSocket({ prefix: "__test__redis-hub-socket__" })
    server = await hubSocket.listen({ port: PORT })
    await sleep(50)
  })
  afterAll(async () => {
    server?.stop?.()
    await sleep(50)
  })

  it("should subscribe and receive published messages", async () => {
    const ws = new WebSocket(WS_URL)
    const got: any[] = []
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "listen", stream: "test-stream" }))
        ws.send(JSON.stringify({ type: "publish", stream: "test-stream", eventType: "test", data: { foo: "bar" } }))
      }
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.stream === "test-stream" && msg.type === "test") {
          got.push(msg)
          resolve()
        }
      }
      ws.onerror = reject
    })
    expect(got.length).toBe(1)
    expect(got[0].data).toEqual({ foo: "bar" })
    ws.close()
  })

  it("should support getVal/setVal/delKey", async () => {
    const ws = new WebSocket(WS_URL)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "setVal", key: "foo", value: "bar" }))
      }
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.ok) {
          ws.send(JSON.stringify({ type: "getVal", key: "foo" }))
        } else if (msg.value === "bar") {
          ws.send(JSON.stringify({ type: "delKey", key: "foo" }))
        } else if (msg.ok) {
          resolve()
        }
      }
      ws.onerror = reject
    })
    ws.close()
  })

  it("should support getStreamValues", async () => {
    const ws = new WebSocket(WS_URL)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "publish", stream: "stream-x", eventType: "foo", data: { bar: 1 } }))
        setTimeout(() => {
          ws.send(JSON.stringify({ type: "getStreamValues", stream: "stream-x" }))
        }, 50)
      }
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.values && Array.isArray(msg.values)) {
          expect(msg.values.length).toBeGreaterThan(0)
          expect(msg.values[0].type).toBe("foo")
          resolve()
        }
      }
      ws.onerror = reject
    })
    ws.close()
  })
})

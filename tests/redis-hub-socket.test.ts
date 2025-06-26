import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { RedisHubSocket } from "../src/RedisHubSocket"

// Helper to create a WebSocket client
function createWebSocketClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.onopen = () => resolve(ws)
    ws.onerror = err => reject(err)
  })
}

describe("RedisHubSocket", () => {
  let server: any
  let port = 34567
  let socketUrl = `ws://localhost:${port}/ws`

  beforeAll(async () => {
    const hubSocket = new RedisHubSocket({ prefix: "test" })
    server = await hubSocket.listen({ port, path: "/ws" })
  })

  afterAll(() => {
    server?.stop && server.stop()
  })

  it("should accept WebSocket connections and respond to listen", async () => {
    const ws = await createWebSocketClient(socketUrl)
    let got: any = null
    ws.onmessage = ev => {
      got = JSON.parse(ev.data)
    }
    ws.send(JSON.stringify({ type: "listen", stream: "test-stream", requestId: "1" }))
    await Bun.sleep(100) // Increased delay to ensure listener is attached
    expect(got).toBeTruthy()
    expect(got.ok).toBe(true)
    expect(got.subscribed).toBe("test-stream")
    ws.close()
  })

  it("should publish and receive events via stream", async () => {
    const ws1 = await createWebSocketClient(socketUrl)
    const ws2 = await createWebSocketClient(socketUrl)
    let got: any = null
    ws1.onmessage = ev => {
      const msg = JSON.parse(ev.data)
      console.log("[TEST] ws1 received:", msg)
      if (msg.stream === "test-stream" && msg.type === "response" && msg.eventType === "test-event") {
        got = msg
      }
    }
    ws1.send(JSON.stringify({ type: "listen", stream: "test-stream", requestId: "2" }))
    await Bun.sleep(100) // Allow listener to be established
    ws2.send(JSON.stringify({ type: "publish", stream: "test-stream", eventType: "test-event", data: { foo: "bar" }, requestId: "3" }))
    await Bun.sleep(100) // Allow time for message to propagate
    expect(got).toBeTruthy()
    expect(got.stream).toBe("test-stream")
    expect(got.eventType).toBe("test-event")
    expect(got.data).toEqual({ foo: "bar" })
    ws1.close()
    ws2.close()
  })

  it("should set and get values via setVal/getVal", async () => {
    const ws = await createWebSocketClient(socketUrl)
    let got: any = null
    ws.onmessage = ev => {
      got = JSON.parse(ev.data)
    }
    ws.send(JSON.stringify({ type: "setVal", key: "mykey", value: "myval", requestId: "4" }))
    await Bun.sleep(50)
    expect(got.ok).toBe(true)
    ws.send(JSON.stringify({ type: "getVal", key: "mykey", requestId: "5" }))
    await Bun.sleep(50)
    expect(got.value).toBe("myval")
    ws.close()
  })

  it("should delete keys via delKey", async () => {
    const ws = await createWebSocketClient(socketUrl)
    let got: any = null
    ws.onmessage = ev => {
      got = JSON.parse(ev.data)
    }
    ws.send(JSON.stringify({ type: "setVal", key: "delkey", value: "todel", requestId: "6" }))
    await Bun.sleep(50)
    ws.send(JSON.stringify({ type: "delKey", key: "delkey", requestId: "7" }))
    await Bun.sleep(50)
    expect(got.ok).toBe(true)
    ws.send(JSON.stringify({ type: "getVal", key: "delkey", requestId: "8" }))
    await Bun.sleep(50)
    expect(got.value).toBe(undefined)
    ws.close()
  })
})

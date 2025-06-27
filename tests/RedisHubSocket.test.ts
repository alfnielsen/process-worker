import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { sleep } from "bun"
import { RedisHubSocket } from "../src/RedisHub/RedisHubSocket"
import { RedisHub } from "../src"

const PORT = 34567
const WS_URL = `ws://localhost:${PORT}`
const prefix = "__test__redis-hub-socket__"

// Debug utility
const debug = (...args: any[]) => {
  if (process.env.DEBUG) console.log(...args)
}

// Utility to check if a port is free (ESM compatible)
async function ensurePortFree(port: number): Promise<void> {
  const net = await import("net")
  await new Promise<void>((resolve, reject) => {
    const tester = net
      .createServer()
      .once("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          debug(`[beforeAll] Port ${port} in use, attempting to close any existing server...`)
          reject(new Error(`Port ${port} is already in use.`))
        } else {
          reject(err)
        }
      })
      .once("listening", () => {
        tester.close(() => resolve())
      })
      .listen(port)
  })
}

let server: any

beforeAll(async () => {
  // Ensure the port is free before starting the server
  try {
    await ensurePortFree(PORT)
    debug("[beforeAll] Port", PORT, "is free, proceeding to start WebSocket server.")
  } catch (e) {
    throw new Error(`Test setup failed: ${e}`)
  }

  const hubSocket = await RedisHubSocket.createHub({ prefix })
  // Create a new RedisHub
  server = await hubSocket.listen({ port: PORT })
  await sleep(50)
  debug("[beforeAll] WebSocket server started on port", PORT)
})

afterAll(async () => {
  server?.stop?.()
  await sleep(50)
  debug("[afterAll] WebSocket server stopped")

  // Clean up test keys
  const redisHub = await RedisHub.createHub({ prefix })
  await redisHub.delKeys(`${prefix}*`, true)
})

describe("RedisHubSocket WebSocket server", () => {
  // Test: Subscribe to a stream and receive a published message
  it("should subscribe and receive published messages", async () => {
    const ws = new WebSocket(WS_URL)
    const got: any[] = []
    await new Promise<void>((resolve, reject) => {
      // Timeout to prevent hanging if message is not received
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error("Test timed out: did not receive published message"))
      }, 2500)
      ws.onopen = () => {
        debug("[ws.onopen] Subscribing to test-stream")
        // Subscribe to the stream
        ws.send(JSON.stringify({ type: "listen", stream: "test-stream" }))
        // Wait before publishing to ensure subscription is active
        setTimeout(() => {
          debug("[ws.onopen] Publishing to test-stream after delay")
          ws.send(JSON.stringify({ type: "publish", stream: "test-stream", eventType: "test", data: { foo: "bar" } }))
        }, 300)
      }
      ws.onmessage = event => {
        debug("[ws.onmessage] Received:", event.data)
        const msg = JSON.parse(event.data)
        // Match the actual message format from the server
        if (msg.stream === "test-stream" && msg.type === "response" && msg.eventType === "test") {
          got.push(msg)
          debug("[ws.onmessage] Message matched, resolving promise.")
          clearTimeout(timeout)
          ws.close()
          resolve()
        } else {
          debug("[ws.onmessage] Ignored message:", msg)
        }
      }
      ws.onerror = err => {
        clearTimeout(timeout)
        ws.close()
        debug("[ws.onerror]", err)
        reject(err)
      }
    })
    debug("[test] Got messages:", got)
    expect(got.length).toBe(1)
    expect(got[0].data).toEqual({ foo: "bar" })
  })

  // Test: Set, get, and delete a key via WebSocket
  it("should support getVal/setVal/delKey", async () => {
    const ws = new WebSocket(WS_URL)
    await new Promise<void>((resolve, reject) => {
      let stage = 0
      // Timeout to prevent hanging if flow is not completed
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error("Test timed out: did not complete getVal/setVal/delKey flow"))
      }, 2000)
      ws.onopen = () => {
        debug("[ws.onopen] Setting value for key 'foo'")
        // Set value for key 'foo'
        ws.send(JSON.stringify({ type: "setVal", key: "foo", value: "bar" }))
      }
      ws.onmessage = event => {
        debug("[ws.onmessage] Received:", event.data)
        const msg = JSON.parse(event.data)
        if (stage === 0 && msg.ok) {
          stage = 1
          debug("[ws.onmessage] setVal ok, getting value for key 'foo'")
          // Get value for key 'foo'
          ws.send(JSON.stringify({ type: "getVal", key: "foo" }))
        } else if (stage === 1 && msg.value === "bar") {
          stage = 2
          debug("[ws.onmessage] getVal returned 'bar', deleting key 'foo'")
          // Delete key 'foo'
          ws.send(JSON.stringify({ type: "delKey", key: "foo" }))
        } else if (stage === 2 && msg.ok) {
          clearTimeout(timeout)
          ws.close()
          debug("[ws.onmessage] delKey ok, resolving promise.")
          resolve()
        }
      }
      ws.onerror = err => {
        clearTimeout(timeout)
        ws.close()
        debug("[ws.onerror]", err)
        reject(err)
      }
    })
  })

  // Test: Publish to a stream and retrieve all stream values
  it("should support getStreamValues", async () => {
    const ws = new WebSocket(WS_URL)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        debug("[ws.onopen] Publishing to stream-x")
        // Publish a message to stream-x
        ws.send(JSON.stringify({ type: "publish", stream: "stream-x", eventType: "foo", data: { bar: 1 } }))
        setTimeout(() => {
          debug("[ws.onopen] Requesting getStreamValues for stream-x")
          // Request all values from stream-x
          ws.send(JSON.stringify({ type: "getStreamValues", stream: "stream-x" }))
        }, 50)
      }
      ws.onmessage = event => {
        debug("[ws.onmessage] Received:", event.data)
        const msg = JSON.parse(event.data)
        if (msg.values && Array.isArray(msg.values)) {
          debug("[ws.onmessage] Received stream values, resolving promise.")
          expect(msg.values.length).toBeGreaterThan(0)
          expect(msg.values[0].type).toBe("foo")
          resolve()
        }
      }
      ws.onerror = err => {
        debug("[ws.onerror]", err)
        reject(err)
      }
    })
    ws.close()
  })
})

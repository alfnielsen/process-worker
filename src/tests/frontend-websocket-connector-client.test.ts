import { describe, it, expect } from "bun:test"
import { startFrontendWebSocketConnector } from "../connectors/frontend-websocket-connector-bun"
import { FrontendWebSocketConnectorClient } from "../connectors/frontend-websocket-connector-client"

const WS_PORT = 3070
const WS_URL = `ws://localhost:${WS_PORT}`

async function killPort(port: number) {
  const { execSync } = await import("node:child_process")
  try {
    execSync(`lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`)
  } catch {}
}

describe("FrontendWebSocketConnectorClient", () => {
  it("should set a key", async () => {
    await killPort(WS_PORT)
    await startFrontendWebSocketConnector(WS_PORT, { workerName: "test-ws-connector-client-set" })
    await new Promise(res => setTimeout(res, 100))
    const client = new FrontendWebSocketConnectorClient(WS_URL)
    const status = await client.set("key1", "value1")
    expect(status).toBe("ok")
    client.close()
  })

  it("should get a key", async () => {
    await killPort(WS_PORT)
    await startFrontendWebSocketConnector(WS_PORT, { workerName: "test-ws-connector-client-get" })
    await new Promise(res => setTimeout(res, 100))
    const client = new FrontendWebSocketConnectorClient(WS_URL)
    await client.set("key2", "value2")
    const value = await client.get("key2")
    expect(value).toBe("value2")
    client.close()
  })

  it("should allow two clients to get the same key independently", async () => {
    await killPort(WS_PORT)
    await startFrontendWebSocketConnector(WS_PORT, { workerName: "test-ws-connector-client-multi" })
    await new Promise(res => setTimeout(res, 100))
    const client1 = new FrontendWebSocketConnectorClient(WS_URL)
    const client2 = new FrontendWebSocketConnectorClient(WS_URL)
    await client1.set("shared-key", "shared-value")
    const [value1, value2] = await Promise.all([
      client1.get("shared-key"),
      client2.get("shared-key")
    ])
    expect(value1).toBe("shared-value")
    expect(value2).toBe("shared-value")
    client1.close()
    client2.close()
  })

  it("should handle on (listen to a stream)", async () => {
    await killPort(WS_PORT)
    await startFrontendWebSocketConnector(WS_PORT, { workerName: "test-ws-connector-client-on" })
    await new Promise(res => setTimeout(res, 100))
    const client = new FrontendWebSocketConnectorClient(WS_URL)
    let received: any = null
    await client.on("test-stream", data => {
      received = data
    })
    // Simulate another client posting to the stream
    const poster = new FrontendWebSocketConnectorClient(WS_URL)
    await poster.post("test-stream", { foo: "bar" })
    await new Promise(res => setTimeout(res, 200))
    expect(received).toEqual({ foo: "bar" })
    client.close()
    poster.close()
  })

  it("should post to a stream", async () => {
    await killPort(WS_PORT)
    await startFrontendWebSocketConnector(WS_PORT, { workerName: "test-ws-connector-client-post" })
    await new Promise(res => setTimeout(res, 100))
    const client = new FrontendWebSocketConnectorClient(WS_URL)
    const status = await client.post("another-stream", { hello: "world" })
    expect(status).toBe("sent")
    client.close()
  })
})

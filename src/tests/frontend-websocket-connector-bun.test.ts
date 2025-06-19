import { describe, it, expect } from "bun:test"
import { handleWebSocketMessage } from "../connectors/frontend-websocket-connector-bun"

describe("handleWebSocketMessage", () => {
  function makeRequestId(type: string) {
    return type + "-" + Math.random().toString(36).slice(2)
  }

  it("should handle set and get", async () => {
    const sent: any[] = []
    const store: Record<string, any> = {}
    const worker = {
      async get(key: string) { return store[key] },
      async set(key: string, value: any) { store[key] = value }
    }
    // set
    const setRequestId = makeRequestId("set")
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: "set", key: "foo", value: 42, requestId: setRequestId },
      undefined,
      worker
    )
    expect(sent[sent.length-1]).toEqual({ type: "set", key: "foo", requestId: setRequestId, status: "ok" })
    // get
    const getRequestId = makeRequestId("get")
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: "get", key: "foo", requestId: getRequestId },
      undefined,
      worker
    )
    expect(sent[sent.length-1]).toEqual({ type: "get", key: "foo", requestId: getRequestId, status: "ok", value: 42 })
  })

  it("should handle on and post", async () => {
    const sent: any[] = []
    const listeners = new Map<string, (msg: any) => void>()
    const worker = {
      on: (stream: string, handler: (data: any) => void) => listeners.set(stream, handler),
      post: async (stream: string, data: any) => {
        // simulate posting to the stream by calling the handler
        if (listeners.has(stream)) listeners.get(stream)!(data)
      }
    }
    const stream = "test-stream"
    const onRequestId = makeRequestId("on")
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: "on", stream, requestId: onRequestId },
      listeners,
      worker
    )
    expect(sent[sent.length-1]).toEqual({ type: "listen", stream, requestId: onRequestId, status: "listening" })
    // post
    const postRequestId = makeRequestId("post")
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: "post", stream, data: { foo: "bar" }, requestId: postRequestId },
      listeners,
      worker
    )
    // The post should trigger both a post:sent and a listen:data message, order may vary
    const postSentMsg = { type: "post", stream, requestId: postRequestId, status: "sent" }
    const listenDataMsg = { type: "listen", stream, requestId: onRequestId, status: "data", data: { foo: "bar" } }
    expect(sent).toContainEqual(postSentMsg)
    expect(sent).toContainEqual(listenDataMsg)
  })
})

import { describe, it, expect } from "bun:test"
import { handleWebSocketMessage } from "../connectors/frontend-websocket-connector-bun"
import { MsgType } from "../connectors/MsgType"
import { ProcessWorker } from "../ProcessWorker"

describe("handleWebSocketMessage", () => {
  function makeRequestId(type: string) {
    return type + "-" + Math.random().toString(36).slice(2)
  }

  it("should handle set and get", async () => {
    const sent: any[] = []
    const worker = await ProcessWorker.start("__test-worker");
    // set
    const setRequestId = makeRequestId("set")
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: MsgType.SET, key: "foo", value: 42, requestId: setRequestId },
      undefined,
      worker
    )
    expect(sent[sent.length-1]).toEqual({ type: MsgType.SET, key: "foo", requestId: setRequestId, status: "ok" })
    // get
    const getRequestId = makeRequestId("get")
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: MsgType.GET, key: "foo", requestId: getRequestId },
      undefined,
      worker
    )
    expect(sent[sent.length-1]).toEqual({ type: MsgType.GET, key: "foo", requestId: getRequestId, status: "ok", value: 42 })
  })

  it("should handle on and post", async () => {
    const sentMessages: any[] = []
    const listeners = new Map<string, (msg: any) => void>()
    const worker = await ProcessWorker.start("__test-worker");
    const stream = "test-stream"
    const onRequestId = makeRequestId("on")

    // 
    await handleWebSocketMessage(
      msg => sentMessages.push(msg),
      { type: MsgType.LISTEN, stream, requestId: onRequestId },
      listeners,
      worker
    )
    expect(sentMessages[sentMessages.length - 1]).toEqual({
      type: MsgType.LISTEN,
      stream,
      requestId: onRequestId,
      status: "listening"
    })
    // post
    const postRequestId = makeRequestId("post")
    await handleWebSocketMessage(
      msg => sentMessages.push(msg),
      { type: MsgType.POST, stream, data: { foo: "bar" }, requestId: postRequestId },
      listeners,
      worker
    ) 
    
    
  })

  it("should handle unlisten (unsubscribe)", async () => {
    const sent: any[] = []
    const listeners = new Map<string, (msg: any) => void>()
    const worker = await ProcessWorker.start("__test-worker");
    const stream = "test-unlisten-stream"
    const onRequestId = crypto.randomUUID()
    const listenerKey = `${MsgType.LISTEN}:${stream}:${onRequestId}`
    // Listen first
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: MsgType.LISTEN, stream, requestId: onRequestId },
      listeners,
      worker
    )

    expect(listeners.has(listenerKey)).toBe(true)
    await handleWebSocketMessage(
      msg => sent.push(msg),
      { type: MsgType.UNLISTEN, stream, requestId: onRequestId },
      listeners,
      worker
    )
    expect(listeners.has(listenerKey)).toBe(false)
    worker.shutdown()
  })
})

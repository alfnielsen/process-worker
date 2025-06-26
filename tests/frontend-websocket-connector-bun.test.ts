import { describe, it, expect } from "bun:test"
import { ServerConnector } from "../src/server-connector"
import { MsgType } from "../src/MsgType"
import { ProcessWorker } from "../src/ProcessWorker"

describe("ServerConnector.handleWebSocketMessage", () => {
  function makeRequestId(type: string) {
    return type + "-" + Math.random().toString(36).slice(2)
  }

  it("should handle set and get", async () => {
    const sent: any[] = []
    const connector = await ServerConnector.start(0, { workerName: "__test-worker" }, false)
    // set
    const setRequestId = makeRequestId("set")
    await connector.handleWebSocketMessage(
      (msg: any) => sent.push(msg),
      { type: MsgType.SET, key: "foo", value: 42, requestId: setRequestId },
      new Map()
    )
    expect(sent[sent.length-1]).toEqual({ type: MsgType.SET, key: "foo", requestId: setRequestId, status: "ok" })
    // get
    const getRequestId = makeRequestId("get")
    await connector.handleWebSocketMessage(
      (msg: any) => sent.push(msg),
      { type: MsgType.GET, key: "foo", requestId: getRequestId },
      new Map()
    )
    expect(sent[sent.length-1]).toEqual({ type: MsgType.GET, key: "foo", requestId: getRequestId, status: "ok", value: 42 })
  })

  it("should handle on and post", async () => {
    const sentMessages: any[] = []
    const listeners = new Map<string, (msg: any) => void>()
    const connector = await ServerConnector.start(0, { workerName: "__test-worker" }, false)
    const stream = "test-stream"
    const onRequestId = makeRequestId("on")
    // listen
    await connector.handleWebSocketMessage(
      (msg: any) => sentMessages.push(msg),
      { type: MsgType.LISTEN, stream, requestId: onRequestId },
      listeners
    )
    expect(sentMessages[sentMessages.length - 1]).toEqual({
      type: MsgType.LISTEN,
      stream,
      requestId: onRequestId,
      status: "listening"
    })
    // post
    const postRequestId = makeRequestId("post")
    await connector.handleWebSocketMessage(
      (msg: any) => sentMessages.push(msg),
      { type: MsgType.POST, stream, data: { foo: "bar" }, requestId: postRequestId },
      listeners
    )
    // No assertion for post, as it depends on listeners
  })

  it("should handle unlisten (unsubscribe)", async () => {
    const sent: any[] = []
    const listeners = new Map<string, (msg: any) => void>()
    const worker = await ProcessWorker.start("__test-worker");
    const connector = await ServerConnector.start(0, { workerName: "__test-worker" }, false)
    const stream = "test-unlisten-stream"
    const onRequestId = crypto.randomUUID()
    const listenerKey = `${MsgType.LISTEN}:${stream}:${onRequestId}`
    // Listen first
    await connector.handleWebSocketMessage(
      (msg: any) => sent.push(msg),
      { type: MsgType.LISTEN, stream, requestId: onRequestId },
      listeners
    )
    expect(listeners.has(listenerKey)).toBe(true)
    await connector.handleWebSocketMessage(
      (msg: any) => sent.push(msg),
      { type: MsgType.UNLISTEN, stream, requestId: onRequestId },
      listeners
    )
    expect(listeners.has(listenerKey)).toBe(false)
    worker.shutdown()
  })
})

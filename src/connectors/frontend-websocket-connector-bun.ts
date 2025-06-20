import { ProcessWorker, type ProcessWorkerOptions } from "../ProcessWorker"
import { serve } from "bun"
import type { ServerWebSocket } from "bun"
import { MsgType } from "./MsgType"

const WS_PORT = Number(process.env.WS_CONNECTOR_PORT) || 3068

/**
 * Creates and starts a Bun WebSocket server that exposes get, set, on, and post methods for the frontend.
 * @param port websocket port number
 * @param workerOptions the ProcessWorkerOptions
 * @returns A promise that resolves to the server instance
 */
export async function startFrontendWebSocketConnector(
  port?: number,
  workerOptions: ProcessWorkerOptions = { workerName: "frontend-ws-connector" }
) {
  const wsListeners = new WeakMap<ServerWebSocket<unknown>, Map<string, (msg: any) => void>>()
  const PORT = port ?? WS_PORT
  const worker = await ProcessWorker.start(workerOptions)

  const server = serve({
    port: PORT,
    fetch(req, server) {
      if (server.upgrade(req)) {
        return undefined
      }
      return new Response("WebSocket endpoint only", { status: 400 })
    },
    websocket: {
      async open(ws: ServerWebSocket<unknown>) {
        ws.send(JSON.stringify({ type: MsgType.CONNECT, message: "WebSocket connection established" }))
        wsListeners.set(ws, new Map())
      },
      async message(ws: ServerWebSocket<unknown>, data) {
        const listeners = wsListeners.get(ws)
        const send = (msg: object) => {
          ws.send(JSON.stringify(msg))
        }
        await handleWebSocketMessage(send, data, listeners, worker)
      },
      close(ws: ServerWebSocket<unknown>) {
        const listeners = wsListeners.get(ws)
        if (listeners) {
          listeners.clear()
          wsListeners.delete(ws)
        }
      },
    },
  })

  console.log(`WebSocket server running on ws://localhost:${PORT}`)
  return server
}

/**
 * Handles a WebSocket message for the frontend connector.
 * Extracted for testability.
 */
export async function handleWebSocketMessage(
  send: (data: object) => void,
  data: any,
  listeners: Map<string, (msg: any) => void> | undefined,
  worker: ProcessWorker
) {
  let msg
  try {
    msg = typeof data === "string" ? JSON.parse(data) : data
  } catch (e) {
    send({ type: MsgType.ERROR, error: "Invalid JSON" })
    return
  }
  if (!msg || typeof msg !== "object" || !msg.type) {
    send({ type: MsgType.ERROR, error: "Missing type in message" })
    return
  }
  const requestId = msg.requestId
  if (!requestId || typeof requestId !== "string") {
    send({ type: MsgType.ERROR, error: "Missing or invalid requestId", requestId })
    return
  }
  // Get
  if (msg.type === MsgType.GET) {
    const value = await worker.get(msg.key)
    send({
      type: MsgType.GET,
      key: msg.key,
      requestId,
      status: "ok",
      value,
    })
    return
  }
  // Set
  if (msg.type === MsgType.SET) {
    await worker.set(msg.key, msg.value)
    send({
      type: MsgType.SET,
      key: msg.key,
      requestId,
      status: "ok",
    })
    return
  }
  // Handle listen and unlisten
  // Listen
  if (msg.type === MsgType.LISTEN) {
    if (!listeners) return
    // Allow multiple listeners per stream/requestId by using a composite key
    const listenerKey = `${MsgType.LISTEN}:${msg.stream}:${msg.requestId}`
    const unsub = worker.on(msg.stream, (data: any) => {
      send({
        type: MsgType.LISTEN,
        stream: msg.stream,
        requestId,
        status: MsgType.DATA,
        data,
      })
    })
    listeners.set(listenerKey, unsub)
    send({
      type: MsgType.LISTEN,
      stream: msg.stream,
      requestId,
      status: "listening",
    })
    return
  }
   // Unlisten
  if (msg.type === MsgType.UNLISTEN) {
    if (!listeners) return
    // Allow multiple listeners per stream/requestId by using a composite key
    const listenerKey = `${MsgType.LISTEN}:${msg.stream}:${msg.requestId}`
    const hasKey = listeners.has(listenerKey)
    if (!hasKey) {
      send({
        type: MsgType.UNLISTEN,
        stream: msg.stream,
        requestId,
        status: "not found",
      })
      return
    }
    // Call the unsubscribe function
    const unsub = listeners.get(listenerKey);
    unsub?.("unsubscribed")
    // Remove the listener from the map
    listeners.delete(listenerKey)
    send({
      type: MsgType.UNLISTEN,
      stream: msg.stream,
      requestId,
      status: "unsubscribed",
    })
  }
  // Post
  if (msg.type === MsgType.POST) {
    await worker.post(msg.stream, msg.data)
    send({
      type: MsgType.POST,
      stream: msg.stream,
      requestId,
      status: "sent",
    })
    // Also notify listeners if any
    const listenerKey = `${MsgType.POST}:${requestId}:${msg.stream}`
    if (listeners && listeners.has(listenerKey)) {
      listeners.get(listenerKey)?.("sent")
      listeners.delete(listenerKey)
    }
    return
  }
  // Handle other message types
  send({
    type: MsgType.ERROR,
    error: "Unknown type",
    requestId,
  })
  return
}

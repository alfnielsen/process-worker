import { ProcessWorker, type ProcessWorkerOptions } from "../ProcessWorker"
import { serve } from "bun"
import type { ServerWebSocket } from "bun"

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
        ws.send(JSON.stringify({ type: "connected", message: "WebSocket connection established" }))
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
  worker: any
) {
  let msg
  try {
    msg = typeof data === "string" ? JSON.parse(data) : data
  } catch (e) {
    send({ type: "error", error: "Invalid JSON" })
    return
  }
  if (!msg || typeof msg !== "object" || !msg.type) {
    send({ type: "error", error: "Missing type in message" })
    return
  }
  const requestId = msg.requestId
  if (!requestId || typeof requestId !== "string") {
    send({ type: "error", error: "Missing or invalid requestId", requestId })
    return
  }
  if (msg.type === "get") {
    const value = await worker.get(msg.key)
    send({
        type: "get",
        key: msg.key,
        requestId,
        status: "ok",
        value,
      }
    )
    return
  }
  if (msg.type === "set") {
    await worker.set(msg.key, msg.value)
    send({
        type: "set",
        key: msg.key,
        requestId,
        status: "ok",
      }
    )
    return
  }
  if (msg.type === "on") {
    if (!listeners) return
    if (listeners.has(msg.stream)) return // already listening
    const handler = (data: any) => {
      send({
          type: "listen",
          stream: msg.stream,
          requestId,
          status: "data",
          data,
        }
      )
    }
    listeners.set(msg.stream, handler)
    worker.on(msg.stream, handler)
    send({
        type: "listen",
        stream: msg.stream,
        requestId,
        status: "listening",
      })
    
    return
  }
  if (msg.type === "post") {
    await worker.post(msg.stream, msg.data)
    send({
      type: "post",
      stream: msg.stream,
      requestId,
      status: "sent"
    })
    return
  }
  if (msg.type === "ping") {
    send({ type: "pong", requestId })
    return
  }
  if (msg.type === "connected") {
    send({ type: "connected", message: "WebSocket connection established", requestId })
    return
  }
  send({
    type: "error",
    error: "Unknown type",
    requestId,
  })
  return
}

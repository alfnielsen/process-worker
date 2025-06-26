import { ProcessWorker, type ProcessWorkerOptions } from "./ProcessWorker"
import type { ServerWebSocket } from "bun"
import { MsgType } from "./MsgType"

const WS_PORT = Number(process.env.WS_CONNECTOR_PORT) || 3068

/**
 * Bun WebSocket server class that exposes get, set, on, and post methods for the frontend.
 */
export class ServerConnector {
  private wsListeners = new WeakMap<ServerWebSocket<unknown>, Map<string, (msg: any) => void>>()
  private worker: ProcessWorker
  private server: ReturnType<typeof Bun.serve> | undefined
  private debug: boolean
  public port: number

  static async start(
    port?: number,
    workerOptions: ProcessWorkerOptions = { workerName: "server-connector" },
    debug: boolean = false
  ) {
    const PORT = port ?? WS_PORT
    const worker = await ProcessWorker.start(workerOptions)
    const instance = new ServerConnector(worker, PORT, debug)
    instance.startServer()
    return instance
  }


  private constructor(worker: ProcessWorker, port: number, debug: boolean) {
    this.worker = worker
    this.port = port
    this.debug = debug
  }

  private startServer() {
    this.server = Bun.serve({
      port: this.port,
      fetch: (req, server) => {
        if (server.upgrade(req)) {
          return undefined
        }
        return new Response("WebSocket endpoint only", { status: 400 })
      },
      websocket: {
        open: async (ws: ServerWebSocket<unknown>) => {
          ws.send(JSON.stringify({ type: MsgType.CONNECT, message: "WebSocket connection established" }))
          this.wsListeners.set(ws, new Map())
        },
        message: async (ws: ServerWebSocket<unknown>, data) => {
          if (this.debug) {
            console.log(`Received message from client: ${data}`)
          }
          const listeners = this.wsListeners.get(ws)
          const send = (msg: object) => {
            ws.send(JSON.stringify(msg))
          }
          if (!listeners) {
            console.error("No listeners map found for this WebSocket connection")
            return
          }
          await this.handleWebSocketMessage(send, data, listeners)
        },
        close: (ws: ServerWebSocket<unknown>) => {
          const listeners = this.wsListeners.get(ws)
          if (listeners) {
            listeners.clear()
            this.wsListeners.delete(ws)
          }
        },
      },
    })
    console.log(`WebSocket server running on ws://localhost:${this.port}`)
  }

  /**
   * Handles a WebSocket message for the frontend connector.
   * Extracted for testability.
   */
  async handleWebSocketMessage(
    send: (data: object) => void,
    data: any,
    listeners: Map<string, (msg: any) => void>
  ) {
    let msg
    try {
      msg = typeof data === "string" ? JSON.parse(data) : data
    } catch (e) {
      if (this.debug) {
        console.error(`Invalid JSON: ${e}`)
      }
      send({ type: MsgType.ERROR, error: `Invalid JSON: ${e}` })
      return
    }
    if (!msg || typeof msg !== "object" || !msg.type) {
      if (this.debug) {
        console.error("Missing type in message:", msg)
      }
      send({ type: MsgType.ERROR, error: "Missing type in message" })
      return
    }
    const requestId = msg.requestId
    if (!requestId || typeof requestId !== "string") {
      if (this.debug) {
        console.error("Missing or invalid requestId:", msg)
      }
      send({ type: MsgType.ERROR, error: "Missing or invalid requestId", requestId })
      return
    }
    // Get
    if (msg.type === MsgType.GET) {
      const value = await this.worker.get(msg.key)
      if (this.debug) {
        console.error("Get request received:", msg.key, "Value:", value)
      }
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
      await this.worker.set(msg.key, msg.value)
      if (this.debug) {
        console.error("Set request received:", msg.key, "Value:", msg.value)
      }
      send({
        type: MsgType.SET,
        key: msg.key,
        requestId,
        status: "ok",
      })
      return
    }
    // Listen
    if (msg.type === MsgType.LISTEN) {
      if (!listeners) return
      const listenerKey = `${MsgType.LISTEN}:${msg.stream}:${msg.requestId}`
      const unsub = this.worker.on(msg.stream, (data: any) => {
        send({
          type: MsgType.LISTEN,
          stream: msg.stream,
          requestId,
          status: MsgType.DATA,
          data,
        })
      })
      listeners.set(listenerKey, unsub)
      if (this.debug) {
        console.log("Listen request received:", msg.stream, "RequestId:", requestId)
      }
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
      const listenerKey = `${MsgType.LISTEN}:${msg.stream}:${msg.requestId}`
      const hasKey = listeners.has(listenerKey)
      if (!hasKey) {
        if (this.debug) {
          console.error("Unlisten request received for non-existent listener:", msg.stream, "RequestId:", requestId)
        }
        send({
          type: MsgType.UNLISTEN,
          stream: msg.stream,
          requestId,
          status: "not found",
        })
        return
      }
      const unsub = listeners.get(listenerKey)
      unsub?.("unsubscribed")
      listeners.delete(listenerKey)
      send({
        type: MsgType.UNLISTEN,
        stream: msg.stream,
        requestId,
        status: "unsubscribed",
      })
      return
    }
    // Post
    if (msg.type === MsgType.POST) {
      await this.worker.post(msg.stream, msg.data)
      if (this.debug) {
        console.error("Post request received:", msg.stream, "Data:", msg.data)
      }
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
    if (this.debug) {
      console.error("Unknown message type:", msg.type, "RequestId:", requestId)
    }
    send({
      type: MsgType.ERROR,
      error: "Unknown type",
      requestId,
    })
    return
  }

  /**
   * Stop the WebSocket server.
   */
  stop() {
    this.server?.stop?.()
    this.server = undefined
    this.wsListeners = new WeakMap()
    console.log("WebSocket server stopped.")
  }
}

import { request } from "http"
import RedisHub from "./RedisHub"

export type Message = {
  type: string // The type of message (e.g., "listen", "publish", "getVal", etc.)
  response?: boolean // Indicates if this is a response to a request
  requestId?: string // Optional request ID for tracking responses
  message?: string // Optional message for responses
  status?: string // Optional status message
  error?: string // Optional error message
  payload?: any // The payload of the message
  [extra: string]: any // Allow extra fields
}

// This is a WebSocket that connects to a RedisHub
export class RedisHubSocket {
  private _hub: RedisHub
  get hub() {
    return this._hub
  }
  constructor(opt: { prefix?: string } = {}) {
    this._hub = RedisHub.createHub(opt)
  }

  /**
   * Start a Bun WebSocket server that connects clients to the RedisHub.
   * @param port The port to listen on (default 3000)
   * @param path The WebSocket path (default "/ws")
   */
  async listen({ port = 3000, path = "/ws" }: { port?: number; path?: string } = {}) {
    const hub = this._hub
    const clients = new Set<any>()
    const subscriptions = new Map<any, Set<string>>()
    const server = Bun.serve({
      port,
      fetch(req, server) {
        if (server.upgrade(req)) return
        return new Response("WebSocket endpoint only", { status: 400 })
      },
      websocket: {
        open(ws) {
          clients.add(ws)
        },
        close(ws) {
          clients.delete(ws)
          subscriptions.delete(ws)
        },
        async message(ws, message) {
          const msg = RedisHubSocket.parseMessage(message)
          const send = (data: object) => {
            ws.send(
              JSON.stringify({
                response: true,
                requestId: msg.requestId || undefined,
                requestMeta: msg.requestMeta || undefined,
                ...data,
              })
            )
          }
          if (msg.error) {
            send({ type:"error", error: msg.error })
            return
          }
          if (msg.type === "listen" && msg.stream) {
            // Subscribe this client to a RedisHub stream
            if (!subscriptions.has(ws)) subscriptions.set(ws, new Set())
            if (!subscriptions.get(ws)!.has(msg.stream)) {
              subscriptions.get(ws)!.add(msg.stream)
              // Create a dedicated RedisHub instance for this subscription
              const dedicatedHub = RedisHub.createHub({ prefix: hub.prefix })
              dedicatedHub.listen(msg.stream, event => {
                if (clients.has(ws)) {
                  // Forward eventType and data at top level for test compatibility
                  send({
                    type: "response",
                    stream: msg.stream,
                    eventType: event.type, // map RedisCacheEvent.type to eventType
                    data: event.data,
                    id: event.id
                  })
                }
              })
            }
            send({ ok: true, subscribed: msg.stream })
            return
          }
          if (msg.type === "publish" && msg.stream && msg.eventType && msg.data) {
            // Publish to a RedisHub stream
            await hub.publish(msg.stream, msg.eventType, msg.data)
            send({ ok: true, published: msg.stream })
            return
          }
          if (msg.type === "getStreamValues" && msg.stream) {
            try {
              const values = await hub.getStreamValues(
                msg.stream,
                msg.start || "-",
                msg.end || "+",
                msg.count || 1000,
                msg.ignorePrefix || false
              )
              send({ ok: true, values })
            } catch (e) {
              send({ error: String(e) })
            }
            return
          }
          if (msg.type === "getVal" && msg.key) {
            try {
              const value = await hub.getVal(msg.key, msg.ignorePrefix || false)
              send({ ok: true, value })
            } catch (e) {
              send({ error: String(e) })
            }
            return
          }
          if (msg.type === "setVal" && msg.key && msg.value !== undefined) {
            try {
              await hub.setVal(msg.key, msg.value, msg.ignorePrefix || false)
              send({ ok: true })
            } catch (e) {
              send({ error: String(e) })
            }
            return
          }
          if (msg.type === "getRawVal" && msg.key) {
            try {
              const value = await hub.getRawVal(msg.key, msg.ignorePrefix || false)
              send({ ok: true, value })
            } catch (e) {
              send({ error: String(e) })
            }
            return
          }
          if (msg.type === "delKey" && msg.key) {
            try {
              await hub.delKey(msg.key, msg.ignorePrefix || false)
              send({ ok: true })
            } catch (e) {
              send({ error: String(e) })
            }
            return
          }
          if (msg.type === "delKeys" && msg.pattern) {
            try {
              await hub.delKeys(msg.pattern, msg.ignorePrefix || false)
              send({ ok: true })
            } catch (e) {
              send({ error: String(e) })
            }
            return
          }
          send({ error: "Unknown message type or missing fields" })
        },
      },
    })
    return server
  }

  getStreamValues(
    stream: string,
    start: string = "-",
    end: string = "+",
    count: number = 1000,
    ignorePrefix: boolean = false
  ) {
    return this._hub.getStreamValues(stream, start, end, count, ignorePrefix)
  }

  getVal<T>(key: string, ignorePrefix: boolean = false): Promise<T | undefined> {
    return this._hub.getVal<T>(key, ignorePrefix)
  }

  setVal(key: string, value: any, ignorePrefix: boolean = false) {
    return this._hub.setVal(key, value, ignorePrefix)
  }

  getRawVal(key: string, ignorePrefix: boolean = false): Promise<string | undefined> {
    return this._hub.getRawVal(key, ignorePrefix)
  }

  delKey(key: string, ignorePrefix: boolean = false) {
    return this._hub.delKey(key, ignorePrefix)
  }

  delKeys(pattern: string, ignorePrefix: boolean = false) {
    return this._hub.delKeys(pattern, ignorePrefix)
  }

  static parseMessage(message: string | object): Message {
    let msg: Message | undefined
    try {
      // Parse the incoming message
      msg = typeof message === "string" ? JSON.parse(message) : message
      if (!msg || typeof msg !== "object" || !msg.type) {
        return { type: "error", error: "Invalid message format" }
      }
      return msg as Message
    } catch (e) {
      return { type: "error", error: "Invalid JSON" }
    }
  }
}

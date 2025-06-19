/**
 * FrontendWebSocketConnectorClient
 * A simple client for connecting to the Bun WebSocket backend and using get, set, on, and post methods.
 */
export class FrontendWebSocketConnectorClient {
  private ws: WebSocket
  private ready: Promise<void>
  private listeners: Map<string, (data: any) => void> = new Map()

  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.ws.onmessage = this.handleMessage.bind(this)
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve()
      this.ws.onerror = reject
    })
  }

  private handleMessage(event: MessageEvent) {
    let msg: undefined | Record<string, any>
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    if (!msg || typeof msg !== "object" || !msg.type) {
      console.error("Invalid message format:", msg)
      return
    }
    // Handle the message based on its type
    if (msg.type === "error") {
      console.error("Error from server:", msg.error)
      return
    }
    if (msg.type === "connected") {
      console.log("WebSocket connection established:", msg.message)
      return
    }
    if (msg.type === "disconnected") {
      console.log("WebSocket connection closed:", msg.message)
      this.close()
      return
    }
    // Validate requestId
    if (!msg.requestId || typeof msg.requestId !== "string") {
      console.error("Missing or invalid requestId in message:", msg)
      return
    }

    const listenerKey = `${msg.requestId}:${msg.type}`
    if (this.listeners.has(listenerKey)) {
      const listener = this.listeners.get(listenerKey)
      if (listener) {
        listener(msg)
        this.listeners.delete(listenerKey)
      }
      return
    }
    if (msg.type === "on" && msg.stream && this.listeners.has(msg.stream)) {
      this.listeners.get(msg.stream)?.(msg.data)
    }
    if (msg.type === "get" && msg.key && this.listeners.has(`get:${msg.key}`)) {
      this.listeners.get(`get:${msg.key}`)?.(msg.value)
    }
    if (msg.type === "set" && msg.key && this.listeners.has(`set:${msg.key}`)) {
      this.listeners.get(`set:${msg.key}`)?.(msg.status)
    }
    if (msg.type === "post" && msg.stream && this.listeners.has(`post:${msg.stream}`)) {
      this.listeners.get(`post:${msg.stream}`)?.(msg.status)
    }
  }

  async get(key: string): Promise<any> {
    await this.ready
    return new Promise(resolve => {
      const requestId = crypto.randomUUID()
      const listenerKey = `get:${key}:${requestId}`
      this.listeners.set(listenerKey, value => {
        this.listeners.delete(listenerKey)
        resolve(value)
      })
      this.ws.send(JSON.stringify({ type: "get", requestId, key }))
    })
  }

  async set(key: string, value: any): Promise<string> {
    await this.ready
    return new Promise(resolve => {
      const requestId = crypto.randomUUID()
      const listenerKey = `set:${requestId}:${key}`
      this.listeners.set(listenerKey, status => {
        this.listeners.delete(listenerKey)
        resolve(status)
      })
      this.ws.send(JSON.stringify({ type: "set", requestId, key, value }))
    })
  }

  async post(stream: string, data: any): Promise<string> {
    await this.ready
    return new Promise(resolve => {
      const requestId = crypto.randomUUID()
      const listenerKey = `post:${requestId}:${stream}`
      this.listeners.set(listenerKey, status => {
        this.listeners.delete(listenerKey)
        resolve(status)
      })
      this.ws.send(
        JSON.stringify({
          type: "post",
          requestId,
          stream,
          data,
        })
      )
    })
  }

  async on(stream: string, handler: (data: any) => void): Promise<void> {
    await this.ready
    const requestId = crypto.randomUUID()
    this.listeners.set(stream, handler)
    this.ws.send(
      JSON.stringify({
        type: "on",
        requestId,
        stream,
      })
    )
  }

  close() {
    this.ws.close()
    this.listeners.clear()
  }
}

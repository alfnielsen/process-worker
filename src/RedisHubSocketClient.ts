
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

// This is a WebSocket client for RedisHub, intended for browser use
export class RedisHubSocketClient {
  private ws: WebSocket
  private url: string
  private listeners: Map<string, Set<(event: any) => void>> = new Map()
  private pendingRequests: Map<string, (response: any) => void> = new Map()
  private isOpen: boolean = false
  private reconnecting: boolean = false
  private reconnectInterval: number = 1000

  static async connect(url: string): Promise<RedisHubSocketClient> {
    const client = new RedisHubSocketClient(url)
    await client.awaitReady()
    return client
  }

  private constructor(url: string) {
    this.url = url
    this.ws = this.createWebSocket()
  }

  private createWebSocket(): WebSocket {
    const ws = new WebSocket(this.url)
    ws.onopen = () => {
      this.isOpen = true
      this.reconnecting = false
    }
    ws.onclose = () => {
      this.isOpen = false
      if (!this.reconnecting) this.reconnect()
    }
    ws.onerror = () => {
      this.isOpen = false
      if (!this.reconnecting) this.reconnect()
    }
    ws.onmessage = (event) => {
      let msg: Message
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
        this.pendingRequests.get(msg.requestId)!(msg)
        this.pendingRequests.delete(msg.requestId)
      } else if ((msg.type === "event" || msg.type === "response") && msg.stream) {
        const set = this.listeners.get(msg.stream)
        if (set) set.forEach(fn => fn(msg))
      }
    }
    return ws
  }

  private reconnect() {
    this.reconnecting = true
    setTimeout(() => {
      this.ws = this.createWebSocket()
    }, this.reconnectInterval)
  }

  private send(msg: Message) {
    if (this.isOpen) {
      this.ws.send(JSON.stringify(msg))
    } else {
      setTimeout(() => this.send(msg), 100)
    }
  }

  listen(stream: string, handler: (event: any) => void) {
    if (!this.listeners.has(stream)) this.listeners.set(stream, new Set())
    this.listeners.get(stream)!.add(handler)
    this.send({ type: "listen", stream })
  }

  unlisten(stream: string, handler: (event: any) => void) {
    if (this.listeners.has(stream)) {
      this.listeners.get(stream)!.delete(handler)
      if (this.listeners.get(stream)!.size === 0) {
        this.listeners.delete(stream)
        this.send({ type: "unlisten", stream })
      }
    }
  }

  publish(stream: string, eventType: string, data: any): Promise<any> {
    return this.sendRequest({ type: "publish", stream, eventType, data })
  }

  getStreamValues(stream: string, start = "-", end = "+", count = 1000): Promise<any> {
    return this.sendRequest({ type: "getStreamValues", stream, start, end, count })
  }

  getVal<T>(key: string): Promise<T | undefined> {
    return this.sendRequest({ type: "getVal", key })
  }

  setVal(key: string, value: any): Promise<any> {
    return this.sendRequest({ type: "setVal", key, value })
  }

  delKey(key: string): Promise<any> {
    return this.sendRequest({ type: "delKey", key })
  }

  delKeys(pattern: string): Promise<any> {
    return this.sendRequest({ type: "delKeys", pattern })
  }

  private sendRequest(msg: Message): Promise<any> {
    const requestId = crypto.randomUUID()
    msg.requestId = requestId
    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve)
      this.send(msg)
    })
  }

  async awaitReady(timeout = 2000): Promise<void> {
    if (this.isOpen) return
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for connection")), timeout)
      const check = () => {
        if (this.isOpen) {
          clearTimeout(timer)
          resolve()
        } else {
          setTimeout(check, 10)
        }
      }
      check()
    })
  }

  close() {
    this.ws.close()
  }
}

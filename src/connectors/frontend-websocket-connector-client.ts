import { MsgType } from "./MsgType"

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
    if (msg.type === MsgType.ERROR) {
      console.error("Error from server:", msg.error)
      return
    }
    if (msg.type === MsgType.CONNECT) {
      console.log("WebSocket connection established:", msg.message)
      return
    }
    if (msg.type === MsgType.DISCONNECT) {
      console.log("WebSocket connection closed:", msg.message)
      this.close()
      return
    }
    if (msg.type === MsgType.GET) {
      if (msg.key && msg.requestId) {
        const listenerKey = `${MsgType.GET}:${msg.key}:${msg.requestId}`
        if (this.listeners.has(listenerKey)) {
          this.listeners.get(listenerKey)?.(msg.value)
          this.listeners.delete(listenerKey)
        }
      }
      return
    }
    if (msg.type === MsgType.SET) {
      if (msg.key && msg.requestId) {
        const listenerKey = `${MsgType.SET}:${msg.requestId}:${msg.key}`
        if (this.listeners.has(listenerKey)) {
          this.listeners.get(listenerKey)?.(msg.status)
          this.listeners.delete(listenerKey)
        }
      }
      return
    }
    if (msg.type === MsgType.POST) {
      if (msg.stream && msg.requestId) {
        const listenerKey = `${MsgType.POST}:${msg.requestId}:${msg.stream}`
        if (this.listeners.has(listenerKey)) {
          this.listeners.get(listenerKey)?.(msg.status)
          this.listeners.delete(listenerKey)
        }
      }
      return
    }
    if (msg.type === MsgType.LISTEN) {
      if (msg.stream && msg.requestId && msg.status === MsgType.DATA) {
        const listenerKey = `${MsgType.LISTEN}:${msg.stream}:${msg.requestId}`
        if (this.listeners.has(listenerKey)) {
          this.listeners.get(listenerKey)?.(msg.data)
        }
      }
      return
    }
    if (msg.type === MsgType.DATA) {
      // Reserved for future use if needed
      return
    }
    if (msg.type === MsgType.STATUS) {
      // Reserved for future use if needed
      return
    }
  }

  async get(key: string): Promise<any> {
    await this.ready
    return new Promise(resolve => {
      const requestId = crypto.randomUUID()
      const listenerKey = `${MsgType.GET}:${key}:${requestId}`
      this.listeners.set(listenerKey, value => {
        this.listeners.delete(listenerKey)
        resolve(value)
      })
      this.ws.send(JSON.stringify({ type: MsgType.GET, requestId, key }))
    })
  }

  async set(key: string, value: any): Promise<string> {
    await this.ready
    return new Promise(resolve => {
      const requestId = crypto.randomUUID()
      const listenerKey = `${MsgType.SET}:${requestId}:${key}`
      this.listeners.set(listenerKey, status => {
        this.listeners.delete(listenerKey)
        resolve(status)
      })
      this.ws.send(JSON.stringify({ type: MsgType.SET, requestId, key, value }))
    })
  }

  async post(stream: string, data: any): Promise<string> {
    await this.ready
    return new Promise(resolve => {
      const requestId = crypto.randomUUID()
      const listenerKey = `${MsgType.POST}:${requestId}:${stream}`
      this.listeners.set(listenerKey, status => {
        this.listeners.delete(listenerKey)
        resolve(status)
      })
      this.ws.send(
        JSON.stringify({
          type: MsgType.POST,
          requestId,
          stream,
          data,
        })
      )
    })
  }

  async on(stream: string, handler: (data: any) => void): Promise<string> {
    await this.ready
    const requestId = crypto.randomUUID()
    const listenerKey = `${MsgType.LISTEN}:${stream}:${requestId}`
    this.listeners.set(listenerKey, handler)
    this.ws.send(
      JSON.stringify({
        type: MsgType.LISTEN,
        requestId,
        stream,
      })
    )
    return listenerKey
  }

  async off(stream: string, requestId: string): Promise<void> {
    await this.ready
    this.ws.send(
      JSON.stringify({
        type: MsgType.UNLISTEN,
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

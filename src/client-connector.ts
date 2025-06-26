import { MsgType } from "../shared/MsgType"

/**
 * ClientConnector
 * A simple client for connecting to the Bun WebSocket backend and using get, set, on, and post methods.
 */
export class ClientConnector {
  private ws: WebSocket
  private ready: Promise<void>
  private listeners: Map<string, (data: any) => void> = new Map()

  /**
   * Connects to the ServerConnection  at the specified URL.
   * 
   * This method returns a promise that resolves to a ClientConnector instance once the connection is established.
   * @example
   * ```ts
   * const ws = await ClientConnector.connect("ws://localhost:3080")
   * console.log("Connected to server")
   * // To listen to a stream, you can use:
   * var listenId = ws.on("myStream", (data) => {
   *   console.log("Received data:", data)
   * })
   * // To unsubscribe from the stream, you can use:
   * await ws.off("myStream", listenId) // Unsubscribe from the stream
   * // Posting data to a stream and getting a value by key:
   * await ws.post("myStream", { message: "Hello, World!" })
   * // To get a value by key from global cache:
   * const value = await ws.get("myKey")
   * console.log("Value from server:", value)
   * // To set a value by key in global cache:
   * await ws.set("myKey", "myValue")
   * // To close the connection when done:
   * ws.close()
   * ```
   * 
   * @param url The url to the ServerConnection, e.g., "ws://localhost:3080".
   * @returns A promise that resolves to a ClientConnector instance.
   */
  static async connect(url: string): Promise<ClientConnector> {
    const connector = new ClientConnector(url)
    await connector.ready
    return connector
  }

  private constructor(url: string) {
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
      if (msg.stream && msg.requestId && msg.status === MsgType.LISTEN) {
        console.log(`Listening to stream: ${msg.stream} with requestId: ${msg.requestId}`)
        const listenerKey = `${MsgType.LISTEN}:${msg.stream}:${msg.requestId}`
        if (this.listeners.has(listenerKey)) {
          //this.listeners.get(listenerKey)?.(msg.status)
        }
        return
      }
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

  /**
   * Returns a value from the server by key.
   * @param key The key to retrieve the value for.
   * @example
   * ```ts
   * const value = await ws.get("myKey")
   * console.log("Value from server:", value)
   * // If the key does not exist, it will return undefined.
   * ```
   * @returns The WebSocket instance.
   */
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

  /**
   * Sets a value on the server by key.
   * @param key The key to set the value for.
   * @param value The value to set.
   * @example
   * ```ts
   * const status = await ws.set("myKey", "myValue")
   * console.log("Set status:", status)
   * ```
   * @returns The status of the operation.
   */
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

  /**
   * Posts data to a stream on the server.
   * @param stream The stream to post data to.
   * @param data The data to post.
   * @example
   * ```ts
   * const status = await ws.post("myStream", { message: "Hello, World!" })
   * console.log("Post status:", status)
   * ```
   * @returns The status of the operation.
   */
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

  /**
   * Subscribes to a stream on the server.
   * @param stream The stream to listen to.
   * @param handler The handler function to call when data is received.
   * @example
   * ```ts
   * const listenId = await ws.on("myStream", (data) => {
   *   console.log("Received data:", data)
   * })
   * // To unsubscribe from the stream, you can use:
   * await ws.off("myStream", listenId)
   * ```
   * @returns A unique identifier for the listener.
   */
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

  /**
   * Unsubscribes from a stream on the server.
   * @param stream The stream to stop listening to.
   * @param requestId The unique identifier for the listener.
   * @example
   * ```ts
   * await ws.off("myStream", listenId) // Unsubscribe from the stream
   * ```
   */
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

  /**
   * Closes the WebSocket connection and clears all listeners.
   * @example
   * ```ts
   * ws.close() // Close the connection when done
   * ```
   */
  close() {
    this.ws.close()
    this.listeners.clear()
  }
}

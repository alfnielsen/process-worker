import { createClient, type RedisArgument, type RedisClientType } from "redis"

export default class PubSub {
  subscriber = createClient()
  publisher = createClient()

  static async start() {
    const instance = new PubSub()
    await instance.subscriber.connect()
    await instance.publisher.connect()
    const r = await instance.subscriber.configSet("notify-keyspace-events", "KEA")
    // load config 
    const config = await instance.subscriber.configGet("notify-keyspace-events")

    console.log("PubSub notify-keyspace-events set to:", config)

    return instance
  }

  private constructor() {}

  async publish(channel: string, message: string | RedisArgument) {
    await this.publisher.publish(channel, message)
  }
  async subscribe(channel: string, callback: (channel: string, message: string) => void) {
    await this.subscriber.subscribe(channel, message => {
      callback(channel, message)
    })
    this.subscriber.on("__keyevent@0__:expired", (channel, message) => {
      console.log("Key expired:", channel, message)
      callback(channel, message)
    })
    this.subscriber.on("message", (channel, message) => {
      console.log("Message received on channel:", channel, "message:", message) 
      callback(channel, message)
    })
  }
  async unsubscribe(channel: string) {
    await this.subscriber.unsubscribe(channel)
  }
}



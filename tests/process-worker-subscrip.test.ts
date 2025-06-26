import { describe, it, expect } from "bun:test"
import { ProcessWorker } from "../src"
import PubSub from "../src/PubSub.ts"
import RedisRepo from "../src/redis.repo.ts"

const pubSub = await PubSub.start()
const repo = await RedisRepo.start()

const article = {
  id: "123456",
  name: "Using Redis Pub/Sub with Node.js",
  blog: "Logrocket Blog",
}

describe("PubSub", () => {
  it("test of PubSub", async () => {
    console.log(">>>>>>> starting PubSub test")
    await pubSub.subscribe("article", (channel, message) => {
      console.log(" ( 1 ) √ √ √ √ article channel: ", channel, " message: ", message)      
    })

    await pubSub.subscribe("*", (channel, message) => {
      console.log(` ( 2 ) √ √ √ √ ALL :channel: ${channel} message: ${message}`)
    })

    await pubSub.publish("article", "This is a test message")
    await Bun.sleep(1000) // wait for the expiration event to be processed

    // Test the PubSub expiration event
    console.log(">>>>>>> Add expiration event listener")
    
    await pubSub.subscribe("__keyevent@0__:*", (channel, message) => {
      console.log(` ( 3 ) √ √ √ √ EXP :channel: ${channel} message: ${message}`);
    });

    console.log(">>>>>>> Set an article");
    // Set an article with an expiration time
    await repo.set(`articles:${article.id}`, JSON.stringify(article))
    await Bun.sleep(1000) // wait for the expiration event to be processed
    
    console.log(">>>>>>> Set an article with expiration time")
    await repo.set(`articles:${article.id}`, JSON.stringify(article), 1);
    await Bun.sleep(1000) // wait for the expiration event to be processed

    await repo.set(`articles:${article.id}`, JSON.stringify(article), 1);
  });


})

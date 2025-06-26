import { ProcessWorker } from "redis-process-worker"
import { serverConnector } from "redis-process-worker/server"

const w = await ProcessWorker.start("__chat-server-worker")
const port = Bun.env.CHAT_PORT ? Number(Bun.env.CHAT_PORT): 3080

console.log(">>>>> Starting chat server...")
const s = await serverConnector(port, {
    workerName: "__chat-server-worker",
},true
    
)
console.log(`>>>>> Chat server started on ws://localhost:${port}`)  

# redis-process-worker

A worker process helper for using Redis cache and streams. Provides a simple interface for background workers, stream communication, and a global cache.

## Features

- Listen to and post messages on Redis streams
- Log messages to a global logging stream
- Use a global cache (Redis)
- Modular connectors for server and client (WebSocket)
- TypeScript support

## Installation

```sh
npm install redis-process-worker
```

or

```sh
bun add redis-process-worker
```

## Usage

### ProcessWorker (Main API)

```ts
import { ProcessWorker } from "redis-process-worker"

const worker = await ProcessWorker.start({ workerName: "my-worker" })
worker.on("my-stream", msg => {
  console.log("Received:", msg)
})
await worker.post("my-stream", { type: "test", data: "Hello!" })
await worker.set("key", "value")
const value = await worker.get("key")
```

### Importing Connectors

You can import only the connector you need:

#### Server Connector

```ts
import { startFrontendWebSocketConnector } from "redis-process-worker/server"
```

#### Client Connector

```ts
import { FrontendWebSocketConnectorClient } from "redis-process-worker/client"
```

#### Message Types

```ts
import { type MsgType } from "redis-process-worker/msgtype"
```

## License

MIT

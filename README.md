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

This package provides several utilities for working with Redis streams, cache, logging, and background workers. See the [examples](./examples/) directory for more advanced usage and worker implementations.

## Components

| File                   | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `ActionRepo`           | Utilities for managing and storing actions in Redis.                    |
| `LogRepo`              | Utilities for logging and retrieving logs from Redis.                   |
| `RedisHub`             | Redis stream and cache abstraction, core Redis logic.                   |
| `RedisHubSocket`       | WebSocket server for stream and cache communication.                    |
| `RedisHubSocketClient` | WebSocket client for connecting to the RedisHubSocket server.           |
| `RedisRepo`            | Low-level Redis repository utilities.                                   |
| `WorkerRepo`           | Background worker logic using ProcessWorker for stream and cache tasks. |

### Action

The **Action** system provides utilities for managing and storing actions in Redis. It enables workers to dispatch, track, and process actions across distributed systems, ensuring reliable and decoupled task execution.

### Log

The **Log** system provides utilities for logging and retrieving logs from Redis. It allows workers and other components to write log messages to a global logging stream, which can be monitored or queried for debugging and auditing purposes.

### RedisHub

**RedisHub** is the core abstraction for Redis streams and cache. It manages the low-level communication with Redis, handling stream subscriptions, message delivery, and cache operations. It serves as the backbone for all stream and cache interactions in the system.

### RedisRepo

**RedisRepo** contains low-level repository utilities for interacting directly with Redis. It provides foundational methods for connecting, reading, writing, and managing data in Redis, supporting higher-level abstractions like RedisHub and ActionRepo.

### Worker

A **Worker** is a background process that uses the `ProcessWorker` class to listen to streams, post messages, and interact with the global cache. Workers can be used for various tasks such as running servers, file watchers, or any background job that requires inter-process communication.

## Examples by Component

### ActionRepo Example

```typescript
const repo = await ActionRepo.createRepo()
const action = repo.create({
  name: "test-action",
  arg: { foo: "bar" },
})
console.log(action)
```

### LogRepo Example

```typescript
const repo = await LogRepo.createRepo()
// add log
await repo.log("This is a log message")
await repo.log("This is a log message", "debug")
// or
await repo.saveLog({
  id: "log-1",
  type: "log",
  level: "info",
  message: "This is a log message",
  timestamp: Date.now(),
})
```

### RedisHub Example

```typescript
const hub = await RedisHub.createHub()
console.log(hub)
```

### RedisHubSocket Example

```typescript
const socketServer = await RedisHubSocket.createHub()
console.log(socketServer)
```

### RedisHubSocketClient Example

```typescript
const url = "ws://localhost:6379"
const client = await RedisHubSocketClient.connect(url)
console.log(client)
```

### RedisRepo Example

```typescript
const repo = await RedisRepo.createRepo()
console.log(repo)
```

### WorkerRepo Example

```typescript
const repo = await WorkerRepo.createRepo()
console.log(repo)
```

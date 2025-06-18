# Workspace Overview

# Main Packages & Structure

- `src/`: Main source code for the project - with the primary file being the ProcessWorker class. It also contains common workers and utilities.
- `src/tests/`: Tests for the project and its components (Tests for the ProcessWorker class and other system components)
- `src/documentation/`: Documentation for the project, including rules and structure
- `src/examples/`: Example files using the ProcessWorker class in workers
- `src/common-workers/`: Common worker files that can be used in multiple projects, such as a server worker, websocket server or client, file watcher, etc.
- `src/dev-workers/`: Background worker files, use in development of this project.

### File Structure

| File/Folder         | Purpose                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| src/                | Main source code for the project (ProcessWorker class, common workers, utilities)                            |
| src/tests/          | Tests for the project and its components                                                                     |
| src/documentation/  | Documentation for the project, including rules and structure                                                 |
| src/examples/       | Example files using the ProcessWorker class in workers                                                       |
| src/common-workers/ | Common worker files usable in multiple projects (server worker, websocket server/client, file watcher, etc.) |
| src/dev-workers/    | Background worker files for development of this project                                                      |

## System Types

- **Documentation**: Project documentation, structure, and rules (Docs package)
- **Test**: Bun tests for actions (Actions package)
- **Worker**: Worker files placed in a new package under packages/workers. A worker file uses an instance of the ProcessWorker class to listen to relevant streams, post to streams, and log messages.
- **Rule**: A rule declaration in the instructions. When a prompt says "add rule", it means a new rule must be added in the instruction file, following the instructions in the prompt.
- **SystemType**: A reference to a system type defined in the instructions. When adding or updating a rule or a system type, all changes are done in the instruction file.

### System Types Description

- **Process Worker**: Represents the ProcessWorker class, which is the main class for handling background tasks and streams.
- **Worker**: Represents a background worker. A worker file uses an instance of the ProcessWorker class to listen to relevant streams, post to streams, and log messages. It can be used as a runner for a server, websocket swerver or client, file watcher, or any other background task that needs to listen to streams and post messages.
- **Docs**: Represents documentation files, including the main instruction file and any additional documentation files
- **Test**: Represents test files for system component. Each test file must follow the Bun test framework conventions.
- **Rule**: Represents a rule declaration in the instructions. When a prompt says "add rule", it means a new rule must be added in the instruction file, following the instructions in the prompt.
- **SystemType**: Represents a reference to a system type defined in the instructions. When adding or updating a rule or a system type, all changes are done in the instruction file.

### System Types Aliases

Each element can be referenced by its alias in prompts:

- **Process Worker**: `process-worker`, `worker-class`
- **Worker**: `worker`
- **Docs**: `doc`, `docs`, `documentation`
- **Test**: `test`, `tests`
- **Rule**: `rule`, `rules`
- **SystemType**: `systemtype`, `system-types`, `system-type`

---

# Prompt Interaction & Rules

## Prompt Shortcuts

- Use: `add docs:`, `add test:`, `add worker:`, `add rule:`, `add systemtype:`
- Prompts like `update docs:`, `modify docss:`, etc. update existing elements and must follow all rules for that element.

## Prompt Handling

- Always ensure all parts of an element are created/updated (e.g., for a docs, tests, worker, etc.)
- If a prompt asks for a new element, create all required files and folders as specified in the relevant section.
- If a prompt asks to update an existing element, ensure all files are updated according to the rules and structure defined in this document.
- If a prompt asks to add a new rule or system type, follow the instructions in the prompt and add it to the instruction file.
- If a prompt asks to modify an existing rule or system type, ensure all changes are made in the instruction file and follow the rules defined in this document.
- If a rule is missing, follow best practices for the stack being used (e.g., TypeScript, Bun, NodeJs)

---

# The ProcessWorker Class

## ProcessWorker Class Overview

The `ProcessWorker` class is a helper class for creating workers.
It provides a simple interface for creating workers that can listen to streams, post messages, and log messages.
It provides a simple interface for decoupling the worker logic from the stream handling logic, and enable decouped communication between the worker and other processes.
It provides a "global" cache table (using a redis cache) for storing data that can be accessed by all workers, and a "global" stream for posting messages that can be listened to by all workers.

## ProcessWorker Code and Structure

The `ProcessWorker` class is placed in the `src/ProcessWorker.ts` file.

It provides simple methods for creating and initialize workers that can listen to streams, post messages, and log messages and use the global cache and stream.

```typescript
import ProcessWorker from "process-worker"
const w = await ProcessWorker.start({
  workerName: "example-worker",
  // other worker settings here...
})
```

### ProcessWorker Class Features

- **Listen to Streams**: Workers can listen to specific streams and handle incoming messages.
- **Post Messages**: Workers can post messages to streams, allowing communication with other workers or processes.
- **Log Messages**: Workers can log messages to a global logging stream, which can be monitored by other processes or workers.
- **Global Cache**: Workers can access a global cache table for storing and retrieving data, which is shared across all workers.
- **Global Stream**: Workers can post messages to a global stream, which can be listened to by other workers or processes.

#### Method `on`

The `on` method allows the worker to listen to a specific stream and handle incoming messages. It takes a stream name and a callback function that will be called with the message data.

```typescript
w.on("example-stream", msg => {
  console.log("Received message:", msg)
})
```

#### Method `post`

The `post` method allows the worker to post a message to a specific stream. It takes a stream name and the message data to be posted.

```typescript
w.post("example-stream", { type: "example", data: "Hello, World!" })
```

#### Method `log`

The `log` method allows the worker to log a message to the global logging stream. It takes a message string and posts it to the global logging stream.

```typescript
w.log("This is a log message")
```

#### Method `get`

The `get` method allows the worker to retrieve data from the global cache table. It takes a key and returns the value associated with that key.

```typescript
const value = await w.get("example-key")
console.log("Retrieved value:", value)
```

#### Method `set`

The `set` method allows the worker to store data in the global cache table. It takes a key and a value, and stores the value under the specified key.

```typescript
await w.set("example-key", "example-value")
```

# Project Structure and Rules

## General File Rules

**General: Naming Conventions**

- Folder names must use lowercasing and kebab-case (e.g., `my-folder`).
- Files containing a class must use PascalCase (e.g., `MyClass.ts`).
- Other files should use kebab-case (e.g., `my-file.ts`).

**General: No Extra Files**

- No unused or extra files should be created.

**General: Completeness**

- All required files for an element (worker, test, util, etc.) must be present and up to date after any add or update prompt.

# Tests

All tests must follow the Bun test framework conventions.

example test file:

```typescript
import { describe, it, expect } from "bun:test"
import ProcessWorker from "../src/ProcessWorker"

describe("Test listen", () => {
  it("should start a worker and listen to a stream", async () => {
    const worker1 = await ProcessWorker.start("worker-1")
    const worker2 = await ProcessWorker.start("worker-2")
    const got = []
    worker1.listen("test-stream", msg => {
      got.push(msg)
    })
    worker2.post("test-stream", { type: "test", data: "Hello, World!" })
    await new Promise(resolve => setTimeout(resolve, 100)) // wait for message to be processed
    expect(got).toEqual([{ type: "test", data: "Hello, World!" }])
    worker1.stop()
    worker2.stop()
  })
})
```

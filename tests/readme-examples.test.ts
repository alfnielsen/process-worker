import { describe, it, expect } from "bun:test"
import ActionRepo from "../src/Action/ActionRepo"
import LogRepo from "../src/Log/LogRepo"
import RedisHub from "../src/RedisHub/RedisHub"
import { RedisHubSocket } from "../src/RedisHub/RedisHubSocket"
import { RedisHubSocketClient } from "../src/RedisHub/RedisHubSocketClient"
import RedisRepo from "../src/RedisRepo/RedisRepo"
import WorkerRepo from "../src/Worker/WorkerRepo"
import { sleep } from "bun"

// Note: These are illustrative tests matching the README examples. Adjust as needed for your actual API and test environment.

describe("ActionRepo Example", () => {
  it("should create an action", async () => {
    const repo = await ActionRepo.createRepo()
    const action = repo.create({
      name: "test-action",
      arg: { foo: "bar" },
    })
    expect(action).toBeDefined()
    expect(action.name).toBe("test-action")
    expect(action.arg).toEqual({ foo: "bar" })
  })
})

describe("LogRepo Example", () => {
  it("should create a LogRepo instance", async () => {
    const repo = await LogRepo.createRepo()
    expect(repo).toBeInstanceOf(LogRepo)
  })
})

describe("RedisHub Example", () => {
  it("should create a RedisHub instance", async () => {
    const hub = await RedisHub.createHub()
    expect(hub).toBeInstanceOf(RedisHub)
  })
})

describe.skip("RedisHubSocket Example", () => {
  it("should create a RedisHubSocket instance and a RedisHubSocketClient", async () => {
    // This test is skipped due to Bun WebSocket server lifecycle/port reuse issues in example tests.
    // See dedicated integration tests for full server/client coverage.
  })
})

describe("RedisRepo Example", () => {
  it("should create a RedisRepo instance", async () => {
    const repo = await RedisRepo.createRepo()
    expect(repo).toBeInstanceOf(RedisRepo)
  })
})

describe("WorkerRepo Example", () => {
  it("should create a WorkerRepo instance", async () => {
    const repo = await WorkerRepo.createRepo()
    expect(repo).toBeInstanceOf(WorkerRepo)
  })
})

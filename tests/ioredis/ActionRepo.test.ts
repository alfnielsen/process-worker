import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test"
import { sleep } from "bun"
import ActionRepo, { ActionRequest, type IActionObjectAny } from "../../src/ActionRepo"

const repo = ActionRepo.createRepo({
  prefix: "__test__action-repo__",
})
const otherRepo = ActionRepo.createRepo({
  prefix: "__test__action-repo__",
})

const waitForRedisReady = async (repo: ActionRepo) => {
  // Wait for the Redis connection to be ready
  let ready = false
  for (let i = 0; i < 20 && !ready; i++) {
    try {
      await repo.hub.redis.ping()
      ready = true
    } catch (e) {
      await sleep(100)
    }
  }
  if (!ready) throw new Error("Redis connection not ready")
}

describe("ActionHub", () => {
  beforeAll(async () => {
    await waitForRedisReady(repo)
    await waitForRedisReady(otherRepo)
  })
  afterAll(async () => {
    //await ActionRepo.hub.delKeys(`${ActionRepo.hub.prefix}*`, true)
  })
  it("should post and listen to a stream", async () => {   
    const actId = crypto.randomUUID() as string
    const act = repo.create({
      id: actId,
      name: "test-action",
      arg: { foo: "bar" },
    })
    console.log("[DEBUG] Created action:", act)
    await act.start()
    console.log("[DEBUG] Action started and saved.")
    const got = []
    console.log(`[MAIN] Listening...`)
    act.listen((event) => {
      expect(event).toHaveProperty("id")
      expect(event).toHaveProperty("type")
      console.log("[MAIN] √ ", event)
      got.push(event)
    })
    // Wait for the action to be available in Redis
    let _act1: ActionRequest | undefined = undefined
    const storeKey = repo.getActionStoreKey(actId)
    const rawRepoVal = await repo.hub.redis.get(storeKey)
    const rawOtherRepoVal = await otherRepo.hub.redis.get(storeKey)
    console.log(`[DEBUG] Direct redis.get from repo:`, rawRepoVal)
    console.log(`[DEBUG] Direct redis.get from otherRepo:`, rawOtherRepoVal)
    for (let i = 0; i < 10; i++) {
      _act1 = await otherRepo.loadAction(actId) as ActionRequest
      console.log(`[DEBUG] Attempt ${i + 1}: Loaded action:`, _act1)
      if (_act1) break
      await sleep(100)
    }
    console.log("[DEBUG] Loaded action (final):", _act1)
    expect(_act1).toBeDefined()
    expect(_act1?.id).toBe(actId)
    expect(_act1?.name).toBe("test-action")
    expect(_act1?.arg).toEqual({ foo: "bar" })
    // Listen to the action
    const events: any[] = []
    console.log(`[OTHER] Listening...`)
    _act1!.listen((event) => {
      expect(event).toHaveProperty("id")
      expect(event).toHaveProperty("type")
      events.push(event)
      console.log("[OTHER] √ ", event)
    })
    
    await sleep(1000) // Wait for the action to start
    // Trigger an event (e.g., setData)
    console.log("[DEBUG] Setting data from other...")
    await _act1!.setData({ foo: "bar from other" }, true)
    await sleep(100) // Wait for the action to start
    const da = await act.getData()
    console.log("[DEBUG] act.getData():", da)
    expect(da).toEqual({ foo: "bar from other" })
    console.log("[DEBUG] Events received:", events)
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toHaveProperty("id")
    expect(events[0]).toHaveProperty("type")
    expect(events[0].type).toBe("data")

  })


  it("Listener for action request queue should work", async () => {    
    // listen to the request queue
    const got: IActionObjectAny[] = []
    // Use the same repo instance for both creating and listening
    const sharedRepo = ActionRepo.createRepo({ prefix: "__test__action-repo__" })
    sharedRepo.listenToRequestQueue((actObj) => {
      expect(actObj).toHaveProperty("id")
      expect(actObj).toHaveProperty("name")
      console.log("[REQUEST QUEUE] Action event received:", actObj)
      got.push(actObj)
    })
    await sleep(100) // Wait for the action to start
    
    // add a new action
    const actId = crypto.randomUUID() as string
    // console.log("Action ID:", actId)
    const act = sharedRepo.create({
      id: actId,
      name: "test-action",
      arg: { foo: "bar" },
    })
    console.log("[DEBUG] Created action for request queue:", act)
    await act.start() // This will trigger the listener for the request queue
    console.log("[DEBUG] Action started for request queue.")
    // Wait for the request queue event to be received
    for (let i = 0; i < 10 && got.length === 0; i++) {
      console.log(`[DEBUG] Waiting for request queue event, got.length = ${got.length}`)
      await sleep(100)
    }
    console.log("[DEBUG] Final got array:", got)
    expect(got.length).toBeGreaterThan(0)
    const firstId = got[0] as ActionRequest
    expect(firstId).toHaveProperty("id")
    expect(firstId).toHaveProperty("name")
    expect(firstId.id).toBe(actId)
    expect(firstId.name).toBe("test-action")

  })

})

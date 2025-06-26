import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test"
import { sleep } from "bun"
import ActionRepo, { ActionRequest, type IActionObjectAny } from "../../src/ActionRepo"

const repo = ActionRepo.createRepo({
  prefix: "__test__action-repo__",
})
const otherRepo = ActionRepo.createRepo({
  prefix: "__test__action-repo__",
})

describe("ActionHub", () => {
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
    await act.start()
    const got = []
    console.log(`[MAIN] Listening...`)
    act.listen((event) => {
      expect(event).toHaveProperty("id")
      expect(event).toHaveProperty("type")
      console.log("[MAIN] √ ")
      // console.log("[MAIN] Action event received:", event)
      got.push(event)
    })

    // Other actor
    const _act1 = await otherRepo.loadAction(actId) as ActionRequest
    
    expect(_act1).toBeDefined()
    expect(_act1?.id).toBe(actId)
    expect(_act1?.name).toBe("test-action")
    expect(_act1?.arg).toEqual({ foo: "bar" })
    // Listen to the action
    const events: any[] = []
    console.log(`[OTHER] Listening...`)
    _act1.listen((event) => {
      expect(event).toHaveProperty("id")
      expect(event).toHaveProperty("type")
      events.push(event)
      // console.log("[OTHER] Action event received:", event)
      console.log("[OTHER] √ ")
    })
    await sleep(100) // Wait for the action to start
    // Trigger an event (e.g., setData)
    await _act1.setData({ foo: "bar from other" }, true)

    await sleep(100) // Wait for the action to start
    const da = await act.getData()
    expect(da).toEqual({ foo: "bar from other" })
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toHaveProperty("id")
    expect(events[0]).toHaveProperty("type")
    expect(events[0].type).toBe("data")

  })


  it("Listener for action request queue should work", async () => {    
    // listen to the request queue
    const got: IActionObjectAny[] = []
    repo.listenToRequestQueue((actObj) => {
      expect(actObj).toHaveProperty("id")
      expect(actObj).toHaveProperty("name")
      console.log("[REQUEST QUEUE] Action event received:", actObj)
      got.push(actObj)
    })
    await sleep(100) // Wait for the action to start
    
    // add a new action
    const actId = crypto.randomUUID() as string
    // console.log("Action ID:", actId)
    const act = repo.create({
      id: actId,
      name: "test-action",
      arg: { foo: "bar" },
    })
    await act.start() // This will trigger the listener for the request queue
    await sleep(100) // Wait for the action to start
    expect(got.length).toBeGreaterThan(0)
    const firstId = got[0] as ActionRequest
    expect(firstId).toHaveProperty("id")
    expect(firstId).toHaveProperty("name")
    expect(firstId.id).toBe(actId)
    expect(firstId.name).toBe("test-action")

  })

})

// Test suite for the Data class, covering main data, subkeys, events, and dynamic refs
import { describe, it, expect } from "bun:test"
import { Data } from "../src/Data/DataRepo"

describe("Data", () => {
  it("should create, set/get main data, publish/listen, and get/set subkeys", async () => {
    const data = await Data.get<{ foo?: string; count?: number }>({ name: "test-data", prefix: "__test__" })

    // Test set/get main data
    await data.setData({ foo: "bar", count: 1 })

    const mainData = await data.getData()
    expect(mainData.foo).toBe("bar")
    expect(mainData.count).toBe(1)

    // Test get/set subkey
    await data.set("subkey", { value: 42 })
    const sub = await data.get<{ value: number }>("subkey")
    expect(sub?.value).toBe(42)

    // Test publish/listen
    let received: any = null
    await data.listen<{ message: string }>(msg => {
      received = msg
    })
    await data.publish({ type: "test-event", data: { message: "Hello, Data!" } })
    await new Promise(res => setTimeout(res, 100))
    expect(received).toEqual({ message: "Hello, Data!" })

    // Test type() dynamic ref
    const subrepo = data.subType("pages")
    await subrepo.setData({ foo: "baz", count: 2 })
    const subMain = await subrepo.getData()
    expect(subMain.foo).toBe("baz")
    expect(subMain.count).toBe(2)
  })

  it("should have correct storeKey and event stream names", async () => {
    const repo = await Data.get({ name: "test-data2", prefix: "__test2__" })
    expect(repo.storeKey).toBe("__test2__:data:test-data2")
    expect(repo.queueKey).toBe("__test2__:dataQueue:test-data2")
    const eventStream = `${repo.storeKey}:events`
    expect(eventStream).toBe("__test2__:data:test-data2:events")
    const subkey = `${repo.storeKey}:subkey`;
    expect(subkey).toBe("__test2__:data:test-data2:subkey")
  })
})

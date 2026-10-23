/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it, vi } from "vitest"

import type { WidgetStateManager } from "~lib/WidgetStateManager"

import { getSharedChannel, makeScopedChannelHandle } from "./sharedChannels"

let nextName = 0
const uniqueName = (): string => `channel-${nextName++}`

const mockWidgetMgr = (): {
  widgetMgr: WidgetStateManager
  setJsonValue: ReturnType<typeof vi.fn>
} => {
  const setJsonValue = vi.fn()
  return {
    widgetMgr: { setJsonValue } as unknown as WidgetStateManager,
    setJsonValue,
  }
}

describe("shared channels", () => {
  it("shares values between handles with the same name", () => {
    const name = uniqueName()
    const a = makeScopedChannelHandle(name, new Set())
    const b = makeScopedChannelHandle(name, new Set())
    const listener = vi.fn()
    b.subscribe(listener)

    a.set("hover", "EUROPE")

    expect(b.get("hover")).toBe("EUROPE")
    expect(listener).toHaveBeenCalledWith(["hover"])
  })

  it("keeps browser-only values out of Python", () => {
    const channel = getSharedChannel(uniqueName())
    const { widgetMgr, setJsonValue } = mockWidgetMgr()
    channel.bind({
      id: "w",
      formId: undefined,
      fragmentId: undefined,
      widgetMgr,
    })

    channel.set("hover", 1)

    expect(setJsonValue).not.toHaveBeenCalled()
  })

  it.each([
    ["defer", false],
    ["rerun", true],
  ] as const)(
    "sends synced keys with python: %s (triggerRerun %s)",
    (python, triggerRerun) => {
      const channel = getSharedChannel(uniqueName())
      const { widgetMgr, setJsonValue } = mockWidgetMgr()
      channel.bind({ id: "w", formId: "", fragmentId: "frag", widgetMgr })

      channel.set("hover", 1)
      channel.set("filters", { region: "ASIA" }, { python })

      expect(setJsonValue).toHaveBeenCalledTimes(1)
      expect(setJsonValue).toHaveBeenCalledWith(
        "w",
        { filters: { region: "ASIA" } },
        { formId: "", fragmentId: "frag", fromUser: true, triggerRerun }
      )
    }
  )

  it("holds synced writes until the channel is bound, keeping the strongest mode", () => {
    const channel = getSharedChannel(uniqueName())
    const { widgetMgr, setJsonValue } = mockWidgetMgr()

    channel.set("a", 1, { python: "rerun" })
    channel.set("b", 2, { python: "defer" })
    channel.bind({
      id: "w",
      formId: undefined,
      fragmentId: undefined,
      widgetMgr,
    })

    expect(setJsonValue).toHaveBeenCalledTimes(1)
    expect(setJsonValue).toHaveBeenCalledWith(
      "w",
      { a: 1, b: 2 },
      expect.objectContaining({ triggerRerun: true })
    )
  })

  it("seeds values from Python without sending them back", () => {
    const channel = getSharedChannel(uniqueName())
    const { widgetMgr, setJsonValue } = mockWidgetMgr()
    channel.bind({
      id: "w",
      formId: undefined,
      fragmentId: undefined,
      widgetMgr,
    })
    const listener = vi.fn()
    channel.subscribe(listener)

    channel.seed({ cube: [1, 2] })

    expect(channel.get("cube")).toEqual([1, 2])
    expect(listener).toHaveBeenCalledWith(["cube"])
    expect(setJsonValue).not.toHaveBeenCalled()
  })

  it("ignores unbind from an element that no longer owns the channel", () => {
    const channel = getSharedChannel(uniqueName())
    const first = mockWidgetMgr()
    const second = mockWidgetMgr()
    channel.bind({
      id: "old",
      formId: undefined,
      fragmentId: undefined,
      widgetMgr: first.widgetMgr,
    })
    channel.bind({
      id: "new",
      formId: undefined,
      fragmentId: undefined,
      widgetMgr: second.widgetMgr,
    })
    channel.unbind("old")

    channel.set("a", 1, { python: "defer" })

    expect(first.setJsonValue).not.toHaveBeenCalled()
    expect(second.setJsonValue).toHaveBeenCalledTimes(1)
  })

  it("releases subscriptions owned by a component instance", () => {
    const name = uniqueName()
    const owned = new Set<() => void>()
    const handle = makeScopedChannelHandle(name, owned)
    const listener = vi.fn()
    handle.subscribe(listener)
    expect(owned.size).toBe(1)

    for (const release of owned) release()
    getSharedChannel(name).set("a", 1)

    expect(listener).not.toHaveBeenCalled()
    expect(owned.size).toBe(0)
  })
})

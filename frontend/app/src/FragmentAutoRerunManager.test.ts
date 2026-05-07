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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FragmentAutoRerunManager } from "./FragmentAutoRerunManager"

describe("FragmentAutoRerunManager", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(global, "clearInterval")
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("schedules fragment auto reruns", () => {
    const onTick = vi.fn()
    const manager = new FragmentAutoRerunManager({ onTick })

    manager.schedule("fragment-a", 1)

    expect(manager.hasActiveAutoReruns()).toBe(true)

    vi.advanceTimersByTime(1000)

    expect(onTick).toHaveBeenCalledWith("fragment-a")
  })

  it("replaces the existing timer for the same fragment id", () => {
    const onTick = vi.fn()
    const manager = new FragmentAutoRerunManager({ onTick })

    manager.schedule("fragment-a", 1)
    manager.schedule("fragment-a", 2)

    expect(clearInterval).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)

    expect(onTick).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(onTick).toHaveBeenCalledTimes(1)
    expect(onTick).toHaveBeenCalledWith("fragment-a")
  })

  it("prunes timers whose fragment ids are no longer active", () => {
    const onTick = vi.fn()
    const manager = new FragmentAutoRerunManager({ onTick })

    manager.schedule("live-fragment", 1)
    manager.schedule("stale-fragment", 1)

    manager.pruneInactive(new Set(["live-fragment"]))

    expect(clearInterval).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)

    expect(onTick).toHaveBeenCalledTimes(1)
    expect(onTick).toHaveBeenCalledWith("live-fragment")
  })

  it("clears all timers on cleanup", () => {
    const onTick = vi.fn()
    const manager = new FragmentAutoRerunManager({ onTick })

    manager.schedule("fragment-a", 1)
    manager.schedule("fragment-b", 1)

    manager.clearAll()

    expect(clearInterval).toHaveBeenCalledTimes(2)
    expect(manager.hasActiveAutoReruns()).toBe(false)

    vi.advanceTimersByTime(1000)

    expect(onTick).not.toHaveBeenCalled()
  })
})

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

import type { ReactNode } from "react"

import { renderHook } from "@testing-library/react"

import { ElementTimingContext } from "~lib/components/core/RenderTimingContext"
import {
  type ElementLoadKind,
  type ElementTimingHandle,
  RenderTimingTracker,
} from "~lib/util/performance/RenderTimingTracker"

import {
  useElementLoadCallback,
  useElementLoadState,
} from "./useElementLoadState"

describe("useElementLoadState", () => {
  let tracker: RenderTimingTracker

  beforeEach(() => {
    tracker = new RenderTimingTracker({ onReport: vi.fn() })
  })

  afterEach(() => {
    tracker.dispose()
  })

  const createHandle = (): ElementTimingHandle => {
    const handle = tracker.createElementHandle()
    vi.spyOn(handle, "setLoading")
    return handle
  }

  const renderWithHandle = (
    handle: ElementTimingHandle | null,
    initialProps: { kind: ElementLoadKind; isLoaded: boolean }
  ): ReturnType<
    typeof renderHook<void, { kind: ElementLoadKind; isLoaded: boolean }>
  > =>
    renderHook(({ kind, isLoaded }) => useElementLoadState(kind, isLoaded), {
      initialProps,
      wrapper: ({ children }: { children: ReactNode }) => (
        <ElementTimingContext.Provider value={handle}>
          {children}
        </ElementTimingContext.Provider>
      ),
    })

  it("does nothing outside a measured element", () => {
    expect(() =>
      renderWithHandle(null, { kind: "draw", isLoaded: false })
    ).not.toThrow()
  })

  it("reports pending work until the element is loaded", () => {
    const handle = createHandle()
    const { rerender } = renderWithHandle(handle, {
      kind: "media",
      isLoaded: false,
    })

    expect(handle.setLoading).toHaveBeenCalledTimes(1)
    expect(handle.setLoading).toHaveBeenLastCalledWith(
      expect.any(String),
      "media",
      true
    )
    expect(handle.loadingSlots.size).toBe(1)

    rerender({ kind: "media", isLoaded: true })

    expect(handle.setLoading).toHaveBeenCalledTimes(2)
    expect(handle.setLoading).toHaveBeenLastCalledWith(
      expect.any(String),
      "media",
      false
    )
    expect(handle.loadingSlots.size).toBe(0)
  })

  it("doesn't report work for content that's already loaded", () => {
    const handle = createHandle()
    renderWithHandle(handle, { kind: "draw", isLoaded: true })

    expect(handle.setLoading).not.toHaveBeenCalled()
  })

  it("clears pending work when the element unmounts", () => {
    const handle = createHandle()
    const { unmount } = renderWithHandle(handle, {
      kind: "draw",
      isLoaded: false,
    })

    unmount()

    expect(handle.loadingSlots.size).toBe(0)
  })

  it("tracks each pending piece of work separately", () => {
    const handle = createHandle()
    renderWithHandle(handle, { kind: "draw", isLoaded: false })
    renderWithHandle(handle, { kind: "media", isLoaded: false })

    expect(new Set(handle.loadingSlots.values())).toEqual(
      new Set(["draw", "media"])
    )
  })
})

describe("useElementLoadCallback", () => {
  let tracker: RenderTimingTracker

  beforeEach(() => {
    tracker = new RenderTimingTracker({ onReport: vi.fn() })
  })

  afterEach(() => {
    tracker.dispose()
  })

  const renderWithHandle = (
    handle: ElementTimingHandle | null,
    workKey: unknown
  ): ReturnType<typeof renderHook<() => void, { workKey: unknown }>> =>
    renderHook(({ workKey }) => useElementLoadCallback("media", workKey), {
      initialProps: { workKey },
      wrapper: ({ children }: { children: ReactNode }) => (
        <ElementTimingContext.Provider value={handle}>
          {children}
        </ElementTimingContext.Provider>
      ),
    })

  it("returns a callback that does nothing outside a measured element", () => {
    const { result } = renderWithHandle(null, "image.png")

    expect(() => result.current()).not.toThrow()
  })

  it("reports the work as pending until the callback is called", () => {
    const handle = tracker.createElementHandle()
    const { result, rerender } = renderWithHandle(handle, "a.png")

    expect([...handle.loadingSlots.values()]).toEqual(["media"])

    result.current()

    expect(handle.loadingSlots.size).toBe(0)

    rerender({ workKey: "a.png" })

    expect(handle.loadingSlots.size).toBe(0)
  })

  it("reports new work when the work key changes", () => {
    const handle = tracker.createElementHandle()
    const { result, rerender } = renderWithHandle(handle, "a.png")
    result.current()

    rerender({ workKey: "b.png" })

    expect(handle.loadingSlots.size).toBe(1)
  })

  it("doesn't report work for a null work key", () => {
    const handle = tracker.createElementHandle()
    renderWithHandle(handle, null)

    expect(handle.loadingSlots.size).toBe(0)
  })

  it("clears pending work when the element unmounts", () => {
    const handle = tracker.createElementHandle()
    const { unmount } = renderWithHandle(handle, "a.png")

    unmount()

    expect(handle.loadingSlots.size).toBe(0)
  })
})

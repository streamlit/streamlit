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

import type { ReactElement, ReactNode } from "react"

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

let tracker: RenderTimingTracker

beforeEach(() => {
  tracker = new RenderTimingTracker({ onReport: vi.fn() })
})

afterEach(() => {
  tracker.dispose()
})

const createWrapper =
  (handle: ElementTimingHandle | null) =>
  ({ children }: { children: ReactNode }): ReactElement => (
    <ElementTimingContext.Provider value={handle}>
      {children}
    </ElementTimingContext.Provider>
  )

describe("useElementLoadState", () => {
  const renderWithHandle = (
    handle: ElementTimingHandle,
    initialProps: { kind: ElementLoadKind; isLoaded: boolean }
  ): ReturnType<
    typeof renderHook<void, { kind: ElementLoadKind; isLoaded: boolean }>
  > =>
    renderHook(({ kind, isLoaded }) => useElementLoadState(kind, isLoaded), {
      initialProps,
      wrapper: createWrapper(handle),
    })

  it("reports pending work until the element is loaded", () => {
    const handle = tracker.createElementHandle()
    const { rerender } = renderWithHandle(handle, {
      kind: "media",
      isLoaded: false,
    })

    expect([...handle.loadingSlots.values()]).toEqual(["media"])

    rerender({ kind: "media", isLoaded: true })

    expect(handle.loadingSlots.size).toBe(0)
  })

  it("tracks each pending piece of work separately", () => {
    const handle = tracker.createElementHandle()
    renderWithHandle(handle, { kind: "draw", isLoaded: false })
    renderWithHandle(handle, { kind: "media", isLoaded: false })

    expect(new Set(handle.loadingSlots.values())).toEqual(
      new Set(["draw", "media"])
    )
  })
})

describe("useElementLoadCallback", () => {
  const renderWithHandle = (
    handle: ElementTimingHandle | null,
    workKey: unknown
  ): ReturnType<typeof renderHook<() => void, { workKey: unknown }>> =>
    renderHook(({ workKey }) => useElementLoadCallback("media", workKey), {
      initialProps: { workKey },
      wrapper: createWrapper(handle),
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

  it("tracks a new work key, ignoring the completion of the work it replaced", () => {
    const handle = tracker.createElementHandle()
    const { result, rerender } = renderWithHandle(handle, "a.png")
    const markOldWorkLoaded = result.current

    rerender({ workKey: "b.png" })
    markOldWorkLoaded()

    expect(handle.loadingSlots.size).toBe(1)

    result.current()

    expect(handle.loadingSlots.size).toBe(0)
  })

  it.each([null, undefined])(
    "doesn't report work for a %s work key",
    workKey => {
      const handle = tracker.createElementHandle()
      renderWithHandle(handle, workKey)

      expect(handle.loadingSlots.size).toBe(0)
    }
  )

  it("clears pending work when the element unmounts", () => {
    const handle = tracker.createElementHandle()
    const { unmount } = renderWithHandle(handle, "a.png")

    unmount()

    expect(handle.loadingSlots.size).toBe(0)
  })
})

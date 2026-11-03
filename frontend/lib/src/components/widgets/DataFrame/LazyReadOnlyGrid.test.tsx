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

import { act, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Quiver } from "~lib/dataframes/Quiver"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import type * as LazyReadOnlyGridModule from "./LazyReadOnlyGrid"
import type { ReadOnlyGridProps } from "./ReadOnlyGrid"

/**
 * State of the mocked grid module, which finishes loading once a test calls
 * `release()`, or fails with the error passed to `fail()`.
 */
const gridModule = {
  loads: 0,
  release: (): void => {},
  fail: (_error: Error): void => {},
  lastProps: undefined as ReadOnlyGridProps | undefined,
}

const fakeQuiver = {} as unknown as Quiver // ReadOnlyGrid is mocked; the value isn't used

describe("LazyReadOnlyGrid", () => {
  let lazyModule: typeof LazyReadOnlyGridModule

  beforeEach(async () => {
    // Fresh modules give each test a lazy component and a grid module that
    // haven't loaded yet.
    vi.resetModules()
    gridModule.loads = 0
    gridModule.lastProps = undefined
    vi.doMock("./ReadOnlyGrid", async () => {
      gridModule.loads += 1
      await new Promise<void>((resolve, reject) => {
        gridModule.release = resolve
        gridModule.fail = reject
      })
      return {
        ReadOnlyGrid: (props: ReadOnlyGridProps) => {
          gridModule.lastProps = props
          return <div data-testid="mockReadOnlyGrid" />
        },
      }
    })
    lazyModule = await import("./LazyReadOnlyGrid")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ["a pixel height", 300, "300px"],
    ["no height", undefined, mockTheme.emotion.sizes.minElementHeight],
  ])(
    "holds %s with a skeleton until the grid loads",
    async (_, height, skeletonHeight) => {
      const { LazyReadOnlyGrid } = lazyModule
      render(
        <LazyReadOnlyGrid data={fakeQuiver} height={height} alt="Sales" />
      )

      const skeleton = screen.getByTestId("stSkeleton")
      expect(skeleton).toHaveStyle({ height: skeletonHeight })
      expect(skeleton).toHaveAttribute("aria-hidden", "true")
      expect(screen.queryByTestId("mockReadOnlyGrid")).not.toBeInTheDocument()

      await vi.waitFor(() => expect(gridModule.loads).toBe(1))
      act(() => {
        gridModule.release()
      })

      expect(await screen.findByTestId("mockReadOnlyGrid")).toBeVisible()
      expect(screen.queryByTestId("stSkeleton")).not.toBeInTheDocument()
      expect(gridModule.lastProps).toEqual({
        data: fakeQuiver,
        height,
        alt: "Sales",
      })
    }
  )

  it("renders the preloaded grid module and reopens without a skeleton", async () => {
    const { LazyReadOnlyGrid, preloadReadOnlyGrid } = lazyModule

    preloadReadOnlyGrid()
    await vi.waitFor(() => expect(gridModule.loads).toBe(1))
    gridModule.release()

    const { unmount } = render(<LazyReadOnlyGrid data={fakeQuiver} />)
    expect(await screen.findByTestId("mockReadOnlyGrid")).toBeVisible()
    expect(gridModule.loads).toBe(1)

    unmount()
    render(<LazyReadOnlyGrid data={fakeQuiver} />)

    // The lazy component stays resolved, so it renders without suspending.
    expect(screen.getByTestId("mockReadOnlyGrid")).toBeVisible()
    expect(screen.queryByTestId("stSkeleton")).not.toBeInTheDocument()
  })

  it("shows a failed chunk load in place of the grid", async () => {
    // React and the error boundary log the expected error.
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { LazyReadOnlyGrid } = lazyModule
    render(<LazyReadOnlyGrid data={fakeQuiver} height={300} />)

    await vi.waitFor(() => expect(gridModule.loads).toBe(1))
    act(() => {
      gridModule.fail(new Error("Failed to fetch dynamically imported module"))
    })

    // Vitest wraps the factory's error, so match on the error alert itself.
    expect(await screen.findByRole("alert")).toBeVisible()
    expect(screen.queryByTestId("stSkeleton")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mockReadOnlyGrid")).not.toBeInTheDocument()
  })
})

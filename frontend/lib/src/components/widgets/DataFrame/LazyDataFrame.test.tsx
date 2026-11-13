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
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import type { DataFrameProps } from "./DataFrame"
import type * as LazyDataFrameModule from "./LazyDataFrame"

/**
 * Controls the mocked DataFrame import: `release()` resolves it. `loads` and
 * `lastProps` record what the mock received.
 */
const mockDataFrameModule = {
  loads: 0,
  release: (): void => {},
  lastProps: undefined as DataFrameProps | undefined,
}

const element = DataframeProto.create({})

describe("LazyDataFrame", () => {
  let lazyModule: typeof LazyDataFrameModule

  beforeEach(async () => {
    // Fresh modules give each test a lazy component and a DataFrame module
    // that haven't loaded yet.
    vi.resetModules()
    mockDataFrameModule.loads = 0
    mockDataFrameModule.lastProps = undefined
    vi.doMock("./DataFrame", async () => {
      mockDataFrameModule.loads += 1
      await new Promise<void>(resolve => {
        mockDataFrameModule.release = resolve
      })
      return {
        default: (props: DataFrameProps) => {
          mockDataFrameModule.lastProps = props
          return <div data-testid="mockDataFrame" />
        },
      }
    })
    lazyModule = await import("./LazyDataFrame")
  })

  it.each([
    ["a pixel height", { pixelHeight: 300 }, "300px"],
    [
      "a stretch height",
      { useStretch: true },
      mockTheme.emotion.sizes.minElementHeight,
    ],
    ["an unset height", undefined, mockTheme.emotion.sizes.minElementHeight],
  ])(
    "shows a skeleton sized for %s until the DataFrame loads",
    async (_, heightConfig, skeletonHeight) => {
      const { LazyDataFrame } = lazyModule
      render(
        <LazyDataFrame
          element={element}
          disabled={false}
          widgetMgr={undefined}
          heightConfig={heightConfig}
        />
      )

      const skeleton = screen.getByTestId("stSkeleton")
      expect(skeleton).toHaveStyle({ height: skeletonHeight })
      expect(skeleton).toHaveAttribute("aria-hidden", "true")
      expect(screen.queryByTestId("mockDataFrame")).not.toBeInTheDocument()

      await vi.waitFor(() => expect(mockDataFrameModule.loads).toBe(1))
      act(() => {
        mockDataFrameModule.release()
      })

      expect(await screen.findByTestId("mockDataFrame")).toBeVisible()
      expect(screen.queryByTestId("stSkeleton")).not.toBeInTheDocument()
      expect(mockDataFrameModule.lastProps).toEqual({
        element,
        disabled: false,
        widgetMgr: undefined,
        heightConfig,
      })
    }
  )
})

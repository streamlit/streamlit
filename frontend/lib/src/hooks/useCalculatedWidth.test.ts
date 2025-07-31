/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { renderHook } from "@testing-library/react"

import { useCalculatedWidth } from "./useCalculatedWidth"
import * as useResizeObserver from "./useResizeObserver"

describe("useCalculatedWidth", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it.each([
    { width: -100, expected: -100 },
    { width: -1, expected: -1 },
    { width: -0, expected: -1 },
    { width: 0, expected: -1 },
    { width: 1, expected: 1 },
    { width: 100, expected: 100 },
  ])(
    "with an observed width of $width should return $expected",
    ({ width, expected }) => {
      vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
        () => ({
          values: [width],
          elementRef: { current: null },
        })
      )

      const { result } = renderHook(() => useCalculatedWidth())
      expect(result.current[0]).toBe(expected)
    }
  )
})

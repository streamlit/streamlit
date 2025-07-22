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

import { act, renderHook } from "@testing-library/react"

import { CustomGridTheme } from "./useCustomTheme"
import useRowHover from "./useRowHover"

const mockTheme = {
  bgRowHovered: "rgba(0, 0, 0, 0.1)",
} as CustomGridTheme

describe("useRowHover hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should initialize with no row hover", () => {
    const { result } = renderHook(() => useRowHover(mockTheme))

    expect(result.current.getRowThemeOverride).toBeDefined()
    expect(result.current.onItemHovered).toBeDefined()

    // Initially, no row should have a hover theme
    const themeOverride = result.current.getRowThemeOverride?.(0, 0, 0)
    expect(themeOverride).toBeUndefined()
  })

  it("should apply hover theme to hovered row", () => {
    const { result } = renderHook(() => useRowHover(mockTheme))

    // Simulate hovering over row 1
    act(() => {
      result.current.onItemHovered?.({
        location: [0, 1], // [col, row]
        kind: "cell",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      } as any)
    })

    // Check that row 1 has hover theme
    const themeOverride = result.current.getRowThemeOverride?.(1, 1, 1)
    expect(themeOverride).toEqual({
      bgCell: mockTheme.bgRowHovered,
      bgCellMedium: mockTheme.bgRowHovered,
    })

    // Check that other rows don't have hover theme
    const otherRowTheme = result.current.getRowThemeOverride?.(0, 0, 0)
    expect(otherRowTheme).toBeUndefined()
  })

  it("should clear hover theme when mouse leaves", () => {
    const { result } = renderHook(() => useRowHover(mockTheme))

    // Simulate hovering over row 1
    act(() => {
      result.current.onItemHovered?.({
        location: [0, 1],
        kind: "cell",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      } as any)
    })

    // Simulate mouse leaving (undefined location)
    act(() => {
      result.current.onItemHovered?.({
        location: undefined,
        kind: "out-of-bounds",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      } as any)
    })

    // Check that hover theme is cleared
    const themeOverride = result.current.getRowThemeOverride?.(1, 1, 1)
    expect(themeOverride).toBeUndefined()
  })

  it("should update hover theme when moving between rows", () => {
    const { result } = renderHook(() => useRowHover(mockTheme))

    // Hover over row 1
    act(() => {
      result.current.onItemHovered?.({
        location: [0, 1],
        kind: "cell",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      } as any)
    })

    // Move to row 2
    act(() => {
      result.current.onItemHovered?.({
        location: [0, 2],
        kind: "cell",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      } as any)
    })

    // Check that row 1 no longer has hover theme
    const row1Theme = result.current.getRowThemeOverride?.(1, 1, 1)
    expect(row1Theme).toBeUndefined()

    // Check that row 2 has hover theme
    const row2Theme = result.current.getRowThemeOverride?.(2, 2, 2)
    expect(row2Theme).toEqual({
      bgCell: mockTheme.bgRowHovered,
      bgCellMedium: mockTheme.bgRowHovered,
    })
  })
})

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

import { PointerEvent } from "react"

import { act, renderHook } from "@testing-library/react"
import { vi } from "vitest"

import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import { mockTheme } from "~lib/mocks/mockTheme"
import { TestAppWrapper } from "~lib/test_util"
import { convertRemToPx } from "~lib/theme/utils"

import { clampDrawerWidth, useDrawerResize } from "./useDrawerResize"

describe("clampDrawerWidth", () => {
  it("clamps to the max width when wider than the allowed maximum", () => {
    expect(clampDrawerWidth(2000, 320, 1000)).toBe(1000)
  })

  it("clamps to the minimum when narrower than the theme min", () => {
    expect(clampDrawerWidth(100, 320, 1000)).toBe(320)
  })

  it("uses the max as the minimum when the max is narrower than the theme min", () => {
    expect(clampDrawerWidth(100, 320, 280)).toBe(280)
  })
})

function createHandleWithPanel(width: number): HTMLDivElement {
  const panel = document.createElement("div")
  const handle = document.createElement("div")
  panel.appendChild(handle)
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
    width,
    height: 800,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 800,
    toJSON: () => ({}),
  })
  return handle
}

function pointerEvent(
  handle: HTMLDivElement,
  clientX: number
): PointerEvent<HTMLDivElement> {
  return {
    button: 0,
    clientX,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: handle,
    hasPointerCapture: () => false,
  } as unknown as PointerEvent<HTMLDivElement>
}

describe("useDrawerResize", () => {
  it("keeps the preset width and disables resizing for a centered dialog", () => {
    const { result } = renderHook(
      () => useDrawerResize({ position: "center", presetWidth: "31.25rem" }),
      { wrapper: TestAppWrapper }
    )

    expect(result.current.resizeSide).toBe(null)
    expect(result.current.dialogWidth).toBe("31.25rem")
  })

  it.each(["left", "right"] as const)(
    "enables resizing for a %s drawer",
    position => {
      const { result } = renderHook(
        () => useDrawerResize({ position, presetWidth: "31.25rem" }),
        { wrapper: TestAppWrapper }
      )

      expect(result.current.resizeSide).toBe(position)
      expect(result.current.dialogWidth).toBe("31.25rem")
    }
  )

  it("widens a left drawer when dragged right and restores the preset on double-click", () => {
    const handle = createHandleWithPanel(500)
    const { result } = renderHook(
      () => useDrawerResize({ position: "left", presetWidth: "31.25rem" }),
      { wrapper: TestAppWrapper }
    )

    act(() => {
      result.current.resizeHandleProps.onPointerDown(pointerEvent(handle, 500))
      result.current.resizeHandleProps.onPointerMove(pointerEvent(handle, 560))
    })

    expect(result.current.dialogWidth).toBe("560px")

    act(() => {
      result.current.resizeHandleProps.onDoubleClick()
    })

    expect(result.current.dialogWidth).toBe("31.25rem")
  })

  it("widens a right drawer when dragged left", () => {
    const handle = createHandleWithPanel(500)
    const { result } = renderHook(
      () => useDrawerResize({ position: "right", presetWidth: "31.25rem" }),
      { wrapper: TestAppWrapper }
    )

    act(() => {
      result.current.resizeHandleProps.onPointerDown(pointerEvent(handle, 100))
      result.current.resizeHandleProps.onPointerMove(pointerEvent(handle, 40))
    })

    expect(result.current.dialogWidth).toBe("560px")
  })

  it("leaves a gutter of the app visible instead of filling the viewport", () => {
    const handle = createHandleWithPanel(500)
    const { result } = renderHook(
      () => ({
        resize: useDrawerResize({
          position: "left",
          presetWidth: "31.25rem",
        }),
        innerWidth: useWindowDimensionsContext().innerWidth,
      }),
      { wrapper: TestAppWrapper }
    )

    act(() => {
      result.current.resize.resizeHandleProps.onPointerDown(
        pointerEvent(handle, 500)
      )
      result.current.resize.resizeHandleProps.onPointerMove(
        pointerEvent(handle, 5000)
      )
    })

    const gutterPx = convertRemToPx(mockTheme.emotion.spacing.twoXL)
    expect(result.current.resize.dialogWidth).toBe(
      `${result.current.innerWidth - gutterPx}px`
    )
  })
})

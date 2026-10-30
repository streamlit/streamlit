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

import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  PRINT_SCREEN_WIDTH_VAR,
  usePrintScreenWidth,
} from "./usePrintScreenWidth"

function createElementWithWidth(width: number): HTMLDivElement {
  const element = document.createElement("div")
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    width,
  } as DOMRect)
  return element
}

describe("usePrintScreenWidth", () => {
  it("records the screen width before printing and clears it afterwards", () => {
    const element = createElementWithWidth(230)
    renderHook(() => usePrintScreenWidth({ current: element }))

    window.dispatchEvent(new Event("beforeprint"))
    expect(element.style.getPropertyValue(PRINT_SCREEN_WIDTH_VAR)).toBe(
      "230px"
    )

    window.dispatchEvent(new Event("afterprint"))
    expect(element.style.getPropertyValue(PRINT_SCREEN_WIDTH_VAR)).toBe("")
  })

  it("records nothing for a hidden element with no width", () => {
    const element = createElementWithWidth(0)
    renderHook(() => usePrintScreenWidth({ current: element }))

    window.dispatchEvent(new Event("beforeprint"))
    expect(element.style.getPropertyValue(PRINT_SCREEN_WIDTH_VAR)).toBe("")
  })

  it("drops a stale width when the element now measures zero", () => {
    const element = createElementWithWidth(0)
    // A previous print whose afterprint never fired left this behind.
    element.style.setProperty(PRINT_SCREEN_WIDTH_VAR, "180px")
    renderHook(() => usePrintScreenWidth({ current: element }))

    window.dispatchEvent(new Event("beforeprint"))
    expect(element.style.getPropertyValue(PRINT_SCREEN_WIDTH_VAR)).toBe("")
    expect(element.style.getPropertyValue(PRINT_SCREEN_WIDTH_VAR)).not.toBe(
      "180px"
    )
  })

  it("records nothing when disabled", () => {
    const element = createElementWithWidth(230)
    renderHook(() => usePrintScreenWidth({ current: element }, false))

    window.dispatchEvent(new Event("beforeprint"))
    expect(element.style.getPropertyValue(PRINT_SCREEN_WIDTH_VAR)).toBe("")
  })

  it("stops listening after unmount", () => {
    const element = createElementWithWidth(230)
    const { unmount } = renderHook(() =>
      usePrintScreenWidth({ current: element })
    )
    unmount()

    window.dispatchEvent(new Event("beforeprint"))
    expect(element.style.getPropertyValue(PRINT_SCREEN_WIDTH_VAR)).toBe("")
  })
})

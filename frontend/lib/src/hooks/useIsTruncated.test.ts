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

import { createElement, useRef } from "react"

import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useIsTruncated } from "./useIsTruncated"

interface TestProps {
  enabled: boolean
  label?: string
}

function TestComponent({
  enabled,
  label = "Full label text",
}: TestProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isTruncated, labelText } = useIsTruncated(containerRef, enabled, [
    label,
  ])
  return createElement(
    "div",
    { ref: containerRef },
    label
      ? createElement(
          "div",
          { "data-testid": "stMarkdownContainer" },
          createElement("p", null, label)
        )
      : null,
    createElement(
      "span",
      { "data-testid": "result" },
      `${isTruncated}|${labelText}`
    )
  )
}

const mockWidths = (scrollWidth: number, clientWidth: number): void => {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
    scrollWidth
  )
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    clientWidth
  )
}

describe("useIsTruncated", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("reports truncation and the plain label text when content overflows", () => {
    mockWidths(200, 100)
    render(createElement(TestComponent, { enabled: true }))
    expect(screen.getByTestId("result")).toHaveTextContent(
      "true|Full label text"
    )
  })

  it("reports no truncation but keeps the label text when the content fits", () => {
    mockWidths(100, 100)
    render(createElement(TestComponent, { enabled: true }))
    expect(screen.getByTestId("result")).toHaveTextContent(
      "false|Full label text"
    )
  })

  it("stays disabled and does not measure when enabled is false", () => {
    mockWidths(200, 100)
    render(createElement(TestComponent, { enabled: false }))
    expect(screen.getByTestId("result")).toHaveTextContent("false|")
  })

  it("re-measures via the ResizeObserver when the container resizes", () => {
    const resizeCallbacks: ResizeObserverCallback[] = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback)
        }

        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = disconnect
      }
    )

    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100)

    const { unmount } = render(createElement(TestComponent, { enabled: true }))
    expect(screen.getByTestId("result")).toHaveTextContent(
      "false|Full label text"
    )

    // The label now overflows; firing the observer should update the result.
    scrollWidth.mockReturnValue(200)
    act(() => {
      resizeCallbacks.forEach(callback => callback([], {} as ResizeObserver))
    })
    expect(screen.getByTestId("result")).toHaveTextContent(
      "true|Full label text"
    )

    // The observer is disconnected on unmount to avoid leaks.
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it("clears stale truncation state when the label is removed", () => {
    mockWidths(200, 100)
    const { rerender } = render(
      createElement(TestComponent, { enabled: true, label: "Full label text" })
    )
    expect(screen.getByTestId("result")).toHaveTextContent(
      "true|Full label text"
    )

    rerender(createElement(TestComponent, { enabled: true, label: "" }))
    expect(screen.getByTestId("result")).toHaveTextContent("false|")
  })
})

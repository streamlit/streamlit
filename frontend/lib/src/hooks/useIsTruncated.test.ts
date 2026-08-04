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

import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useIsTruncated } from "./useIsTruncated"

interface TestProps {
  enabled: boolean
}

function TestComponent({ enabled }: TestProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isTruncated, labelText } = useIsTruncated(containerRef, enabled)
  return createElement(
    "div",
    { ref: containerRef },
    createElement(
      "div",
      { "data-testid": "stMarkdownContainer" },
      createElement("p", null, "Full label text")
    ),
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
  })

  it("reports truncation and the plain label text when content overflows", () => {
    mockWidths(200, 100)
    render(createElement(TestComponent, { enabled: true }))
    expect(screen.getByTestId("result")).toHaveTextContent(
      "true|Full label text"
    )
  })

  it("reports no truncation when the content fits", () => {
    mockWidths(100, 100)
    render(createElement(TestComponent, { enabled: true }))
    expect(screen.getByTestId("result")).toHaveTextContent("false|")
  })

  it("stays disabled and does not measure when enabled is false", () => {
    mockWidths(200, 100)
    render(createElement(TestComponent, { enabled: false }))
    expect(screen.getByTestId("result")).toHaveTextContent("false|")
  })
})

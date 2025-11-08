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

import React, { FC } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useResizeObserver } from "~lib/hooks/useResizeObserver"

import { withCalculatedWidth } from "./withCalculatedWidth"

vi.mock("~lib/hooks/useResizeObserver", () => ({
  useResizeObserver: vi.fn(),
}))

describe("withCalculatedWidth", () => {
  const mockElementRef = { current: null }

  // Simple test component that displays its width prop
  const TestComponent: FC<{ width?: number }> = ({ width }) => (
    <div data-testid="test-component">Width: {width}</div>
  )

  it("should pass width to the wrapped component", () => {
    const mockWidth = 500
    vi.mocked(useResizeObserver).mockReturnValue({
      values: [mockWidth],
      elementRef: mockElementRef,
    })

    const EnhancedComponent = withCalculatedWidth(TestComponent)
    render(<EnhancedComponent />)

    expect(screen.getByTestId("test-component").textContent).toBe(
      `Width: ${mockWidth}`
    )
  })

  it("should pass -1 as width when resize observer returns 0", () => {
    vi.mocked(useResizeObserver).mockReturnValue({
      values: [0],
      elementRef: mockElementRef,
    })

    const EnhancedComponent = withCalculatedWidth(TestComponent)
    render(<EnhancedComponent />)

    expect(screen.getByTestId("test-component").textContent).toBe("Width: -1")
  })

  it("should forward additional props to the wrapped component", () => {
    vi.mocked(useResizeObserver).mockReturnValue({
      values: [300],
      elementRef: mockElementRef,
    })

    // Create a component that accepts additional props
    const ComponentWithProps: FC<{
      width?: number
      testProp: string
    }> = ({ width, testProp }) => (
      <div data-testid="test-component">
        Width: {width}, TestProp: {testProp}
      </div>
    )

    const EnhancedComponent = withCalculatedWidth(ComponentWithProps)
    render(<EnhancedComponent testProp="test-value" />)

    expect(screen.getByTestId("test-component").textContent).toBe(
      "Width: 300, TestProp: test-value"
    )
  })

  it("should set proper displayName", () => {
    vi.mocked(useResizeObserver).mockReturnValue({
      values: [300],
      elementRef: mockElementRef,
    })

    const EnhancedComponent = withCalculatedWidth(TestComponent)
    expect(EnhancedComponent.displayName).toBe(
      "withCalculatedWidth(TestComponent)"
    )
  })
})

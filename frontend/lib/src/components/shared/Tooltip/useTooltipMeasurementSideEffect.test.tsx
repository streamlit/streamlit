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

import { renderHook, waitFor } from "@testing-library/react"
import { MockInstance } from "vitest"

import { TestAppWrapper } from "~lib/test_util"

import { useTooltipMeasurementSideEffect } from "./useTooltipMeasurementSideEffect"

const MOCK_INNER_WIDTH = 1000
const MOCK_TRANSFORM = "matrix(1, 0, 0, 1, 900, 10)"

class MockDOMMatrix {
  e: number

  f: number

  constructor(transform: string | null) {
    // Default to identity matrix values
    this.e = 0
    this.f = 0

    if (transform) {
      const values = transform.match(/-?\d+(\.\d+)?/g)
      if (values && values.length >= 6) {
        this.e = parseFloat(values[4]) // 5th value is e (translateX)
        this.f = parseFloat(values[5]) // 6th value is f (translateY)
      }
    }
  }
}

vi.stubGlobal("DOMMatrix", MockDOMMatrix)

describe("useTooltipMeasurementSideEffect", () => {
  let requestAnimationFrameSpy: MockInstance
  let getComputedStyleSpy: MockInstance
  let innerWidthSpy: MockInstance

  /** Helper function to create DOM elements for testing */
  const createTooltipElements = (): {
    parentElement: HTMLDivElement
    tooltipElement: HTMLDivElement
  } => {
    const parentElement = document.createElement("div")
    const tooltipElement = document.createElement("div")
    parentElement.appendChild(tooltipElement)
    document.body.appendChild(parentElement)

    return { parentElement, tooltipElement }
  }

  /** Helper function to create DOM elements with grandparent for transform tests */
  const createTooltipElementsWithGrandparent = (): {
    grandparentElement: HTMLDivElement
    parentElement: HTMLDivElement
    tooltipElement: HTMLDivElement
  } => {
    const grandparentElement = document.createElement("div")
    const parentElement = document.createElement("div")
    const tooltipElement = document.createElement("div")

    parentElement.appendChild(tooltipElement)
    grandparentElement.appendChild(parentElement)
    document.body.appendChild(grandparentElement)

    return { grandparentElement, parentElement, tooltipElement }
  }

  /** Helper function to create a mock DOMRect */
  const createMockDOMRect = (
    x: number,
    y: number,
    width: number,
    height: number
  ): DOMRect => ({
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => ({}),
  })

  beforeEach(() => {
    requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(
        cb => setTimeout(() => cb(0), 0) as unknown as number
      )

    getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation(
        () =>
          ({
            transform: MOCK_TRANSFORM,
            getPropertyValue: (prop: string) =>
              prop === "transform" ? MOCK_TRANSFORM : "",
          }) as unknown as CSSStyleDeclaration
      )

    innerWidthSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(MOCK_INNER_WIDTH)
  })

  afterEach(() => {
    document.body.innerHTML = ""

    vi.restoreAllMocks()
  })

  it("does nothing when tooltipElement is null", () => {
    renderHook(() => useTooltipMeasurementSideEffect(null, true), {
      wrapper: TestAppWrapper,
    })
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
  })

  it("handles tooltip positioning with valid coordinates", async () => {
    const { parentElement, tooltipElement } = createTooltipElements()

    const getBoundingClientRectSpy = vi
      .spyOn(parentElement, "getBoundingClientRect")
      .mockReturnValue(createMockDOMRect(10, 10, 100, 50))

    renderHook(() => useTooltipMeasurementSideEffect(tooltipElement, true), {
      wrapper: TestAppWrapper,
    })

    await waitFor(() => {
      expect(getBoundingClientRectSpy).toHaveBeenCalled()
    })
  })

  it("handles right overflow correctly", async () => {
    const { parentElement, tooltipElement } =
      createTooltipElementsWithGrandparent()

    // Mock getBoundingClientRect for parent element - this will cause overflow
    vi.spyOn(parentElement, "getBoundingClientRect").mockReturnValue(
      createMockDOMRect(900, 10, 200, 50)
    )

    renderHook(() => useTooltipMeasurementSideEffect(tooltipElement, true), {
      wrapper: TestAppWrapper,
    })

    // Wait for the position to be adjusted and verify
    await waitFor(() => {
      // The overflow is 100 (900 + 200 - 1000), so the transform should adjust X by -100
      expect(parentElement.parentElement?.style.transform).toBe(
        "translate3d(800px, 10px, 0px)"
      )
    })
  })

  it("handles left overflow correctly", async () => {
    const { parentElement, tooltipElement } = createTooltipElements()

    // Mock getBoundingClientRect to simulate left overflow
    vi.spyOn(parentElement, "getBoundingClientRect").mockReturnValue(
      createMockDOMRect(-20, 10, 100, 50)
    )

    renderHook(() => useTooltipMeasurementSideEffect(tooltipElement, true), {
      wrapper: TestAppWrapper,
    })

    await waitFor(() => {
      expect(parentElement.style.left).toBe("20px")
    })
  })

  it("retries measurements when initial coordinates are invalid", async () => {
    const { parentElement, tooltipElement } = createTooltipElements()

    // Mock getBoundingClientRect to first return invalid coordinates, then valid ones
    const getBoundingClientRectSpy = vi
      .spyOn(parentElement, "getBoundingClientRect")
      .mockReturnValueOnce(createMockDOMRect(0, 0, 100, 50))
      .mockReturnValueOnce(createMockDOMRect(10, 10, 100, 50))

    renderHook(() => useTooltipMeasurementSideEffect(tooltipElement, true), {
      wrapper: TestAppWrapper,
    })

    await waitFor(() => {
      expect(requestAnimationFrameSpy).toHaveBeenCalled()
    })

    await waitFor(() =>
      expect(
        getBoundingClientRectSpy.mock.calls.length
      ).toBeGreaterThanOrEqual(2)
    )
  })

  it("uses window APIs for positioning calculations", async () => {
    const { parentElement, tooltipElement } =
      createTooltipElementsWithGrandparent()

    // Mock getBoundingClientRect to simulate right overflow
    vi.spyOn(parentElement, "getBoundingClientRect").mockReturnValue(
      createMockDOMRect(900, 10, 200, 50)
    )

    renderHook(() => useTooltipMeasurementSideEffect(tooltipElement, true), {
      wrapper: TestAppWrapper,
    })

    await waitFor(() => {
      expect(getComputedStyleSpy).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(innerWidthSpy).toHaveBeenCalled()
    })
  })
})

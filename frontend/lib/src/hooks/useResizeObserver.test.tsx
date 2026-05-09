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

import { MutableRefObject, ReactElement, useCallback } from "react"

import { act, screen } from "@testing-library/react"

import { render } from "~lib/test_util"

import { DOMRectKeys, useResizeObserver } from "./useResizeObserver"

const mockDisconnect = vi.fn()
const mockObserve = vi.fn()
let resizeCallback: ((entries: ResizeObserverEntry[]) => void) | null = null

// Helper component that uses the hook and displays values
function TestComponent({
  properties,
  throttleMs,
  dimensionsRef,
}: {
  properties: DOMRectKeys[]
  throttleMs: number
  dimensionsRef: MutableRefObject<{ width: number; height: number }>
}): ReactElement {
  const { values, elementRef } = useResizeObserver(properties, [], throttleMs)

  // Use a ref callback to set up getBoundingClientRect before ResizeObserver is attached
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        // Mock getBoundingClientRect before the effect runs
        node.getBoundingClientRect = () => ({
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          top: 0,
          left: 0,
          right: dimensionsRef.current.width,
          bottom: dimensionsRef.current.height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        })
      }
      elementRef.current = node
    },
    [elementRef, dimensionsRef]
  )

  return (
    <div ref={setRef} data-testid="observed-element">
      <span data-testid="values">{JSON.stringify(values)}</span>
    </div>
  )
}

describe("useResizeObserver", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resizeCallback = null
    // Mock ResizeObserver that captures the callback for manual triggering
    class TestResizeObserver {
      public observe: (element: Element) => void
      public disconnect: () => void

      constructor(callback: (entries: ResizeObserverEntry[]) => void) {
        resizeCallback = callback
        this.observe = mockObserve.mockImplementation(() => {
          // Trigger initial callback when observe is called
          callback([
            {
              target: document.createElement("div"),
            } as unknown as ResizeObserverEntry,
          ])
        })
        this.disconnect = mockDisconnect
      }
    }

    globalThis.ResizeObserver =
      TestResizeObserver as unknown as typeof ResizeObserver
    // Mock requestAnimationFrame to execute callback synchronously
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(cb => {
      cb(0)
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("updates values immediately when throttleMs is 0", () => {
    const properties: DOMRectKeys[] = ["width", "height"]
    const dimensionsRef = { current: { width: 100, height: 200 } }

    render(
      <TestComponent
        properties={properties}
        throttleMs={0}
        dimensionsRef={dimensionsRef}
      />
    )

    // Initial values should be set from the observe() callback
    expect(screen.getByTestId("values")).toHaveTextContent("[100,200]")

    // Simulate resize event - should update immediately (no throttle)
    dimensionsRef.current = { width: 150, height: 250 }
    act(() => {
      resizeCallback?.([{} as ResizeObserverEntry])
    })
    expect(screen.getByTestId("values")).toHaveTextContent("[150,250]")

    // Another resize - should also update immediately
    dimensionsRef.current = { width: 200, height: 300 }
    act(() => {
      resizeCallback?.([{} as ResizeObserverEntry])
    })
    expect(screen.getByTestId("values")).toHaveTextContent("[200,300]")
  })

  it("throttles updates when throttleMs > 0", () => {
    const properties: DOMRectKeys[] = ["width", "height"]
    const dimensionsRef = { current: { width: 100, height: 200 } }

    render(
      <TestComponent
        properties={properties}
        throttleMs={100}
        dimensionsRef={dimensionsRef}
      />
    )

    // Initial values from observe() callback - this triggers the throttle cooldown
    expect(screen.getByTestId("values")).toHaveTextContent("[100,200]")

    // First resize after observe - throttle is already in cooldown, so NOT immediate
    dimensionsRef.current = { width: 150, height: 250 }
    act(() => {
      resizeCallback?.([{} as ResizeObserverEntry])
    })
    // Still showing initial values because we're in throttle cooldown
    expect(screen.getByTestId("values")).toHaveTextContent("[100,200]")

    // Second resize within throttle window - saves new args, still no update
    dimensionsRef.current = { width: 200, height: 300 }
    act(() => {
      resizeCallback?.([{} as ResizeObserverEntry])
    })
    expect(screen.getByTestId("values")).toHaveTextContent("[100,200]")

    // Advance timer past throttle window - trailing call executes with last saved values
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // Should now have the last values from the throttled period
    expect(screen.getByTestId("values")).toHaveTextContent("[200,300]")

    // Wait for trailing call's cooldown to expire
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // New resize after cooldown - should update immediately (new throttle window)
    dimensionsRef.current = { width: 250, height: 350 }
    act(() => {
      resizeCallback?.([{} as ResizeObserverEntry])
    })
    expect(screen.getByTestId("values")).toHaveTextContent("[250,350]")
  })
})

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

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { RefObject } from "react"

import { act, renderHook } from "@testing-library/react"

import { useTextInputAutoExpand } from "./useTextInputAutoExpand"

// Mock the useTheme hook
vi.mock("@emotion/react", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix, @eslint-react/hooks-extra/no-useless-custom-hooks
  useTheme: () => ({
    sizes: {
      minElementHeight: "2.5rem",
    },
  }),
  keyframes: () => "keyframes",
}))

// Helper to create a mock textarea ref
const createMockTextareaRef = (
  overrides: Partial<{
    offsetHeight: number
    scrollHeight: number
    style: { height: string }
  }> = {}
): RefObject<HTMLTextAreaElement> => {
  const defaultElement = {
    offsetHeight: 40,
    scrollHeight: 40,
    style: {
      height: "",
    },
  }

  return {
    current: {
      ...defaultElement,
      ...overrides,
    } as HTMLTextAreaElement,
  }
}

describe("useTextInputAutoExpand", () => {
  describe("initialization", () => {
    it("should initialize with default values", () => {
      const mockTextareaRef = createMockTextareaRef()

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: mockTextareaRef })
      )

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem") // theme.sizes.minElementHeight
      expect(result.current.maxHeight).toBe("260px") // 40 * 6.5
      expect(typeof result.current.updateScrollHeight).toBe("function")
    })

    it("should initialize with null ref", () => {
      const nullRef = { current: null }
      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: nullRef })
      )

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
      expect(result.current.maxHeight).toBe("")
    })

    it("should calculate scroll height correctly", () => {
      const expandedRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 80, // Greater than offsetHeight
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: expandedRef })
      )

      // Should be extended since scrollHeight (80) > minHeight (40) + rounding offset (1)
      // The hook should automatically calculate this on initialization
      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("81px") // scrollHeight + ROUNDING_OFFSET
    })

    it("should handle textarea within rounding offset", () => {
      const smallDifferenceRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 40.5, // Within rounding offset of 1
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: smallDifferenceRef })
      )

      // Should not be extended due to rounding offset
      // The hook should automatically calculate this on initialization
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
    })
  })

  describe("scroll height calculation", () => {
    it("should update isExtended when textarea scroll height changes", () => {
      // Start with a non-extended textarea
      const dynamicRef = createMockTextareaRef()

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: dynamicRef })
      )

      // Initial state should not be extended
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")

      // Simulate content growth by changing scrollHeight
      Object.defineProperty(dynamicRef.current!, "scrollHeight", {
        value: 100, // Now greater than offsetHeight
        writable: true,
        configurable: true,
      })

      // Trigger recalculation
      act(() => {
        result.current.updateScrollHeight()
      })

      // Should now be extended
      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("101px") // new scrollHeight + ROUNDING_OFFSET
    })

    it("should become extended when scroll height decreases significantly below offset height", () => {
      // Start with a non-extended textarea (equal heights)
      const shrinkingRef = createMockTextareaRef()

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: shrinkingRef })
      )

      // Initial state should not be extended
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")

      // Simulate content shrinking by changing scrollHeight to smaller value
      Object.defineProperty(shrinkingRef.current!, "scrollHeight", {
        value: 30, // Now less than offsetHeight (40)
        writable: true,
        configurable: true,
      })

      // Trigger recalculation
      act(() => {
        result.current.updateScrollHeight()
      })

      // Should be extended because Math.abs(30-40) = 10 > ROUNDING_OFFSET
      // The current hook logic treats significant differences in either direction as extended
      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("31px") // scrollHeight + ROUNDING_OFFSET
    })

    it("should update isExtended when textarea shrinks back to normal", () => {
      // Start with an extended textarea
      const shrinkingRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 100, // Greater than offsetHeight - extended
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: shrinkingRef })
      )

      // Initial state should be extended
      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("101px")

      // Simulate content shrinking by changing scrollHeight back to normal
      Object.defineProperty(shrinkingRef.current!, "scrollHeight", {
        value: 40, // Same as offsetHeight - not extended
        writable: true,
        configurable: true,
      })

      // Trigger recalculation
      act(() => {
        result.current.updateScrollHeight()
      })

      // Should no longer be extended
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem") // Back to default height
    })
  })

  describe("dependencies", () => {
    it("should update scroll height when dependencies change", () => {
      const reactiveRef = createMockTextareaRef()

      let dependency = "initial"
      const { result, rerender } = renderHook(() =>
        useTextInputAutoExpand({
          textareaRef: reactiveRef,
          dependencies: [dependency],
        })
      )

      // Initial state should not be extended
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")

      // Simulate content growth by changing scrollHeight
      Object.defineProperty(reactiveRef.current!, "scrollHeight", {
        value: 80, // Now significantly greater than offsetHeight
        writable: true,
        configurable: true,
      })

      // Change dependency and rerender - this should trigger updateScrollHeight
      dependency = "changed"
      rerender()

      // Should now be extended due to dependency change triggering recalculation
      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("81px") // new scrollHeight + ROUNDING_OFFSET
    })

    it("should handle multiple dependencies", () => {
      const multiDepRef = createMockTextareaRef()

      let dep1 = "a"
      const dep2 = "b"
      const { result, rerender } = renderHook(() =>
        useTextInputAutoExpand({
          textareaRef: multiDepRef,
          dependencies: [dep1, dep2],
        })
      )

      // Initial state should not be extended
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")

      // Simulate content growth by changing scrollHeight
      Object.defineProperty(multiDepRef.current!, "scrollHeight", {
        value: 100, // Now significantly greater than offsetHeight
        writable: true,
        configurable: true,
      })

      // Change one dependency and rerender - this should trigger updateScrollHeight
      dep1 = "changed1"
      rerender()

      // Should now be extended due to dependencies change triggering recalculation
      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("101px") // new scrollHeight + ROUNDING_OFFSET
    })
  })

  describe("updateScrollHeight function", () => {
    it("should handle null textarea ref in updateScrollHeight", () => {
      const nullRef = { current: null }
      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: nullRef })
      )

      // Should not throw error
      act(() => {
        result.current.updateScrollHeight()
      })

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
    })
  })

  describe("style height manipulation", () => {
    it("should temporarily reset height to auto during calculation", () => {
      const mockTextareaRef = createMockTextareaRef()

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: mockTextareaRef })
      )

      act(() => {
        result.current.updateScrollHeight()
      })

      // After calculation, height should be reset to empty string
      expect(mockTextareaRef.current?.style.height).toBe("")
    })
  })

  describe("edge cases", () => {
    it("should handle zero scroll height", () => {
      const zeroScrollRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 0,
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: zeroScrollRef })
      )

      // The hook should automatically handle this on initialization
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
    })

    it("should handle very large content", () => {
      const largeContentRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 1000,
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: largeContentRef })
      )

      // The hook should automatically handle this on initialization
      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("1001px")
      expect(result.current.maxHeight).toBe("260px") // Still limited by max height
    })
  })
})

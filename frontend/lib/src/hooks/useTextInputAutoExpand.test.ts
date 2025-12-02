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
  useTheme: () => ({
    sizes: {
      minElementHeight: "2.5rem",
    },
  }),
  keyframes: () => "keyframes",
}))

// Track created elements for cleanup
const createdElements: HTMLTextAreaElement[] = []

// Helper to create a real textarea element for testing
// Using real DOM elements is required because getComputedStyle needs actual elements
const createMockTextareaRef = (
  overrides: Partial<{
    offsetHeight: number
    scrollHeight: number
    lineHeight: string
    padding: string
  }> = {}
): RefObject<HTMLTextAreaElement> => {
  const textarea = document.createElement("textarea")

  // Set CSS styles so getComputedStyle returns numeric values
  textarea.style.lineHeight = overrides.lineHeight ?? "40px"
  textarea.style.padding = overrides.padding ?? "0px"

  Object.defineProperty(textarea, "offsetHeight", {
    value: overrides.offsetHeight ?? 40,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(textarea, "scrollHeight", {
    value: overrides.scrollHeight ?? 40,
    writable: true,
    configurable: true,
  })

  // Append to document so getComputedStyle works
  document.body.appendChild(textarea)
  createdElements.push(textarea)

  return { current: textarea }
}

// Clean up DOM after each test using explicit removal
afterEach(() => {
  createdElements.forEach(el => el.remove())
  createdElements.length = 0
})

describe("useTextInputAutoExpand", () => {
  describe("initialization", () => {
    it("should initialize with default values", () => {
      const mockTextareaRef = createMockTextareaRef()

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: mockTextareaRef })
      )

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem") // theme.sizes.minElementHeight
      expect(result.current.maxHeight).toBe("260px") // 40px lineHeight * 6.5
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
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
    })

    it("should handle non-zero padding in maxHeight calculation", () => {
      const paddedRef = createMockTextareaRef({
        offsetHeight: 56, // 40px line + 16px padding
        lineHeight: "40px",
        padding: "8px", // 8px top + 8px bottom = 16px total
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: paddedRef })
      )

      // maxHeight should be (40 * 6.5) + 16 = 276px
      expect(result.current.maxHeight).toBe("276px")
    })

    it("should fallback to offsetHeight when lineHeight is 'normal'", () => {
      const normalLineHeightRef = createMockTextareaRef({
        offsetHeight: 40,
        lineHeight: "normal", // parseFloat("normal") = NaN
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: normalLineHeightRef })
      )

      // Should fallback to offsetHeight (40) for calculation
      // maxHeight = 40 * 6.5 = 260px
      expect(result.current.maxHeight).toBe("260px")
    })
  })

  describe("scroll height calculation", () => {
    it("should update isExtended when textarea scroll height changes", () => {
      const dynamicRef = createMockTextareaRef()

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: dynamicRef })
      )

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")

      // Simulate content growth
      Object.defineProperty(dynamicRef.current!, "scrollHeight", {
        value: 100,
        writable: true,
        configurable: true,
      })

      act(() => {
        result.current.updateScrollHeight()
      })

      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("101px")
    })

    it("should not be extended when scroll height is less than min height", () => {
      // Start with a non-extended textarea
      const shrinkingRef = createMockTextareaRef()

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: shrinkingRef })
      )

      expect(result.current.isExtended).toBe(false)

      // Simulate content shrinking below minHeight
      Object.defineProperty(shrinkingRef.current!, "scrollHeight", {
        value: 30, // Less than offsetHeight (40)
        writable: true,
        configurable: true,
      })

      act(() => {
        result.current.updateScrollHeight()
      })

      // Should NOT be extended - scrollHeight < minHeight means content fits
      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
    })

    it("should update isExtended when textarea shrinks back to normal", () => {
      const shrinkingRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 100, // Extended
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: shrinkingRef })
      )

      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("101px")

      // Simulate content shrinking
      Object.defineProperty(shrinkingRef.current!, "scrollHeight", {
        value: 40,
        writable: true,
        configurable: true,
      })

      act(() => {
        result.current.updateScrollHeight()
      })

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
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

      expect(result.current.isExtended).toBe(false)

      // Simulate content growth
      Object.defineProperty(reactiveRef.current!, "scrollHeight", {
        value: 80,
        writable: true,
        configurable: true,
      })

      // Change dependency to trigger recalculation
      dependency = "changed"
      rerender()

      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("81px")
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

      expect(result.current.isExtended).toBe(false)

      Object.defineProperty(multiDepRef.current!, "scrollHeight", {
        value: 100,
        writable: true,
        configurable: true,
      })

      dep1 = "changed1"
      rerender()

      expect(result.current.isExtended).toBe(true)
      expect(result.current.height).toBe("101px")
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

  describe("clearScrollHeight function", () => {
    it("should reset scroll height and extended state", () => {
      const extendedRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 100,
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: extendedRef })
      )

      expect(result.current.isExtended).toBe(true)

      act(() => {
        result.current.clearScrollHeight()
      })

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
    })
  })

  describe("style height manipulation", () => {
    it("should restore original height after calculation", () => {
      const mockTextareaRef = createMockTextareaRef()
      mockTextareaRef.current!.style.height = "50px"

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: mockTextareaRef })
      )

      act(() => {
        result.current.updateScrollHeight()
      })

      expect(mockTextareaRef.current?.style.height).toBe("50px")
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

      expect(result.current.isExtended).toBe(false)
      expect(result.current.height).toBe("2.5rem")
    })

    it("should cap height at maxHeight for very large content", () => {
      const largeContentRef = createMockTextareaRef({
        offsetHeight: 40,
        scrollHeight: 1000,
      })

      const { result } = renderHook(() =>
        useTextInputAutoExpand({ textareaRef: largeContentRef })
      )

      expect(result.current.isExtended).toBe(true)
      // Height should be capped at maxHeight (260px)
      expect(result.current.height).toBe("260px")
      expect(result.current.maxHeight).toBe("260px")
    })
  })
})

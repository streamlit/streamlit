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

import { MouseEvent } from "react"

import { act, renderHook } from "@testing-library/react"

import { useDetailsAnimation } from "./useDetailsAnimation"

describe("useDetailsAnimation", () => {
  describe("initial state", () => {
    it("returns isOpen=true when backendExpanded is true", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: true,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(true)
    })

    it("returns isOpen=false when backendExpanded is false", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })

    it("returns isOpen=false when backendExpanded is null", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: null,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })

    it("returns isOpen=false when backendExpanded is undefined", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: undefined,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })
  })

  describe("handleToggle", () => {
    it("toggles isOpen state from false to true", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)

      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(true)
    })

    it("toggles isOpen state from true to false", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: true,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(true)

      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(false)
    })

    it("calls onToggle callback with new state", () => {
      const onToggle = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
          onToggle,
        })
      )

      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(onToggle).toHaveBeenCalledWith(true)
    })

    it("does not call onToggle when not provided", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      // Should not throw when onToggle is undefined
      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(true)
    })

    it("prevents default event behavior", () => {
      const preventDefault = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      act(() => {
        const mockEvent = {
          preventDefault,
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(preventDefault).toHaveBeenCalled()
    })

    it("handles rapid double-toggle correctly", () => {
      const onToggle = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
          onToggle,
        })
      )

      expect(result.current.isOpen).toBe(false)

      // Simulate two rapid clicks before React re-renders
      act(() => {
        const mockEvent1 = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        const mockEvent2 = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent1)
        result.current.handleToggle(mockEvent2)
      })

      // Should end up back at the original state (false -> true -> false)
      expect(result.current.isOpen).toBe(false)
      // Both toggles should have fired with correct values
      expect(onToggle).toHaveBeenCalledTimes(2)
      expect(onToggle).toHaveBeenNthCalledWith(1, true)
      expect(onToggle).toHaveBeenNthCalledWith(2, false)
    })
  })

  describe("backend sync", () => {
    it("syncs isOpen when backendExpanded changes", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded }) =>
          useDetailsAnimation({
            backendExpanded,
            label: "Test",
          }),
        { initialProps: { backendExpanded: false as boolean | null } }
      )

      expect(result.current.isOpen).toBe(false)

      rerender({ backendExpanded: true })

      expect(result.current.isOpen).toBe(true)
    })

    it("preserves current state when backendExpanded is null (ClearField)", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded }) =>
          useDetailsAnimation({
            backendExpanded,
            label: "Test",
          }),
        { initialProps: { backendExpanded: true as boolean | null } }
      )

      expect(result.current.isOpen).toBe(true)

      // User manually toggles closed
      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(false)

      // Backend sends null (ClearField) - should NOT change state
      rerender({ backendExpanded: null })

      expect(result.current.isOpen).toBe(false)
    })

    it("preserves current state when backendExpanded becomes undefined", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded }) =>
          useDetailsAnimation({
            backendExpanded,
            label: "Test",
          }),
        {
          initialProps: {
            backendExpanded: true as boolean | null | undefined,
          },
        }
      )

      expect(result.current.isOpen).toBe(true)

      // Backend sends undefined - should NOT change state
      rerender({ backendExpanded: undefined })

      expect(result.current.isOpen).toBe(true)
    })

    it("resets state when label changes (new expander)", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded, label }) =>
          useDetailsAnimation({
            backendExpanded,
            label,
          }),
        {
          initialProps: {
            backendExpanded: true as boolean | null,
            label: "Old Label",
          },
        }
      )

      // Toggle to false locally
      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(false)

      // Change label (simulates new expander) - should reset to backendExpanded
      rerender({ backendExpanded: true, label: "New Label" })

      expect(result.current.isOpen).toBe(true)
    })
  })

  describe("cleanup", () => {
    it("does not throw on unmount", () => {
      const { unmount } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      expect(() => unmount()).not.toThrow()
    })
  })
})

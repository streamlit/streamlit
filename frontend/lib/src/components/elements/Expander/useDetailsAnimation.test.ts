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
    it("returns isOpen=true when initialExpanded is true", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          initialExpanded: true,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(true)
    })

    it("returns isOpen=false when initialExpanded is false", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          initialExpanded: false,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })

    it("returns isOpen=false when initialExpanded is null", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          initialExpanded: null,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })

    it("returns isOpen=false when initialExpanded is undefined", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          initialExpanded: undefined,
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
          initialExpanded: false,
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
          initialExpanded: true,
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

    it("prevents default event behavior", () => {
      const preventDefault = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          initialExpanded: false,
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
  })

  describe("backend sync", () => {
    it("syncs isOpen when initialExpanded changes", () => {
      const { result, rerender } = renderHook(
        ({ initialExpanded }) =>
          useDetailsAnimation({
            initialExpanded,
            label: "Test",
          }),
        { initialProps: { initialExpanded: false as boolean | null } }
      )

      expect(result.current.isOpen).toBe(false)

      rerender({ initialExpanded: true })

      expect(result.current.isOpen).toBe(true)
    })

    it("preserves state when initialExpanded is null (ClearField)", () => {
      const { result, rerender } = renderHook(
        ({ initialExpanded }) =>
          useDetailsAnimation({
            initialExpanded,
            label: "Test",
          }),
        { initialProps: { initialExpanded: true as boolean | null } }
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

      // Backend sends null (ClearField) — should NOT change state
      rerender({ initialExpanded: null })

      expect(result.current.isOpen).toBe(false)
    })

    it("resets state when label changes (new expander)", () => {
      const { result, rerender } = renderHook(
        ({ initialExpanded, label }) =>
          useDetailsAnimation({
            initialExpanded,
            label,
          }),
        {
          initialProps: {
            initialExpanded: true as boolean | null,
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

      // Change label (simulates new expander) - should reset to initialExpanded
      rerender({ initialExpanded: true, label: "New Label" })

      expect(result.current.isOpen).toBe(true)
    })
  })

  describe("cleanup", () => {
    it("does not throw on unmount", () => {
      const { unmount } = renderHook(() =>
        useDetailsAnimation({
          initialExpanded: false,
          label: "Test",
        })
      )

      expect(() => unmount()).not.toThrow()
    })
  })
})

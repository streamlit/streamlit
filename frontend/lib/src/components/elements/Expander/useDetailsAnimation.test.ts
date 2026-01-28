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
    it("returns isOpen=true when backendOpen is true", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendOpen: true,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(true)
    })

    it("returns isOpen=false when backendOpen is false", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendOpen: false,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })

    it("returns refs for details, summary, and content", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendOpen: false,
          label: "Test",
        })
      )

      expect(result.current.detailsRef).toBeDefined()
      expect(result.current.summaryRef).toBeDefined()
      expect(result.current.contentRef).toBeDefined()
    })

    it("returns handleToggle function", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendOpen: false,
          label: "Test",
        })
      )

      expect(typeof result.current.handleToggle).toBe("function")
    })
  })

  describe("handleToggle", () => {
    it("toggles isOpen state from false to true", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendOpen: false,
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
          backendOpen: true,
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
          backendOpen: false,
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

    it("prevents default event behavior", () => {
      const preventDefault = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendOpen: false,
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
    it("syncs isOpen when backendOpen changes", () => {
      const { result, rerender } = renderHook(
        ({ backendOpen }) =>
          useDetailsAnimation({
            backendOpen,
            label: "Test",
          }),
        { initialProps: { backendOpen: false } }
      )

      expect(result.current.isOpen).toBe(false)

      rerender({ backendOpen: true })

      expect(result.current.isOpen).toBe(true)
    })

    it("resets state when label changes (new expander)", () => {
      const { result, rerender } = renderHook(
        ({ backendOpen, label }) =>
          useDetailsAnimation({
            backendOpen,
            label,
          }),
        { initialProps: { backendOpen: true, label: "Old Label" } }
      )

      // Toggle to false locally
      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(false)

      // Change label (simulates new expander) - should reset to backendOpen
      rerender({ backendOpen: true, label: "New Label" })

      expect(result.current.isOpen).toBe(true)
    })
  })

  describe("cleanup", () => {
    it("does not throw on unmount", () => {
      const { unmount } = renderHook(() =>
        useDetailsAnimation({
          backendOpen: false,
          label: "Test",
        })
      )

      expect(() => unmount()).not.toThrow()
    })
  })
})

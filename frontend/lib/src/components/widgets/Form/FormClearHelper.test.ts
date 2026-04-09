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

import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WidgetStateManager } from "~lib/WidgetStateManager"

import { FormClearHelper, useFormClearHelper } from "./FormClearHelper"

describe("FormClearHelper", () => {
  const createMockWidgetMgr = (): WidgetStateManager => {
    const mockConnection = { disconnect: vi.fn() }
    return {
      addFormClearedListener: vi.fn().mockReturnValue(mockConnection),
    } as unknown as WidgetStateManager
  }

  describe("manageFormClearListener", () => {
    it("subscribes to form clear events when formId is valid", () => {
      const helper = new FormClearHelper()
      const widgetMgr = createMockWidgetMgr()
      const listener = vi.fn()

      helper.manageFormClearListener(widgetMgr, "my-form", listener)

      expect(widgetMgr.addFormClearedListener).toHaveBeenCalledWith(
        "my-form",
        listener
      )
    })

    it("does not subscribe when formId is empty", () => {
      const helper = new FormClearHelper()
      const widgetMgr = createMockWidgetMgr()
      const listener = vi.fn()

      helper.manageFormClearListener(widgetMgr, "", listener)

      expect(widgetMgr.addFormClearedListener).not.toHaveBeenCalled()
    })

    it("does not re-subscribe if params have not changed", () => {
      const helper = new FormClearHelper()
      const widgetMgr = createMockWidgetMgr()
      const listener = vi.fn()

      helper.manageFormClearListener(widgetMgr, "my-form", listener)
      helper.manageFormClearListener(widgetMgr, "my-form", listener)

      // Should only be called once since params didn't change
      expect(widgetMgr.addFormClearedListener).toHaveBeenCalledTimes(1)
    })

    it("re-subscribes when formId changes", () => {
      const helper = new FormClearHelper()
      const widgetMgr = createMockWidgetMgr()
      const listener = vi.fn()

      helper.manageFormClearListener(widgetMgr, "form-1", listener)
      helper.manageFormClearListener(widgetMgr, "form-2", listener)

      expect(widgetMgr.addFormClearedListener).toHaveBeenCalledTimes(2)
    })
  })

  describe("disconnect", () => {
    it("disconnects from form clear signal", () => {
      const helper = new FormClearHelper()
      const mockConnection = { disconnect: vi.fn() }
      const widgetMgr = {
        addFormClearedListener: vi.fn().mockReturnValue(mockConnection),
      } as unknown as WidgetStateManager
      const listener = vi.fn()

      helper.manageFormClearListener(widgetMgr, "my-form", listener)
      helper.disconnect()

      expect(mockConnection.disconnect).toHaveBeenCalled()
    })

    it("does nothing when not connected", () => {
      const helper = new FormClearHelper()
      // Should not throw when disconnecting without prior connection
      expect(() => helper.disconnect()).not.toThrow()
    })
  })
})

describe("useFormClearHelper", () => {
  it("does not throw when widgetMgr is undefined", () => {
    const element = { formId: "my-form" }
    const onFormCleared = vi.fn()

    expect(() =>
      renderHook(() =>
        useFormClearHelper({
          element,
          widgetMgr: undefined,
          onFormCleared,
        })
      )
    ).not.toThrow()

    // Verify onFormCleared was not called (no subscription made)
    expect(onFormCleared).not.toHaveBeenCalled()
  })

  it("does not subscribe when formId is invalid", () => {
    const element = { formId: "" }
    const widgetMgr = {
      addFormClearedListener: vi.fn(),
    } as unknown as WidgetStateManager
    const onFormCleared = vi.fn()

    renderHook(() =>
      useFormClearHelper({
        element,
        widgetMgr,
        onFormCleared,
      })
    )

    expect(widgetMgr.addFormClearedListener).not.toHaveBeenCalled()
  })

  it("subscribes to form clear events with valid params", () => {
    const element = { formId: "my-form" }
    const mockConnection = { disconnect: vi.fn() }
    const widgetMgr = {
      addFormClearedListener: vi.fn().mockReturnValue(mockConnection),
    } as unknown as WidgetStateManager
    const onFormCleared = vi.fn()

    renderHook(() =>
      useFormClearHelper({
        element,
        widgetMgr,
        onFormCleared,
      })
    )

    expect(widgetMgr.addFormClearedListener).toHaveBeenCalledWith(
      "my-form",
      onFormCleared
    )
  })

  it("disconnects on unmount", () => {
    const element = { formId: "my-form" }
    const mockConnection = { disconnect: vi.fn() }
    const widgetMgr = {
      addFormClearedListener: vi.fn().mockReturnValue(mockConnection),
    } as unknown as WidgetStateManager
    const onFormCleared = vi.fn()

    const { unmount } = renderHook(() =>
      useFormClearHelper({
        element,
        widgetMgr,
        onFormCleared,
      })
    )

    unmount()

    expect(mockConnection.disconnect).toHaveBeenCalled()
  })
})

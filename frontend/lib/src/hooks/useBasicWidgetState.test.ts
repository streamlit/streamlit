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

import { act, renderHook } from "@testing-library/react"

import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  type QueryParamBindingConfig,
  useBasicWidgetState,
  type ValueWithSource,
} from "./useBasicWidgetState"

// Mock proto interface for testing
interface MockProto {
  formId: string
  setValue: boolean
  id: string
  value: string | number | string[] | number[]
  default: string | number | string[] | number[]
}

// Helper functions for the hook
type MockValue = string | number | string[] | number[]
const getStateFromWidgetMgr = vi.fn(
  (_wm: WidgetStateManager, _el: MockProto): MockValue | undefined => undefined
)

const getCurrStateFromProto = vi.fn((el: MockProto) => el.value)

const getDefaultStateFromProto = vi.fn((el: MockProto) => el.default)

const updateWidgetMgrState = vi.fn(
  (
    _el: MockProto,
    _wm: WidgetStateManager,
    _vws: ValueWithSource<string | number | string[] | number[]>,
    _fragmentId: string | undefined
  ) => {}
)

describe("useBasicWidgetState - setValue ref-based dedup", () => {
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    vi.clearAllMocks()
    widgetMgr = new WidgetStateManager({
      formsDataChanged: vi.fn(),
      sendRerunBackMsg: vi.fn(),
    })
  })

  it("processes setValue when a new element reference arrives", () => {
    const element1: MockProto = {
      formId: "",
      setValue: true,
      id: "widget-ref-1",
      value: "value-1",
      default: "default",
    }

    const { result, rerender } = renderHook(
      ({ el }) =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element: el,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        }),
      { initialProps: { el: element1 } }
    )

    expect(result.current[0]).toBe("value-1")

    const element2: MockProto = {
      formId: "",
      setValue: true,
      id: "widget-ref-1",
      value: "value-2",
      default: "default",
    }

    rerender({ el: element2 })
    expect(result.current[0]).toBe("value-2")
  })

  it("does not double-process when re-rendered with the same element reference", () => {
    const element: MockProto = {
      formId: "",
      setValue: true,
      id: "widget-batch-1",
      value: "server-value",
      default: "default",
    }

    const { result, rerender } = renderHook(
      ({ el }) =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element: el,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        }),
      { initialProps: { el: element } }
    )

    expect(result.current[0]).toBe("server-value")

    updateWidgetMgrState.mockClear()

    // Re-render with exact same reference (simulates React batching).
    // The ref guard should prevent re-processing even though
    // element.setValue may have been cleared by the previous effect.
    rerender({ el: element })

    expect(updateWidgetMgrState).not.toHaveBeenCalled()
  })

  it("processes setValue from a new element even after a previous element was cleared", () => {
    const element1: MockProto = {
      formId: "",
      setValue: true,
      id: "widget-seq-1",
      value: "first",
      default: "default",
    }

    const { result, rerender } = renderHook(
      ({ el }) =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element: el,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        }),
      { initialProps: { el: element1 } }
    )

    expect(result.current[0]).toBe("first")

    // Simulate a rerun that sends a new element proto with setValue=true
    // (e.g., parallel fragment rerun acknowledging a user interaction).
    const element2: MockProto = {
      formId: "",
      setValue: true,
      id: "widget-seq-1",
      value: "second",
      default: "default",
    }

    rerender({ el: element2 })
    expect(result.current[0]).toBe("second")

    const element3: MockProto = {
      formId: "",
      setValue: true,
      id: "widget-seq-1",
      value: "third",
      default: "default",
    }

    rerender({ el: element3 })
    expect(result.current[0]).toBe("third")
  })
})

describe("useBasicWidgetState - getDefaultState logic", () => {
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    vi.clearAllMocks()
    widgetMgr = new WidgetStateManager({
      formsDataChanged: vi.fn(),
      sendRerunBackMsg: vi.fn(),
    })
  })

  describe("setValue behavior", () => {
    it("uses currValue when setValue is true", () => {
      const element: MockProto = {
        formId: "",
        setValue: true,
        id: "widget-1",
        value: "url-seeded-value",
        default: "default-value",
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      // When setValue is true, the hook should use getCurrStateFromProto
      expect(result.current[0]).toBe("url-seeded-value")
    })

    it("uses defaultValue when setValue is false", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-2",
        value: "some-value",
        default: "default-value",
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      // When setValue is false, always use defaultValue
      expect(result.current[0]).toBe("default-value")
    })

    it("uses defaultValue when setValue is false even if values differ", () => {
      // This is the key behavior change: we no longer infer seeding from
      // value != default. Instead, we rely on WidgetStateManager to persist
      // values across React Strict Mode remounts.
      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-3",
        value: "different-value",
        default: "default-value",
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      expect(result.current[0]).toBe("default-value")
    })
  })

  describe("WidgetStateManager takes precedence over getDefaultState", () => {
    it("uses WidgetStateManager value when setValue is false", () => {
      // When WidgetStateManager has a value and setValue is false,
      // WidgetStateManager value takes precedence over getDefaultStateFromProto
      const storedValue = "stored-in-widget-mgr"
      getStateFromWidgetMgr.mockReturnValueOnce(storedValue)

      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-4",
        value: "proto-value",
        default: "default-value",
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      // WidgetStateManager value wins when setValue is false
      expect(result.current[0]).toBe(storedValue)
    })

    it("setValue=true updates state even if WidgetStateManager has a value", () => {
      // When setValue is true, the backend is explicitly setting a new value
      // (e.g., from session_state update), so it should override cached value
      const storedValue = "stored-in-widget-mgr"
      getStateFromWidgetMgr.mockReturnValueOnce(storedValue)

      const element: MockProto = {
        formId: "",
        setValue: true,
        id: "widget-5",
        value: "new-backend-value",
        default: "default-value",
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      // setValue=true means backend is setting a new value, which should win
      expect(result.current[0]).toBe("new-backend-value")
    })
  })

  describe("array values", () => {
    it("uses currValue array when setValue is true", () => {
      const element: MockProto = {
        formId: "",
        setValue: true,
        id: "widget-6",
        value: [3, 4, 5],
        default: [1, 2],
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      expect(result.current[0]).toEqual([3, 4, 5])
    })

    it("uses defaultValue array when setValue is false", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-7",
        value: [3, 4, 5],
        default: [1, 2],
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      expect(result.current[0]).toEqual([1, 2])
    })
  })

  describe("numeric values", () => {
    it("uses currValue when setValue is true", () => {
      const element: MockProto = {
        formId: "",
        setValue: true,
        id: "widget-8",
        value: 42,
        default: 0,
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      expect(result.current[0]).toBe(42)
    })

    it("uses defaultValue when setValue is false", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-9",
        value: 42,
        default: 0,
      }

      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      expect(result.current[0]).toBe(0)
    })
  })

  describe("form clear behavior", () => {
    it("runs callback when resetValueAndRunCallback is configured", () => {
      const onFormCleared = vi.fn()

      const element: MockProto = {
        formId: "form-1",
        setValue: false,
        id: "widget-10",
        value: "curr-value",
        default: "default-value",
      }

      renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueAndRunCallback",
          onFormCleared,
        })
      )

      act(() => {
        widgetMgr.setFormSubmitBehaviors("form-1", true)
        widgetMgr.submitForm("form-1", undefined)
      })

      expect(onFormCleared).toHaveBeenCalledTimes(1)
    })

    it("resets value to default with resetValueOnly", () => {
      const element: MockProto = {
        formId: "form-2",
        setValue: false,
        id: "widget-11",
        value: "curr-value",
        default: "default-value",
      }

      renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
        })
      )

      updateWidgetMgrState.mockClear()

      act(() => {
        widgetMgr.setFormSubmitBehaviors("form-2", true)
        widgetMgr.submitForm("form-2", undefined)
      })

      expect(updateWidgetMgrState).toHaveBeenCalledWith(
        element,
        widgetMgr,
        { value: "default-value", fromUi: true },
        undefined
      )
    })

    it("forwards non-undefined fragmentId to WidgetStateManager updates", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-12",
        value: "curr-value",
        default: "default-value",
      }

      const fragmentId = "fragment-123"
      const { result } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId,
          formClearBehavior: "resetValueOnly",
        })
      )

      updateWidgetMgrState.mockClear()

      act(() => {
        result.current[1]({ value: "new-value", fromUi: true })
      })

      expect(updateWidgetMgrState).toHaveBeenCalledWith(
        element,
        widgetMgr,
        { value: "new-value", fromUi: true },
        fragmentId
      )
    })
  })

  describe("query param binding integration", () => {
    it("registers binding when queryParamBinding config is provided", () => {
      const registerSpy = vi.spyOn(widgetMgr, "registerQueryParamBinding")

      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-with-binding",
        value: "test",
        default: "default",
      }

      const queryParamBinding: QueryParamBindingConfig = {
        paramKey: "my_param",
        valueType: "string_value",
        clearable: false,
      }

      renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
          queryParamBinding,
        })
      )

      expect(registerSpy).toHaveBeenCalledWith(
        "widget-with-binding",
        "my_param",
        "string_value",
        "default",
        false,
        undefined
      )
    })

    it("does not register binding when queryParamBinding is undefined", () => {
      const registerSpy = vi.spyOn(widgetMgr, "registerQueryParamBinding")

      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-no-binding",
        value: "test",
        default: "default",
      }

      renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
          // No queryParamBinding
        })
      )

      expect(registerSpy).not.toHaveBeenCalled()
    })

    it("unregisters binding on unmount", () => {
      const unregisterSpy = vi.spyOn(widgetMgr, "unregisterQueryParamBinding")

      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-unmount-test",
        value: "test",
        default: "default",
      }

      const queryParamBinding: QueryParamBindingConfig = {
        paramKey: "unmount_param",
        valueType: "bool_value",
        clearable: false,
      }

      const { unmount } = renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
          queryParamBinding,
        })
      )

      // Clear any calls from React Strict Mode's initial mount/unmount/remount cycle
      unregisterSpy.mockClear()

      unmount()

      expect(unregisterSpy).toHaveBeenCalledWith("widget-unmount-test")
    })

    it("passes urlFormat correctly", () => {
      const registerSpy = vi.spyOn(widgetMgr, "registerQueryParamBinding")

      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-with-format",
        value: "hello",
        default: "hello",
      }

      const queryParamBinding: QueryParamBindingConfig = {
        paramKey: "greeting",
        valueType: "string_value",
        clearable: false,
        urlFormat: "comma",
      }

      renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
          queryParamBinding,
        })
      )

      expect(registerSpy).toHaveBeenCalledWith(
        "widget-with-format",
        "greeting",
        "string_value",
        "hello",
        false,
        "comma"
      )
    })

    it("uses urlDefault when provided instead of getDefaultStateFromProto", () => {
      const registerSpy = vi.spyOn(widgetMgr, "registerQueryParamBinding")

      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-with-url-default",
        value: 0,
        default: 0,
      }

      const queryParamBinding: QueryParamBindingConfig = {
        paramKey: "color",
        valueType: "string_array_value",
        clearable: false,
        urlFormat: "repeated",
        urlDefault: ["Red"],
      }

      renderHook(() =>
        useBasicWidgetState({
          getStateFromWidgetMgr,
          getCurrStateFromProto,
          getDefaultStateFromProto,
          updateWidgetMgrState,
          element,
          widgetMgr,
          fragmentId: undefined,
          formClearBehavior: "resetValueOnly",
          queryParamBinding,
        })
      )

      expect(registerSpy).toHaveBeenCalledWith(
        "widget-with-url-default",
        "color",
        "string_array_value",
        ["Red"],
        false,
        "repeated"
      )
    })

    it("does not re-register when urlDefault is a new reference with same value", () => {
      const registerSpy = vi.spyOn(widgetMgr, "registerQueryParamBinding")

      const element: MockProto = {
        formId: "",
        setValue: false,
        id: "widget-stable-default",
        value: 0,
        default: 0,
      }

      const { rerender } = renderHook(
        ({ binding }) =>
          useBasicWidgetState({
            getStateFromWidgetMgr,
            getCurrStateFromProto,
            getDefaultStateFromProto,
            updateWidgetMgrState,
            element,
            widgetMgr,
            fragmentId: undefined,
            formClearBehavior: "resetValueOnly",
            queryParamBinding: binding,
          }),
        {
          initialProps: {
            binding: {
              paramKey: "color",
              valueType: "string_array_value" as const,
              clearable: false,
              urlFormat: "repeated" as const,
              urlDefault: ["Red"],
            },
          },
        }
      )

      expect(registerSpy).toHaveBeenCalledTimes(1)

      // Re-render with a new array reference containing the same value
      rerender({
        binding: {
          paramKey: "color",
          valueType: "string_array_value" as const,
          clearable: false,
          urlFormat: "repeated" as const,
          urlDefault: ["Red"],
        },
      })

      expect(registerSpy).toHaveBeenCalledTimes(1)
    })
  })
})

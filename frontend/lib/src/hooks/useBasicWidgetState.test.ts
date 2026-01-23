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

import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  useBasicWidgetState,
  type ValueWithSource,
} from "./useBasicWidgetState"

// Mock proto interface for testing
interface MockProto {
  formId: string
  setValue: boolean
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
    _fragmentId?: string
  ) => {}
)

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
        })
      )

      // When setValue is true, the hook should use getCurrStateFromProto
      expect(result.current[0]).toBe("url-seeded-value")
    })

    it("uses defaultValue when setValue is false", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
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
        })
      )

      expect(result.current[0]).toEqual([3, 4, 5])
    })

    it("uses defaultValue array when setValue is false", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
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
        })
      )

      expect(result.current[0]).toBe(42)
    })

    it("uses defaultValue when setValue is false", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
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
        })
      )

      expect(result.current[0]).toBe(0)
    })
  })
})

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
const getStateFromWidgetMgr = vi.fn(
  (_wm: WidgetStateManager, _el: MockProto) => undefined
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

  describe("setValue behavior (URL-seeded values)", () => {
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

    it("uses defaultValue when setValue is false and values are equal", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        value: "same-value",
        default: "same-value",
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

      expect(result.current[0]).toBe("same-value")
    })
  })

  describe("React Strict Mode recovery (setValue false but value differs)", () => {
    it("uses currValue when it differs from defaultValue", () => {
      // This simulates React Strict Mode: setValue was cleared by first mount,
      // but element.value still contains the seeded value
      const element: MockProto = {
        formId: "",
        setValue: false,
        value: "seeded-value-from-url",
        default: "widget-default",
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

      // Should use currValue since it differs from default
      expect(result.current[0]).toBe("seeded-value-from-url")
    })
  })

  describe("empty string handling (protobuf default)", () => {
    it("treats empty string as 'no value set' and uses defaultValue", () => {
      // Protobuf sets string fields to "" by default when not explicitly set
      const element: MockProto = {
        formId: "",
        setValue: false,
        value: "", // Empty string from protobuf
        default: "#000000", // Actual widget default (e.g., ColorPicker)
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

      // Empty string should be treated as "no value", so use default
      expect(result.current[0]).toBe("#000000")
    })

    it("uses non-empty currValue when it differs from default", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        value: "user-entered-text",
        default: "",
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

      expect(result.current[0]).toBe("user-entered-text")
    })
  })

  describe("null/undefined handling", () => {
    it("treats null currValue as 'no value set'", () => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        value: null as unknown as string, // Simulating null
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

  describe("array comparison logic", () => {
    it.each([
      {
        desc: "uses defaultValue for empty currValue array",
        currValue: [],
        defaultValue: [1, 2, 3],
        expected: [1, 2, 3],
      },
      {
        desc: "uses currValue when array differs from default",
        currValue: [3, 4],
        defaultValue: [1, 2],
        expected: [3, 4],
      },
      {
        desc: "uses currValue when array length differs",
        currValue: [1, 2, 3],
        defaultValue: [1, 2],
        expected: [1, 2, 3],
      },
      {
        desc: "uses defaultValue when arrays are equal",
        currValue: [1, 2, 3],
        defaultValue: [1, 2, 3],
        expected: [1, 2, 3],
      },
      {
        desc: "handles string arrays - uses currValue when differs",
        currValue: ["option-a", "option-c"],
        defaultValue: ["option-a", "option-b"],
        expected: ["option-a", "option-c"],
      },
    ])("$desc", ({ currValue, defaultValue, expected }) => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        value: currValue,
        default: defaultValue,
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

      expect(result.current[0]).toEqual(expected)
    })
  })

  describe("numeric values", () => {
    it.each([
      {
        desc: "uses currValue when numeric value differs from default",
        currValue: 42,
        defaultValue: 0,
        expected: 42,
      },
      {
        desc: "uses defaultValue when numeric values are equal",
        currValue: 0,
        defaultValue: 0,
        expected: 0,
      },
    ])("$desc", ({ currValue, defaultValue, expected }) => {
      const element: MockProto = {
        formId: "",
        setValue: false,
        value: currValue,
        default: defaultValue,
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

      expect(result.current[0]).toBe(expected)
    })
  })
})

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
import { describe, expect, it } from "vitest"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import useDataFrameCapabilities, {
  LARGE_TABLE_ROWS_THRESHOLD,
} from "./useDataFrameCapabilities"

const { READ_ONLY, DYNAMIC, ADD_ONLY, DELETE_ONLY, FIXED } =
  DataframeProto.EditingMode

describe("useDataFrameCapabilities", () => {
  const defaultParams = {
    editingMode: READ_ONLY,
    disabled: false,
    numDataRows: 10,
    numDataColumns: 5,
  }

  describe("canSort", () => {
    it("returns true for normal read-only tables", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(result.current.canSort).toBe(true)
    })

    it.each([
      ["large tables", { numDataRows: LARGE_TABLE_ROWS_THRESHOLD + 1 }],
      ["empty tables", { numDataRows: 0 }],
      ["DYNAMIC editing mode", { editingMode: DYNAMIC }],
      ["ADD_ONLY editing mode", { editingMode: ADD_ONLY }],
    ])("returns false for %s", (_description, overrides) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({ ...defaultParams, ...overrides })
      )
      expect(result.current.canSort).toBe(false)
    })

    it.each([
      ["DELETE_ONLY", DELETE_ONLY],
      ["FIXED", FIXED],
    ])("returns true for %s editing mode", (_name, editingMode) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode,
        })
      )
      expect(result.current.canSort).toBe(true)
    })
  })

  describe("canSearch", () => {
    it("returns true for non-empty tables", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(result.current.canSearch).toBe(true)
    })

    it("returns false for empty tables", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: 0,
        })
      )
      expect(result.current.canSearch).toBe(false)
    })

    it("returns true for large tables", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: LARGE_TABLE_ROWS_THRESHOLD + 1,
        })
      )
      expect(result.current.canSearch).toBe(true)
    })
  })

  describe("canExportCsv", () => {
    it("returns true for normal tables", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(result.current.canExportCsv).toBe(true)
    })

    it.each([
      ["large tables", { numDataRows: LARGE_TABLE_ROWS_THRESHOLD + 1 }],
      ["empty tables", { numDataRows: 0 }],
    ])("returns false for %s", (_description, overrides) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({ ...defaultParams, ...overrides })
      )
      expect(result.current.canExportCsv).toBe(false)
    })
  })

  describe("canEdit", () => {
    it("returns false for READ_ONLY mode", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(result.current.canEdit).toBe(false)
    })

    it.each([
      ["DYNAMIC", DYNAMIC],
      ["ADD_ONLY", ADD_ONLY],
      ["DELETE_ONLY", DELETE_ONLY],
      ["FIXED", FIXED],
    ])("returns true for %s mode", (_name, editingMode) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode,
        })
      )
      expect(result.current.canEdit).toBe(true)
    })

    it("returns false when disabled", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode: DYNAMIC,
          disabled: true,
        })
      )
      expect(result.current.canEdit).toBe(false)
    })

    it("returns false for empty tables", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode: DYNAMIC,
          numDataRows: 0,
          numDataColumns: 0,
        })
      )
      expect(result.current.canEdit).toBe(false)
    })
  })

  describe("canAddRows", () => {
    it("returns false for READ_ONLY mode", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(result.current.canAddRows).toBe(false)
    })

    it.each([
      ["DYNAMIC", DYNAMIC],
      ["ADD_ONLY", ADD_ONLY],
    ])("returns true for %s mode", (_name, editingMode) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode,
        })
      )
      expect(result.current.canAddRows).toBe(true)
    })

    it.each([
      ["DELETE_ONLY", DELETE_ONLY],
      ["FIXED", FIXED],
    ])("returns false for %s mode", (_name, editingMode) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode,
        })
      )
      expect(result.current.canAddRows).toBe(false)
    })

    it("returns false when disabled", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode: DYNAMIC,
          disabled: true,
        })
      )
      expect(result.current.canAddRows).toBe(false)
    })
  })

  describe("canDeleteRows", () => {
    it("returns false for READ_ONLY mode", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(result.current.canDeleteRows).toBe(false)
    })

    it.each([
      ["DYNAMIC", DYNAMIC],
      ["DELETE_ONLY", DELETE_ONLY],
    ])("returns true for %s mode", (_name, editingMode) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode,
        })
      )
      expect(result.current.canDeleteRows).toBe(true)
    })

    it.each([
      ["ADD_ONLY", ADD_ONLY],
      ["FIXED", FIXED],
    ])("returns false for %s mode", (_name, editingMode) => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode,
        })
      )
      expect(result.current.canDeleteRows).toBe(false)
    })

    it("returns false when disabled", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode: DYNAMIC,
          disabled: true,
        })
      )
      expect(result.current.canDeleteRows).toBe(false)
    })
  })

  describe("empty table detection", () => {
    it("treats zero-row tables as empty when READ_ONLY", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: 0,
        })
      )
      expect(result.current.isEmptyTable).toBe(true)
      expect(result.current.canSort).toBe(false)
      expect(result.current.canSearch).toBe(false)
    })

    it("treats zero-row tables with columns as non-empty in DYNAMIC mode", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: 0,
          numDataColumns: 5,
          editingMode: DYNAMIC,
        })
      )
      expect(result.current.isEmptyTable).toBe(false)
      expect(result.current.canSearch).toBe(true)
      expect(result.current.canAddRows).toBe(true)
    })

    it("treats zero-row tables with columns as non-empty in ADD_ONLY mode", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: 0,
          numDataColumns: 5,
          editingMode: ADD_ONLY,
        })
      )
      expect(result.current.isEmptyTable).toBe(false)
      expect(result.current.canSearch).toBe(true)
      expect(result.current.canAddRows).toBe(true)
    })

    it("treats zero-row/zero-column tables as empty even in DYNAMIC mode", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: 0,
          numDataColumns: 0,
          editingMode: DYNAMIC,
        })
      )
      expect(result.current.isEmptyTable).toBe(true)
      expect(result.current.canSearch).toBe(false)
      expect(result.current.canAddRows).toBe(false)
    })
  })

  describe("large table detection", () => {
    it("returns isLargeTable false for normal tables", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(result.current.isLargeTable).toBe(false)
    })

    it("returns isLargeTable true for tables exceeding threshold", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: LARGE_TABLE_ROWS_THRESHOLD + 1,
        })
      )
      expect(result.current.isLargeTable).toBe(true)
    })

    it("returns isLargeTable false for tables at exactly the threshold", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          numDataRows: LARGE_TABLE_ROWS_THRESHOLD,
        })
      )
      expect(result.current.isLargeTable).toBe(false)
    })
  })

  describe("touch device capabilities", () => {
    it("returns isTouchDevice as boolean and touch-dependent flags are inversely related", () => {
      const { result } = renderHook(() =>
        useDataFrameCapabilities(defaultParams)
      )
      expect(typeof result.current.isTouchDevice).toBe("boolean")
      // canResizeColumns and supportsRectangleSelection are both disabled on touch
      expect(result.current.canResizeColumns).toBe(
        !result.current.isTouchDevice
      )
      expect(result.current.supportsRectangleSelection).toBe(
        !result.current.isTouchDevice
      )
    })

    it("supportsFillHandle requires canEdit and non-touch device", () => {
      // READ_ONLY: canEdit is false, so supportsFillHandle must be false
      const readOnly = renderHook(() =>
        useDataFrameCapabilities({ ...defaultParams, editingMode: READ_ONLY })
      )
      expect(readOnly.result.current.canEdit).toBe(false)
      expect(readOnly.result.current.supportsFillHandle).toBe(false)

      // DYNAMIC + disabled: canEdit is false, so supportsFillHandle must be false
      const disabled = renderHook(() =>
        useDataFrameCapabilities({
          ...defaultParams,
          editingMode: DYNAMIC,
          disabled: true,
        })
      )
      expect(disabled.result.current.canEdit).toBe(false)
      expect(disabled.result.current.supportsFillHandle).toBe(false)

      // DYNAMIC + enabled: supportsFillHandle depends on touch device state
      const editable = renderHook(() =>
        useDataFrameCapabilities({ ...defaultParams, editingMode: DYNAMIC })
      )
      expect(editable.result.current.canEdit).toBe(true)
      expect(editable.result.current.supportsFillHandle).toBe(
        !editable.result.current.isTouchDevice
      )
    })
  })
})

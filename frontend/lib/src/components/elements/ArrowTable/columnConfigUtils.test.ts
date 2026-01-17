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

import { describe, expect, it } from "vitest"

import { INDEX_IDENTIFIER } from "~lib/dataframes/constants"

import {
  ColumnConfig,
  getColumnConfig,
  shouldHideIndex,
} from "./columnConfigUtils"

describe("columnConfigUtils", () => {
  describe("getColumnConfig", () => {
    it("parses valid JSON and returns a Map with column configurations", () => {
      const configJson = JSON.stringify({
        column1: { hidden: true },
        column2: { hidden: false },
        [INDEX_IDENTIFIER]: { hidden: true },
      })

      const result = getColumnConfig(configJson)

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(3)
      expect(result.get("column1")).toEqual({ hidden: true })
      expect(result.get("column2")).toEqual({ hidden: false })
      expect(result.get(INDEX_IDENTIFIER)).toEqual({ hidden: true })
    })

    it("returns empty Map for empty or invalid input", () => {
      expect(getColumnConfig("")).toEqual(new Map())
      expect(getColumnConfig("   ")).toEqual(new Map())
      expect(getColumnConfig("{ invalid json }")).toEqual(new Map())
    })
  })

  describe("shouldHideIndex", () => {
    it("returns true when index is explicitly hidden", () => {
      const columnConfig = new Map<string, ColumnConfig>([
        [INDEX_IDENTIFIER, { hidden: true }],
        ["column1", { hidden: false }],
      ])

      expect(shouldHideIndex(columnConfig)).toBe(true)
    })

    it("returns false when index is not hidden or not configured", () => {
      expect(
        shouldHideIndex(new Map([[INDEX_IDENTIFIER, { hidden: false }]]))
      ).toBe(false)

      expect(shouldHideIndex(new Map([[INDEX_IDENTIFIER, {}]]))).toBe(false)

      expect(shouldHideIndex(new Map([["column1", { hidden: true }]]))).toBe(
        false
      )

      expect(shouldHideIndex(new Map())).toBe(false)
    })
  })
})

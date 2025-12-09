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

import { getDefaultType, isAllType, parseSummaryConfig } from "./summaryUtils"

describe("parseSummaryConfig", () => {
  it("returns null for empty string", () => {
    expect(parseSummaryConfig("")).toBeNull()
  })

  it("returns null for invalid JSON", () => {
    expect(parseSummaryConfig("not valid json")).toBeNull()
  })

  it("parses valid JSON config with static types", () => {
    const config = parseSummaryConfig(
      '{"revenue": {"type": "sum"}, "count": {"type": "count"}}'
    )
    expect(config).toEqual({
      revenue: { type: "sum" },
      count: { type: "count" },
    })
  })

  it("parses single column config", () => {
    const config = parseSummaryConfig('{"sales": {"type": "average"}}')
    expect(config).toEqual({ sales: { type: "average" } })
  })

  it("parses all type config with default", () => {
    const config = parseSummaryConfig(
      '{"revenue": {"type": "all", "default": "sum"}}'
    )
    expect(config).toEqual({ revenue: { type: "all", default: "sum" } })
  })
})

describe("isAllType", () => {
  it("returns true for all type", () => {
    expect(isAllType({ type: "all", default: "count" })).toBe(true)
  })

  it("returns false for static type", () => {
    expect(isAllType({ type: "sum" })).toBe(false)
  })
})

describe("getDefaultType", () => {
  it("returns default for all type", () => {
    expect(getDefaultType({ type: "all", default: "sum" })).toBe("sum")
  })

  it("returns count for all type without default", () => {
    expect(getDefaultType({ type: "all" })).toBe("count")
  })

  it("returns type for static type", () => {
    expect(getDefaultType({ type: "sum" })).toBe("sum")
  })
})

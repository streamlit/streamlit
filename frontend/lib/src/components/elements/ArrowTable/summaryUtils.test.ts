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

import { parseSummaryConfig } from "./summaryUtils"

describe("parseSummaryConfig", () => {
  it("returns null for empty string", () => {
    expect(parseSummaryConfig("")).toBeNull()
  })

  it("returns null for invalid JSON", () => {
    expect(parseSummaryConfig("not valid json")).toBeNull()
  })

  it("parses valid JSON config", () => {
    const config = parseSummaryConfig('{"revenue": "sum", "count": "count"}')
    expect(config).toEqual({ revenue: "sum", count: "count" })
  })

  it("parses single column config", () => {
    const config = parseSummaryConfig('{"sales": "average"}')
    expect(config).toEqual({ sales: "average" })
  })
})

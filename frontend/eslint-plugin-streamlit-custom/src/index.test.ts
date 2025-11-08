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

import plugin from "./index"

describe("eslint-plugin-streamlit-custom", () => {
  it("should export rules", () => {
    expect(plugin).toHaveProperty("rules")

    const EXPECTED_RULES = [
      "use-strict-null-equality-checks",
      "no-hardcoded-theme-values",
      "enforce-memo",
      "no-force-reflow-access",
    ]

    expect(Object.keys(plugin.rules)).toHaveLength(EXPECTED_RULES.length)

    EXPECTED_RULES.forEach(ruleName => {
      expect(plugin.rules).toHaveProperty(ruleName)
    })
  })

  it("should have correct rule structure", () => {
    const ruleNames = Object.keys(plugin.rules)

    ruleNames.forEach(ruleName => {
      const rule = plugin.rules[ruleName as keyof typeof plugin.rules]
      expect(rule).toHaveProperty("meta")
      expect(rule).toHaveProperty("create")
      expect(rule.meta).toHaveProperty("type")
      expect(rule.meta).toHaveProperty("docs")
      expect(rule.meta).toHaveProperty("schema")
      expect(rule.meta).toHaveProperty("messages")
    })
  })
})

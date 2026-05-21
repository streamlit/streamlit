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

import { mockTheme } from "~lib/mocks/mockTheme"

import { generateToastOverrides } from "./Toast"

describe("generateToastOverrides", () => {
  it("adds theme CSS variables to the toast portal body", () => {
    const overrides = generateToastOverrides(mockTheme.emotion)
    const bodyStyles = overrides.Body?.style as Record<string, string>

    expect(bodyStyles["--st-color-bg"]).toBe(mockTheme.emotion.colors.bgColor)
    expect(bodyStyles["--st-color-primary"]).toBe(
      mockTheme.emotion.colors.primary
    )
    expect(bodyStyles["--st-shadow-focus-ring"]).toBe(
      mockTheme.emotion.shadows.focusRing
    )
  })
})

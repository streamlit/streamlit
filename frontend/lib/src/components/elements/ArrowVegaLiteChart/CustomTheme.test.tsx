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

import { transparentize } from "color2k"

import { mockTheme } from "~lib/mocks/mockTheme"
import { createEmotionColors } from "~lib/theme/getColors"

import { applyStreamlitTheme, applyThemeDefaults } from "./CustomTheme"

const theme = mockTheme.emotion
const customTextTheme = {
  ...theme,
  colors: createEmotionColors({ ...theme.colors, bodyText: "#D6246E" }),
}

describe("ArrowVegaLiteChart CustomTheme", () => {
  describe("applyStreamlitTheme", () => {
    it("derives text and line colors from the theme text color", () => {
      const config = applyStreamlitTheme(undefined, customTextTheme) as Record<
        string,
        Record<string, unknown>
      >
      const fadedText70 = transparentize("#D6246E", 0.3)
      const fadedText05 = transparentize("#D6246E", 0.9)

      expect(config.axis.labelColor).toBe(fadedText70)
      expect(config.legend.titleColor).toBe(fadedText70)
      expect(config.header.labelColor).toBe(fadedText70)
      expect(config.axis.gridColor).toBe(fadedText05)
      expect(config.axis.domainColor).toBe(fadedText05)
    })
  })

  describe("applyThemeDefaults", () => {
    it("uses the theme text color for text and faded text for lines", () => {
      const config = applyThemeDefaults(undefined, customTextTheme) as Record<
        string,
        Record<string, unknown>
      >

      expect(config.axis.labelColor).toBe("#D6246E")
      expect(config.axis.gridColor).toBe(transparentize("#D6246E", 0.9))
      expect(config.view.stroke).toBe(transparentize("#D6246E", 0.9))
    })
  })
})

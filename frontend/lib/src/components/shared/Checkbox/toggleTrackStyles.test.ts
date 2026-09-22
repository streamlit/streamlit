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

import { darkTheme, lightTheme } from "~lib/theme/themeConfigs"
import { createEmotionTheme } from "~lib/theme/utils"

import { getToggleTrackColors } from "./toggleTrackStyles"

describe("getToggleTrackColors", () => {
  it.each([
    ["light", lightTheme.emotion],
    ["dark", darkTheme.emotion],
  ] as const)(
    "uses fadedText10 for off rest so custom borderColor does not bleed (%s theme)",
    (_name, theme) => {
      expect(
        getToggleTrackColors(theme, {
          isSelected: false,
          isHovered: false,
          isDisabled: false,
        })
      ).toBe(theme.colors.fadedText10)
      expect(theme.colors.fadedText10).toBe(theme.colors.borderColor)
    }
  )

  it("uses darkenedBgMix15 for off hover, matching radio/checkbox", () => {
    const theme = lightTheme.emotion

    expect(
      getToggleTrackColors(theme, {
        isSelected: false,
        isHovered: true,
        isDisabled: false,
      })
    ).toBe(theme.colors.darkenedBgMix15)
  })

  it("uses primary when selected, including while hovered", () => {
    const theme = lightTheme.emotion

    expect(
      getToggleTrackColors(theme, {
        isSelected: true,
        isHovered: true,
        isDisabled: false,
      })
    ).toBe(theme.colors.primary)
  })

  it("ignores hover when disabled and keeps fadedText10", () => {
    const theme = lightTheme.emotion

    expect(
      getToggleTrackColors(theme, {
        isSelected: false,
        isHovered: true,
        isDisabled: true,
      })
    ).toBe(theme.colors.fadedText10)
    expect(
      getToggleTrackColors(theme, {
        isSelected: true,
        isHovered: true,
        isDisabled: true,
      })
    ).toBe(theme.colors.fadedText10)
  })

  it("does not follow a custom theme.borderColor for the off track", () => {
    const theme = createEmotionTheme({ borderColor: "#00008B" })

    expect(
      getToggleTrackColors(theme, {
        isSelected: false,
        isHovered: false,
        isDisabled: false,
      })
    ).toBe(theme.colors.fadedText10)
    expect(theme.colors.fadedText10).not.toBe(theme.colors.borderColor)
  })
})

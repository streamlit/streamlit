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

import { getCheckboxIndicatorColors } from "./checkboxIndicatorStyles"

describe("getCheckboxIndicatorColors", () => {
  it.each([
    ["light", lightTheme.emotion],
    ["dark", darkTheme.emotion],
  ] as const)(
    "uses secondary-button colours for unchecked rest and hover (%s theme)",
    (_name, theme) => {
      const rest = getCheckboxIndicatorColors(theme, {
        isSelected: false,
        isHovered: false,
        isDisabled: false,
      })
      const hovered = getCheckboxIndicatorColors(theme, {
        isSelected: false,
        isHovered: true,
        isDisabled: false,
      })

      expect(rest).toEqual({
        borderColor: theme.colors.borderColor,
        backgroundColor: theme.colors.lightenedBg05,
      })
      expect(hovered).toEqual({
        borderColor: theme.colors.borderColor,
        backgroundColor: theme.colors.darkenedBgMix15,
      })
    }
  )

  it("uses primary fill when selected, including while hovered", () => {
    const theme = lightTheme.emotion
    expect(
      getCheckboxIndicatorColors(theme, {
        isSelected: true,
        isHovered: true,
        isDisabled: false,
      })
    ).toEqual({
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    })
  })

  it("dims the fill when disabled", () => {
    const theme = lightTheme.emotion
    expect(
      getCheckboxIndicatorColors(theme, {
        isSelected: true,
        isHovered: false,
        isDisabled: true,
      })
    ).toEqual({
      borderColor: theme.colors.borderColor,
      backgroundColor: theme.colors.fadedText40,
    })
    expect(
      getCheckboxIndicatorColors(theme, {
        isSelected: false,
        isHovered: true,
        isDisabled: true,
      })
    ).toEqual({
      borderColor: theme.colors.borderColor,
      backgroundColor: theme.colors.lightenedBg05,
    })
  })
})

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

import { createThemeCssVariables } from "./getThemeCssVariables"
import { darkTheme, lightTheme } from "./themeConfigs"
import { themeCssVariableNames } from "./themeCssVariables"

describe("createThemeCssVariables", () => {
  it("creates fallback theme variables for light themes", () => {
    const cssVariables = createThemeCssVariables(lightTheme.emotion)

    themeCssVariableNames.forEach(cssVariableKey => {
      expect(cssVariables[cssVariableKey]).toBeTruthy()
    })

    expect(cssVariables["--st-color-bg"]).toBe(
      lightTheme.emotion.colors.bgColor
    )
    expect(cssVariables["--st-color-primary"]).toBe(
      lightTheme.emotion.colors.primary
    )
    expect(cssVariables["--st-shadow-focus-ring"]).toBe(
      lightTheme.emotion.shadows.focusRing
    )
    expect(cssVariables["@supports"]).toEqual(
      expect.objectContaining({
        "color: color-mix(in srgb, red 50%, transparent)":
          expect.objectContaining({
            "--st-color-primary-hover": expect.stringContaining(
              lightTheme.emotion.vars.colors.primary
            ),
            "--st-color-body-text-dim": expect.stringContaining(
              `${lightTheme.emotion.vars.colors.bodyText} 80%`
            ),
          }),
      })
    )
  })

  it("exposes typed CSS variable references on the theme", () => {
    expect(Object.isFrozen(lightTheme.emotion.vars)).toBe(true)
    expect(Object.isFrozen(lightTheme.emotion.vars.colors)).toBe(true)
    expect(lightTheme.emotion.vars.colors.bgColor).toBe("var(--st-color-bg)")
    expect(lightTheme.emotion.vars.colors.bgColorTransparent).toBe(
      "var(--st-color-bg-transparent)"
    )
    expect(lightTheme.emotion.vars.colors.borderColor).toBe(
      "var(--st-color-border)"
    )
    expect(lightTheme.emotion.vars.colors.primaryHover).toBe(
      "var(--st-color-primary-hover)"
    )
    expect(lightTheme.emotion.vars.shadows.focusRing).toBe(
      "var(--st-shadow-focus-ring)"
    )
  })

  it("uses the dark-theme body text opacity fallback for dark themes", () => {
    const cssVariables = createThemeCssVariables(darkTheme.emotion)
    const supportsRule = cssVariables["@supports"] as Record<string, unknown>
    const colorMixVariables = supportsRule[
      "color: color-mix(in srgb, red 50%, transparent)"
    ] as Record<string, string>

    expect(colorMixVariables["--st-color-body-text-dim"]).toContain(
      `${darkTheme.emotion.vars.colors.bodyText} 75%`
    )
  })
})

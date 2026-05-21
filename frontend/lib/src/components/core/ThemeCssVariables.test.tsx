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

import { render, screen } from "@testing-library/react"

import { RootStyleProvider } from "~lib/RootStyleProvider"
import { darkTheme, lightTheme } from "~lib/theme/themeConfigs"

import ThemeProvider from "./ThemeProvider"

function getEmotionStyles(): string {
  return Array.from(document.querySelectorAll("style[data-emotion]"))
    .map(style => style.textContent ?? "")
    .join("\n")
}

describe("ThemeCssVariables", () => {
  it("applies root theme variables globally and nested theme variables to subtrees", () => {
    render(
      <RootStyleProvider theme={lightTheme}>
        <div data-testid="root-probe">Root scope</div>
        <ThemeProvider
          theme={darkTheme.emotion}
          baseuiTheme={darkTheme.basewebTheme}
        >
          <div data-testid="nested-probe">Nested scope</div>
        </ThemeProvider>
      </RootStyleProvider>
    )

    const styles = getEmotionStyles()
    const rootScope = screen.getByTestId("root-probe").parentElement
    const nestedScope = screen.getByTestId("nested-probe").parentElement

    expect(styles).toContain(":root")
    expect(styles).toContain(
      `--st-color-bg:${lightTheme.emotion.colors.bgColor}`
    )
    expect(styles).toContain(
      `--st-color-bg:${darkTheme.emotion.colors.bgColor}`
    )
    expect(styles).toContain("display:contents")

    expect(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--st-color-bg")
        .trim()
    ).toBe(lightTheme.emotion.colors.bgColor)
    expect(rootScope).not.toBeNull()
    expect(nestedScope).not.toBeNull()
    expect(
      window
        .getComputedStyle(rootScope as HTMLElement)
        .getPropertyValue("--st-color-bg")
    ).toBe(lightTheme.emotion.colors.bgColor)
    expect(
      window
        .getComputedStyle(nestedScope as HTMLElement)
        .getPropertyValue("--st-color-bg")
    ).toBe(darkTheme.emotion.colors.bgColor)
    expect(window.getComputedStyle(nestedScope as HTMLElement).display).toBe(
      "contents"
    )
  })
})

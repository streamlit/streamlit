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

import { describe, expect, it } from "vitest"

import { darkTheme, lightTheme } from "~lib/theme/themeConfigs"

import {
  createStreamlitPerspectiveTheme,
  resolvePerspectiveThemeName,
  STREAMLIT_PERSPECTIVE_MENU_SELECTOR,
  STREAMLIT_PERSPECTIVE_THEME_NAME,
  STREAMLIT_PERSPECTIVE_VIEWER_SELECTOR,
} from "./streamlitTheme"

describe("Streamlit Perspective theme", () => {
  it("resolves the public streamlit theme alias", () => {
    expect(resolvePerspectiveThemeName("streamlit")).toBe(
      STREAMLIT_PERSPECTIVE_THEME_NAME
    )
    expect(resolvePerspectiveThemeName("Pro Dark")).toBe("Pro Dark")
  })

  it("maps Streamlit light theme colors into Perspective variables", () => {
    const styles = createStreamlitPerspectiveTheme(
      lightTheme.emotion
    ) as Record<string, Record<string, string>>
    const viewerStyles = styles[STREAMLIT_PERSPECTIVE_VIEWER_SELECTOR]
    const menuStyles = styles[STREAMLIT_PERSPECTIVE_MENU_SELECTOR]

    expect(viewerStyles["--psp-theme-name"]).toBe('"Streamlit"')
    expect(viewerStyles["--psp-active--color"]).toBe(
      lightTheme.emotion.colors.primary
    )
    expect(viewerStyles["--psp-d3fc--series-1--color"]).toBe(
      lightTheme.emotion.colors.chartCategoricalColors[0]
    )
    expect(viewerStyles["--psp-calendar--filter"]).toBe("none")
    expect(menuStyles.border).toBe(
      `${lightTheme.emotion.sizes.borderWidth} solid ${lightTheme.emotion.colors.borderColor}`
    )
  })

  it("switches icon and calendar treatments for dark themes", () => {
    const styles = createStreamlitPerspectiveTheme(
      darkTheme.emotion
    ) as Record<string, Record<string, string>>
    const viewerStyles = styles[STREAMLIT_PERSPECTIVE_VIEWER_SELECTOR]

    expect(viewerStyles["--psp-calendar--filter"]).toBe("invert(1)")
    expect(viewerStyles["--psp-icon--select-arrow--mask-image"]).toBe(
      "var(--psp-icon--select-arrow-light--mask-image)"
    )
    expect(viewerStyles["--psp-datagrid--neg-cell--color"]).toBe(
      darkTheme.emotion.colors.redTextColor
    )
  })
})

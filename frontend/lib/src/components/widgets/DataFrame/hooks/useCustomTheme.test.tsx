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

import { renderHook } from "@testing-library/react"
import { parseToRgba } from "color2k"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"

import useCustomTheme from "./useCustomTheme"

/**
 * Get the alpha channel of a color (0-1). Fully opaque colors return 1.
 */
function getAlpha(color: string): number {
  const [, , , a] = parseToRgba(color)
  return a
}

describe("useCustomTheme hook", () => {
  it("returns fully opaque header background colors even when the configured header background has an alpha channel (#11950)", () => {
    // Simulate the user's config from the bug report: a header background
    // color with an alpha channel ("#FF00001a" = rgba(255, 0, 0, 0.1)).
    const themeWithAlphaHeader = {
      ...mockTheme.emotion,
      colors: {
        ...mockTheme.emotion.colors,
        dataframeHeaderBackgroundColor: "#FF00001a",
      },
    }

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode
    }): JSX.Element => (
      <ThemeProvider theme={themeWithAlphaHeader}>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useCustomTheme(), { wrapper })
    const { bgHeader, bgHeaderHovered, bgHeaderHasFocus } =
      result.current.glideTheme

    // All three header background colors must be fully opaque so
    // glide-data-grid's canvas doesn't stack semi-transparent fills
    // between paints, which is what caused the flicker in #11950.
    expect(getAlpha(bgHeader as string)).toBe(1)
    expect(getAlpha(bgHeaderHovered as string)).toBe(1)
    expect(getAlpha(bgHeaderHasFocus as string)).toBe(1)

    // Also lock in the actual composited color: #FF00001a (rgba 255,0,0,0.1)
    // over the mockTheme bgColor (#ffffff) yields #ffe5e5 per the blend()
    // formula. Guards against future regressions in the color math.
    expect(bgHeader).toBe("#ffe5e5")
  })

  it("returns fully opaque header background colors for the default theme", () => {
    const wrapper = ({
      children,
    }: {
      children: React.ReactNode
    }): JSX.Element => (
      <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useCustomTheme(), { wrapper })
    const { bgHeader, bgHeaderHovered, bgHeaderHasFocus } =
      result.current.glideTheme

    expect(getAlpha(bgHeader as string)).toBe(1)
    expect(getAlpha(bgHeaderHovered as string)).toBe(1)
    expect(getAlpha(bgHeaderHasFocus as string)).toBe(1)
  })

  it("returns fully opaque header background colors even when the app bgColor itself has an alpha channel (#11950)", () => {
    // Users can configure theme.backgroundColor with alpha (the config is
    // a plain string with no opacity guard). In that case, blending the
    // header color against a translucent bgColor would leave residual
    // alpha and reintroduce the canvas-stacking bug. The fix composites
    // bgColor over opaque white first, so the canvas backdrop is always
    // opaque before header colors layer on top.
    const themeWithAlphaBg = {
      ...mockTheme.emotion,
      colors: {
        ...mockTheme.emotion.colors,
        bgColor: "#00000080", // rgba(0, 0, 0, 0.5)
        dataframeHeaderBackgroundColor: "#FF00001a",
      },
    }

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode
    }): JSX.Element => (
      <ThemeProvider theme={themeWithAlphaBg}>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useCustomTheme(), { wrapper })
    const { bgHeader, bgHeaderHovered, bgHeaderHasFocus } =
      result.current.glideTheme

    expect(getAlpha(bgHeader as string)).toBe(1)
    expect(getAlpha(bgHeaderHovered as string)).toBe(1)
    expect(getAlpha(bgHeaderHasFocus as string)).toBe(1)
  })

  it("keeps bgButtonHovered independent of dataframeHeaderBackgroundColor customizations", () => {
    // Regression guard: the pre-#11950 code piped a translucent overlay
    // through bgHeaderHovered, which was also consumed by body-cell
    // secondary-button hovers in ButtonCell. Now bgHeaderHovered is
    // opaque + header-tinted, and body-cell buttons read the separate
    // bgButtonHovered key. Customizing dataframeHeaderBackgroundColor
    // must not change bgButtonHovered.
    const defaultWrapper = ({
      children,
    }: {
      children: React.ReactNode
    }): JSX.Element => (
      <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
    )
    const { result: defaultResult } = renderHook(() => useCustomTheme(), {
      wrapper: defaultWrapper,
    })
    const defaultButtonHover = (
      defaultResult.current.glideTheme as unknown as {
        bgButtonHovered: string
      }
    ).bgButtonHovered

    const themeWithAlphaHeader = {
      ...mockTheme.emotion,
      colors: {
        ...mockTheme.emotion.colors,
        dataframeHeaderBackgroundColor: "#FF00001a",
      },
    }
    const customWrapper = ({
      children,
    }: {
      children: React.ReactNode
    }): JSX.Element => (
      <ThemeProvider theme={themeWithAlphaHeader}>{children}</ThemeProvider>
    )
    const { result: customResult } = renderHook(() => useCustomTheme(), {
      wrapper: customWrapper,
    })
    const customButtonHover = (
      customResult.current.glideTheme as unknown as {
        bgButtonHovered: string
      }
    ).bgButtonHovered

    expect(customButtonHover).toBe(defaultButtonHover)
    // And it must differ from bgHeaderHovered when the header has a
    // custom color, otherwise there is no decoupling.
    expect(customButtonHover).not.toBe(customResult.current.glideTheme.bgHeaderHovered)
  })
})

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

import { createElement } from "react"

import { vi } from "vitest"

import { render } from "~lib/test_util"
import { darkTheme, lightTheme } from "~lib/theme/themeConfigs"

import {
  bindVegaRangeProgress,
  getVegaBindingStyles,
  StyledVegaLiteChartContainer,
  syncVegaRangeProgress,
  VEGA_RANGE_PROGRESS_VAR,
} from "./styled-components"

describe("getVegaBindingStyles", () => {
  it.each([
    ["light", lightTheme.emotion],
    ["dark", darkTheme.emotion],
  ])(
    "uses Streamlit font, accent, and the %s color-scheme",
    (colorScheme, theme) => {
      const styles = getVegaBindingStyles(theme)

      expect(styles.fontFamily).toBe(theme.genericFonts.bodyFont)
      expect(styles.fontSize).toBe(theme.fontSizes.sm)
      expect(styles.color).toBe(theme.colors.bodyText)
      expect(styles.accentColor).toBe(theme.colors.primary)
      expect(styles.colorScheme).toBe(colorScheme)
    }
  )

  it("reuses the same style object for a given theme", () => {
    const light = lightTheme.emotion
    const dark = darkTheme.emotion
    expect(getVegaBindingStyles(light)).toBe(getVegaBindingStyles(light))
    expect(getVegaBindingStyles(dark)).toBe(getVegaBindingStyles(dark))
    expect(getVegaBindingStyles(light)).not.toBe(getVegaBindingStyles(dark))
  })

  it("styles Vega bind labels, selects, and range value readouts", () => {
    const theme = lightTheme.emotion
    const styles = getVegaBindingStyles(theme)

    expect(styles).toEqual(
      expect.objectContaining({
        "& .vega-bind-name": expect.objectContaining({
          fontSize: theme.fontSizes.sm,
          color: theme.colors.bodyText,
          minWidth: "8em",
        }),
        "& select": expect.objectContaining({
          backgroundColor: theme.colors.secondaryBg,
          borderRadius: theme.radii.default,
          color: theme.colors.bodyText,
        }),
        "& input[type='text'], & input[type='number'], & input[type='search'], & input[type='date'], & input[type='time'], & input[type='datetime-local'], & input[type='month'], & input[type='week']":
          expect.objectContaining({
            backgroundColor: theme.colors.secondaryBg,
            borderRadius: theme.radii.default,
            color: theme.colors.bodyText,
          }),
        "& input[type='range']": expect.objectContaining({
          appearance: "none",
          backgroundColor: "transparent",
          "&::-webkit-slider-runnable-track": expect.objectContaining({
            background: expect.stringContaining(theme.colors.darkenedBgMix25),
          }),
          "&::-moz-range-track": expect.objectContaining({
            backgroundColor: theme.colors.darkenedBgMix25,
          }),
        }),
        "& input[type='range'] + span": expect.objectContaining({
          color: theme.colors.fadedText60,
        }),
        "&:not(:has(.vega-bind))": expect.objectContaining({
          display: "none",
        }),
      })
    )
  })
})

describe("syncVegaRangeProgress", () => {
  const makeRange = (
    min: string,
    max: string,
    value: string
  ): HTMLInputElement => {
    const input = document.createElement("input")
    input.type = "range"
    input.min = min
    input.max = max
    input.value = value
    return input
  }

  it.each([
    ["1970", "1980", "1975", "50%"],
    ["0", "10", "0", "0%"],
    ["0", "10", "10", "100%"],
    ["5", "5", "5", "0%"],
  ])("maps min=%s max=%s value=%s to %s", (min, max, value, expected) => {
    const input = makeRange(min, max, value)
    syncVegaRangeProgress(input)
    expect(input.style.getPropertyValue(VEGA_RANGE_PROGRESS_VAR)).toBe(
      expected
    )
  })
})

describe("bindVegaRangeProgress", () => {
  it("syncs existing ranges and updates on input", () => {
    const root = document.createElement("div")
    const input = document.createElement("input")
    input.type = "range"
    input.min = "0"
    input.max = "4"
    input.value = "1"
    root.appendChild(input)

    const unbind = bindVegaRangeProgress(root)
    expect(input.style.getPropertyValue(VEGA_RANGE_PROGRESS_VAR)).toBe("25%")

    input.value = "3"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(input.style.getPropertyValue(VEGA_RANGE_PROGRESS_VAR)).toBe("75%")

    unbind()
    input.value = "0"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(input.style.getPropertyValue(VEGA_RANGE_PROGRESS_VAR)).toBe("75%")
  })

  it("does not attach an input listener when there are no range bindings", () => {
    const root = document.createElement("div")
    const addSpy = vi.spyOn(root, "addEventListener")
    const removeSpy = vi.spyOn(root, "removeEventListener")

    const unbind = bindVegaRangeProgress(root)
    expect(addSpy).not.toHaveBeenCalled()

    unbind()
    expect(removeSpy).not.toHaveBeenCalled()
  })
})

describe("StyledVegaLiteChartContainer print layout", () => {
  it("fits an svg or canvas chart into its column when printing", () => {
    const before = document.querySelectorAll("style").length
    render(
      createElement(StyledVegaLiteChartContainer, {
        useContainerWidth: true,
        useContainerHeight: false,
        isSizeContained: false,
        hasFallbackHeight: false,
      })
    )
    const css = [...document.querySelectorAll("style")]
      .slice(before)
      .map(style => style.textContent ?? "")
      .join("\n")

    expect(css).toContain("@media print")
    expect(css).toContain("svg.marks")
    expect(css).toContain("canvas.marks")
  })

  it.each([
    [true, false, false, true],
    [true, true, false, false],
    [true, false, true, false],
    [false, false, false, false],
  ])(
    "scales a stretch-width chart up to a limit (width %s, container height %s, contained %s)",
    (useContainerWidth, useContainerHeight, isSizeContained, scalesUp) => {
      const { container } = render(
        createElement(StyledVegaLiteChartContainer, {
          useContainerWidth,
          useContainerHeight,
          isSizeContained,
          hasFallbackHeight: false,
        })
      )
      const classNames = [
        ...(container.firstElementChild?.classList ?? []),
      ].filter(className => className.startsWith("css-"))
      const css = [...document.querySelectorAll("style")]
        .map(style => style.textContent ?? "")
        .filter(rule =>
          classNames.some(className => rule.includes(`.${className}`))
        )
        .join("\n")

      const upscaleRule =
        "width:min(100%, calc(var(--st-print-screen-width, 100%) * 1.25))!important;height:auto!important"
      expect(css.includes(upscaleRule)).toBe(scalesUp)
    }
  )
})

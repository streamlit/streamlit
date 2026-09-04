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

import { CSSObject } from "@emotion/react"
import styled from "@emotion/styled"
import { transparentize } from "color2k"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"

/**
 * WebKit has no filled-range pseudo-element, so the track gradient is driven
 * by this 0-100% stop, updated from the input's value.
 */
export const VEGA_RANGE_PROGRESS_VAR = "--vega-range-progress"

export const syncVegaRangeProgress = (input: HTMLInputElement): void => {
  // HTML range defaults: min 0, max 100, value = midpoint. Empty `value` is a
  // defensive fallback to min; it is not the platform default.
  const min = input.min === "" ? 0 : Number(input.min)
  const max = input.max === "" ? 100 : Number(input.max)
  const value = input.value === "" ? min : Number(input.value)
  const span = max - min
  const isValid =
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    Number.isFinite(value) &&
    span !== 0
  const pct = isValid ? ((value - min) / span) * 100 : 0
  input.style.setProperty(
    VEGA_RANGE_PROGRESS_VAR,
    `${Math.min(100, Math.max(0, pct))}%`
  )
}

/**
 * Keeps WebKit range fills in sync with input value via `--vega-range-progress`.
 * Syncs ranges present at bind time and subsequent user `input` events.
 * Programmatic Vega writes (`view.signal(...).run()`, expression-driven
 * params) set the DOM value without dispatching `input`, so the WebKit fill
 * can go stale; Firefox uses `::-moz-range-progress` and does not need this.
 * Call after vega-embed creates the bindings form; invoke the return value
 * before Vega's finalize so the delegated input listener is removed.
 */
export const bindVegaRangeProgress = (root: HTMLElement): (() => void) => {
  const ranges = root.querySelectorAll<HTMLInputElement>("input[type='range']")
  if (ranges.length === 0) {
    return () => {}
  }

  const onInput = (event: Event): void => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.type === "range"
    ) {
      syncVegaRangeProgress(event.target)
    }
  }
  ranges.forEach(syncVegaRangeProgress)
  root.addEventListener("input", onInput)
  return () => root.removeEventListener("input", onInput)
}

/**
 * Styles Vega's native parameter-binding widgets (`form.vega-bindings`).
 * Streamlit disables vega-embed's default CSS, so without this they render
 * as unstyled browser controls. Uses Streamlit fonts, colors, radius, and
 * focus treatment rather than replacing the native controls.
 */
const vegaBindingStylesCache = new WeakMap<EmotionTheme, CSSObject>()

export const getVegaBindingStyles = (theme: EmotionTheme): CSSObject => {
  const cached = vegaBindingStylesCache.get(theme)
  if (cached) {
    return cached
  }

  const controlBorderColor =
    theme.colors.widgetBorderColor ?? theme.colors.secondaryBg
  const rangeFill = `var(${VEGA_RANGE_PROGRESS_VAR}, 0%)`
  const rangeTrackBackground = `linear-gradient(to right, ${theme.colors.primary} ${rangeFill}, ${theme.colors.darkenedBgMix25} ${rangeFill})`
  const rangeTrackGeometry: CSSObject = {
    height: theme.spacing.twoXS,
    border: "none",
    borderRadius: theme.radii.full,
  }
  const rangeThumbStyles: CSSObject = {
    appearance: "none",
    WebkitAppearance: "none",
    width: theme.sizes.sliderThumb,
    height: theme.sizes.sliderThumb,
    border: "none",
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    boxShadow: theme.shadows.none,
    cursor: "pointer",
  }
  const textControlStyles: CSSObject = {
    fontFamily: "inherit",
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    backgroundColor: theme.colors.secondaryBg,
    border: `${theme.sizes.borderWidth} solid ${controlBorderColor}`,
    borderRadius: theme.radii.default,
    padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
    lineHeight: theme.lineHeights.inputWidget,
    margin: theme.spacing.none,
    maxWidth: "100%",
    transitionDuration: "200ms",
    transitionProperty: "border, box-shadow",
    transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.4, 1)",
    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      outline: "none",
      borderColor: theme.colors.primary,
      boxShadow: theme.shadows.focusRing,
    },
  }

  const styles: CSSObject = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    margin: theme.spacing.none,
    padding: theme.spacing.none,
    paddingTop: theme.spacing.sm,
    border: "none",
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    // Native range/checkbox/radio/select widgets follow the document
    // color-scheme; without this they stay light-themed on a dark app.
    colorScheme: hasLightBackgroundColor(theme) ? "light" : "dark",
    accentColor: theme.colors.primary,
    // Vega always mounts an empty bindings form. Hide it so padding doesn't
    // inflate charts that have no parameter widgets.
    "&:not(:has(.vega-bind))": {
      display: "none",
    },

    "& .vega-bind": {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      width: "100%",
    },

    "& .vega-bind label": {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      margin: theme.spacing.none,
      cursor: "pointer",
    },

    "& .vega-bind-name": {
      fontSize: theme.fontSizes.sm,
      fontWeight: theme.fontWeights.normal,
      lineHeight: theme.lineHeights.small,
      color: theme.colors.bodyText,
      flexShrink: 0,
      // Keep labels a consistent width so sliders, selects, and radios line up.
      minWidth: "8em",
    },

    "& select": {
      ...textControlStyles,
      cursor: "pointer",
    },

    // Vega copies the bind `input` type onto a generic <input>. Style
    // text-like types (text, number, search, ...) to match Streamlit inputs;
    // range/checkbox/radio/color have more specific rules below.
    "& input:not([type='range']):not([type='checkbox']):not([type='radio']):not([type='color']):not([type='file']):not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset'])":
      textControlStyles,

    "& input[type='color']": {
      height: theme.sizes.smallElementHeight,
      width: theme.sizes.smallElementHeight,
      padding: theme.spacing.threeXS,
      backgroundColor: theme.colors.secondaryBg,
      border: `${theme.sizes.borderWidth} solid ${controlBorderColor}`,
      borderRadius: theme.radii.default,
      cursor: "pointer",
    },

    "& input[type='range']": {
      // Override the native track; accent-color fills are nearly black in Chrome light mode.
      appearance: "none",
      WebkitAppearance: "none",
      width: "12em",
      maxWidth: "100%",
      height: theme.sizes.sliderThumb,
      margin: theme.spacing.none,
      padding: theme.spacing.none,
      backgroundColor: "transparent",
      cursor: "pointer",
      "&:focus": {
        outline: "none",
      },
      "&:focus-visible": {
        outline: `${theme.sizes.focusOutlineWidth} solid ${theme.colors.primary}`,
        outlineOffset: theme.spacing.threeXS,
      },
      "&::-webkit-slider-runnable-track": {
        ...rangeTrackGeometry,
        background: rangeTrackBackground,
      },
      "&::-webkit-slider-thumb": {
        ...rangeThumbStyles,
        // Center the thumb on the track.
        marginTop: `calc((${theme.spacing.twoXS} - ${theme.sizes.sliderThumb}) / 2)`,
      },
      "&::-moz-range-track": {
        ...rangeTrackGeometry,
        backgroundColor: theme.colors.darkenedBgMix25,
      },
      "&::-moz-range-progress": {
        ...rangeTrackGeometry,
        backgroundColor: theme.colors.primary,
      },
      "&::-moz-range-thumb": rangeThumbStyles,
    },

    // Vega appends an unclassed <span> with the current slider value.
    "& input[type='range'] + span": {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.fadedText60,
      lineHeight: theme.lineHeights.small,
      minWidth: "3em",
    },

    "& input[type='checkbox'], & input[type='radio']": {
      margin: theme.spacing.none,
      cursor: "pointer",
      accentColor: theme.colors.primary,
      width: theme.sizes.checkbox,
      height: theme.sizes.checkbox,
    },

    "& .vega-bind-radio": {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: theme.spacing.md,
    },
  }

  vegaBindingStylesCache.set(theme, styles)
  return styles
}

export const StyledVegaLiteChartTooltips = (
  theme: EmotionTheme
): CSSObject => ({
  "#vg-tooltip-element": {
    visibility: "hidden",
    position: "fixed",
    fontFamily: theme.genericFonts.bodyFont,
    color: theme.colors.bodyText,
    border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
    backgroundColor: transparentize(theme.colors.bgColor, 0.05),
    fontSize: theme.fontSizes.twoSm,
    boxShadow: theme.shadows.tooltip,
    maxWidth: theme.sizes.maxChartTooltipWidth,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.radii.default,
    // Use popup z-index for tooltips so they appear above most content
    zIndex: theme.zIndices.popup,

    "&.visible": {
      visibility: "visible",
    },

    h2: {
      marginTop: theme.spacing.none,
      marginBottom: theme.spacing.sm,
      fontSize: theme.fontSizes.sm,
    },

    td: {
      border: "none",
    },

    table: {
      borderSpacing: 0,

      tr: {
        border: "none",

        td: {
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingTop: theme.spacing.threeXS,
          paddingBottom: theme.spacing.threeXS,
        },

        "td.key": {
          // This should use a max of 40% of the available width (- padding):
          maxWidth: `calc((${theme.sizes.maxChartTooltipWidth} - 2 * ${theme.spacing.md}) * 0.4)`,
          textAlign: "right",
          color: theme.colors.fadedText60,
          whiteSpace: "nowrap",
          paddingRight: theme.spacing.twoXS,
        },

        "td.value": {
          // This should use a max of 60% of the available width (- padding):
          maxWidth: `calc((${theme.sizes.maxChartTooltipWidth} - 2 * ${theme.spacing.md}) * 0.6)`,
          textAlign: "left",
          // We are limiting the height of the value to a max of 5 lines via
          // the a webkit property that is supported by all major browsers:
          // https://caniuse.com/?search=-webkit-line-clamp
          display: "-webkit-box",
          WebkitLineClamp: "5",
          WebkitBoxOrient: "vertical",
          lineClamp: "5",
          wordWrap: "break-word",
        },
      },
    },
  },
})

interface StyledVegaLiteChartContainerProps {
  useContainerWidth: boolean
  useContainerHeight: boolean
}

export const StyledVegaLiteChartContainer =
  styled.div<StyledVegaLiteChartContainerProps>(
    ({ theme, useContainerWidth, useContainerHeight }) => ({
      width: useContainerWidth ? "100%" : "auto",
      height: useContainerHeight ? "100%" : "auto",
      // These styles come from VegaLite Library
      "&.vega-embed": {
        position: "relative",
        display: "inline-block",
        boxSizing: "border-box",

        "&.fit-x": {
          width: "100%",
        },
        "&.fit-y": {
          height: "100%",
        },
        // Reset pointer events on background/foreground SVG paths to display tooltips on all layers in dialogs.
        "svg.marks g.role-scope": {
          "path.background, path.foreground": {
            pointerEvents: "auto",
          },
        },
      },
      "& form.vega-bindings": getVegaBindingStyles(theme),
    })
  )

/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { EmotionTheme } from "@streamlit/lib/src/theme"

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
    boxShadow: "rgb(0 0 0 / 16%) 0px 1px 4px",
    maxWidth: theme.sizes.maxChartTooltipWidth,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.radii.default,
    zIndex: theme.zIndices.vegaTooltips,

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
  isFullScreen: boolean
}

export const StyledVegaLiteChartContainer =
  styled.div<StyledVegaLiteChartContainerProps>(
    ({ theme, useContainerWidth, isFullScreen }) => ({
      width: useContainerWidth || isFullScreen ? "100%" : "auto",
      height: isFullScreen ? "100%" : "auto",
      // These styles come from VegaLite Library
      "&.vega-embed": {
        "&:hover summary, .vega-embed:focus summary": {
          background: "transparent",
        },
        "&.has-actions": {
          paddingRight: 0,
        },
        ".vega-actions": {
          zIndex: theme.zIndices.popupMenu,
          // Customize menu UI to look like the Streamlit menu:
          backgroundColor: theme.colors.bgColor,
          boxShadow: "rgb(0 0 0 / 16%) 0px 4px 16px",
          border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText10}`,
          a: {
            fontFamily: theme.genericFonts.bodyFont,
            fontWeight: theme.fontWeights.normal,
            fontSize: theme.fontSizes.md,
            margin: 0,
            padding: `${theme.spacing.twoXS} ${theme.spacing.twoXL}`,
            color: theme.colors.bodyText,
          },
          "a:hover": {
            backgroundColor: theme.colors.secondaryBg,
            color: theme.colors.bodyText,
          },
          ":before": {
            content: "none",
          },
          ":after": {
            content: "none",
          },
        },
        summary: {
          opacity: 0,
          // Fix weird floating button height issue in Vega Lite.
          height: "auto",
          // Fix floating button appearing above pop-ups.
          zIndex: theme.zIndices.menuButton,
          border: "none",
          boxShadow: "none",
          borderRadius: theme.radii.default,
          color: theme.colors.fadedText10,
          backgroundColor: "transparent",
          transition: "opacity 300ms 150ms,transform 300ms 150ms",
          "&:active, &:focus-visible, &:hover": {
            border: "none",
            boxShadow: "none",
            color: theme.colors.bodyText,
            opacity: "1 !important",
            background: theme.colors.darkenedBgMix25,
          },
        },
      },
    })
  )

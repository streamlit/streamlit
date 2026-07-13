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

import type { EmotionTheme } from "~lib/theme/types"

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
    ({ useContainerWidth, useContainerHeight }) => ({
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
    })
  )

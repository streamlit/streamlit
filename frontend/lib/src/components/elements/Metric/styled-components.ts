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

import styled from "@emotion/styled"

import type { Metric as MetricProto } from "@streamlit/protobuf"

import {
  printGraphicFitStyles,
  printWidthCapStyles,
} from "~lib/components/shared/printWidthCap"
import {
  StyledWidgetLabel,
  type StyledWidgetProps,
} from "~lib/components/widgets/BaseWidget/styled-components"
import { MARKDOWN_ELLIPSIS_CLASS } from "~lib/hooks/useLabelTitleTooltip"
import { LabelVisibilityOptions } from "~lib/util/utils"

import { getMetricBackgroundColor, getMetricTextColor } from "./metricColors"

/**
 * Width of the metric value at its unscaled font size. Recorded on
 * `beforeprint` for the print scale.
 */
export const METRIC_TEXT_WIDTH_VAR = "--st-metric-text-width"

/**
 * Slot width for a content-width metric, measured around the value. The
 * value is not a size container, so the font rule reads this together with
 * the printed column's `cqi`.
 */
export const METRIC_AVAILABLE_VAR = "--st-metric-available"

interface StyledMetricContainerProps {
  showBorder: boolean
  /**
   * A content-width card is sized by its value, so print must not set
   * `container-type` on the value.
   */
  isContentWidth?: boolean
}

const ELLIPSIS_SELECTOR = `.${MARKDOWN_ELLIPSIS_CLASS}`

export const StyledMetricContainer = styled.div<StyledMetricContainerProps>(
  ({ theme, showBorder, isContentWidth }) => {
    // A bordered card's border plus padding is `lg` on each side.
    const cardInset = showBorder ? `2 * ${theme.spacing.lg}` : "0px"
    const contentWidthSlot = `min(var(${METRIC_AVAILABLE_VAR}, 100cqi), calc(100cqi - ${cardInset}))`
    return {
      height: "100%",
      ...(showBorder && {
        border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        borderRadius: theme.radii.default,
        overflow: "hidden",
      }),
      // A printed column is often narrower than the on-screen card. The label
      // and delta wrap onto extra lines. A stretch card scales the value down
      // to the card. A content-width card stays as wide as the figure.
      "@media print": {
        overflow: "visible",
        [`& ${ELLIPSIS_SELECTOR}, & ${ELLIPSIS_SELECTOR} p`]: {
          overflow: "visible",
          textOverflow: "clip",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          maxWidth: "100%",
          width: "auto",
          minWidth: 0,
        },
        [`& .stMetricValue ${ELLIPSIS_SELECTOR}, & .stMetricValue ${ELLIPSIS_SELECTOR} p`]:
          {
            whiteSpace: "nowrap",
            overflowWrap: "normal",
          },
        // `container-type` on the value makes its intrinsic width 0. A
        // content-width card is sized by that value, so containing it would
        // shrink the card to the label. The figure scales to the narrower of
        // the measured slot and the printed column: a side-by-side column is
        // a size container in print, so `100cqi` resolves at paper width. The
        // card's border and padding sit between the column and the value.
        // Outside a column, `100cqi` falls back to the page width.
        ...(isContentWidth === true
          ? {
              [`& .stMetricValue ${ELLIPSIS_SELECTOR}`]: {
                fontSize: `min(1em, calc(1em * tan(atan2(${contentWidthSlot}, var(${METRIC_TEXT_WIDTH_VAR}, ${contentWidthSlot})))))`,
              },
            }
          : {
              "& .stMetricValue": {
                containerType: "inline-size" as const,
              },
              // Size the wrapper only. `em` on the paragraph would use that
              // already scaled size and shrink the figure a second time. The
              // paragraph inherits this size.
              [`& .stMetricValue ${ELLIPSIS_SELECTOR}`]: {
                // The variable is the figure's width at 1em, recorded in
                // beforeprint. CSS cannot divide one length by another in
                // calc(), so tan(atan2(a, b)) gives the unitless ratio a / b.
                // A card wider than the figure stays at 1em.
                fontSize: `min(1em, calc(1em * tan(atan2(100cqi, var(${METRIC_TEXT_WIDTH_VAR}, 100cqi)))))`,
                // Without a recorded width (no beforeprint, e.g. a headless PDF
                // export), the figure keeps 1em. Clipping it then keeps a long
                // figure out of the neighboring card.
                overflow: "hidden",
              },
            }),
      },
    }
  }
)

export const StyledMetricContent = styled.div<{ showBorder: boolean }>(
  ({ theme, showBorder }) => ({
    ...(showBorder && {
      padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
    }),
  })
)

export const StyledMetricChart = styled.div<{ showBorder: boolean }>(
  ({ theme, showBorder }) => ({
    marginTop: showBorder ? undefined : theme.spacing.lg,
    marginBottom: showBorder ? theme.spacing.twoXL : undefined,
    // The sparkline keeps the pixel width measured on screen. The printed
    // card is often narrower and no longer clips, so cap the chart and its
    // SVG or canvas to the card.
    ...printWidthCapStyles,
    "& .vega-embed": printWidthCapStyles,
    "& svg, & canvas": printGraphicFitStyles,
  })
)

interface StyledMetricLabelTextProps extends StyledWidgetProps {
  visibility?: LabelVisibilityOptions
}

export const StyledMetricLabelText = styled(
  StyledWidgetLabel
)<StyledMetricLabelTextProps>(({ visibility }) => ({
  marginBottom: 0,
  display: visibility === LabelVisibilityOptions.Collapsed ? "none" : "grid",
  gridTemplateColumns:
    visibility === LabelVisibilityOptions.Collapsed ? "initial" : "auto 1fr",
  visibility:
    visibility === LabelVisibilityOptions.Hidden ? "hidden" : "visible",
}))

export const StyledMetricValueText = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.metricValueFontSize,
  lineHeight: "normal",
  fontWeight: theme.fontWeights.metricValueFontWeight,
  color: theme.colors.bodyText,
  paddingBottom: theme.spacing.twoXS,
}))

interface StyledMetricDeltaTextProps {
  metricColor: MetricProto.MetricColor
  showArrow: boolean
}

export const StyledMetricDeltaText = styled.div<StyledMetricDeltaTextProps>(
  ({ theme, metricColor, showArrow }) => ({
    // Uses text colors
    color: getMetricTextColor(theme, metricColor),
    // Uses same color as shaded bg of area chart (bg color)
    backgroundColor: getMetricBackgroundColor(theme, metricColor),
    fontSize: theme.fontSizes.sm,
    lineHeight: "normal",
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "center",
    fontWeight: theme.fontWeights.normal,
    borderRadius: theme.radii.full,
    maxWidth: "100%",
    flexShrink: 0,
    padding: `${theme.spacing.threeXS} ${theme.spacing.xs}`,
    ...(showArrow && {
      // Using only twoXS (4px) on the left side because the arrow icon has an additional
      // 2px padding. Note that this should be adjusted in case we change the arrow icon
      // or if the arrow is not shown (controlled by the showArrow prop).
      paddingLeft: theme.spacing.twoXS,
    }),
  })
)

export const StyledDeltaContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.5em",
  maxWidth: "100%",
  overflow: "hidden",
  paddingBottom: theme.spacing.twoXS,
  "@media print": {
    overflow: "visible",
  },
}))

export const StyledDeltaDescription = styled.div({
  // Flex properties needed for proper truncation within StyledDeltaContainer
  overflow: "hidden",
  flexShrink: 1,
  minWidth: 0,
  "@media print": {
    overflow: "visible",
  },
})

export const StyledMetricLabelRow = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
  minWidth: 0,
}))

export const StyledMetricIcon = styled.span({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
})

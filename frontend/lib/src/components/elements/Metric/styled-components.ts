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

interface StyledMetricContainerProps {
  showBorder: boolean
}

const ELLIPSIS_SELECTOR = `.${MARKDOWN_ELLIPSIS_CLASS}`

/**
 * Estimated average width of a value character, in `em`. Digits and
 * separators are narrower in most fonts, so most figures fit on one line.
 */
const PRINT_VALUE_CHAR_WIDTH_EM = 0.6

export const StyledMetricContainer = styled.div<StyledMetricContainerProps>(
  ({ theme, showBorder }) => ({
    height: "100%",
    ...(showBorder && {
      border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
      borderRadius: theme.radii.default,
      overflow: "hidden",
    }),
    // Print often gives the card less width than on screen, so text that
    // ellipsizes on screen wraps instead of being cut off.
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
    },
  })
)

export const StyledMetricContent = styled.div<{ showBorder: boolean }>(
  ({ theme, showBorder }) => ({
    ...(showBorder && {
      padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
    }),
  })
)

/**
 * Height of the metric sparkline, shared by its Vega spec and the container
 * that reserves its space.
 */
export const METRIC_CHART_HEIGHT = "3.5rem"

export const StyledMetricChart = styled.div<{ showBorder: boolean }>(
  ({ theme, showBorder }) => ({
    marginTop: showBorder ? undefined : theme.spacing.lg,
    marginBottom: showBorder ? theme.spacing.twoXL : undefined,
    // Reserve the sparkline's height while Vega loads, so the card doesn't
    // grow when the chart draws.
    minHeight: METRIC_CHART_HEIGHT,
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

interface StyledMetricValueTextProps {
  /**
   * Character count of the value, which print CSS uses to shrink the figure
   * to fit the card. Leave unset for a content-width card: the value's width
   * sizes the card, so making the value a size container would collapse it.
   * Figures wider than the printed column wrap instead.
   */
  printFitLength?: number
}

export const StyledMetricValueText = styled.div<StyledMetricValueTextProps>(
  ({ theme, printFitLength }) => ({
    fontSize: theme.fontSizes.metricValueFontSize,
    lineHeight: "normal",
    fontWeight: theme.fontWeights.metricValueFontWeight,
    color: theme.colors.bodyText,
    paddingBottom: theme.spacing.twoXS,
    ...(printFitLength !== undefined &&
      printFitLength > 0 && {
        "@media print": {
          containerType: "inline-size",
          // Size the wrapper only. The paragraph inherits the size, and `em`
          // on it would shrink the figure a second time.
          [`& ${ELLIPSIS_SELECTOR}`]: {
            fontSize: `min(1em, calc(100cqi / (${printFitLength} * ${PRINT_VALUE_CHAR_WIDTH_EM})))`,
          },
        },
      }),
  })
)

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

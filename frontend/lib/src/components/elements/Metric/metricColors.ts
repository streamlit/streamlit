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

import { opacify, transparentize } from "color2k"
import { LinearGradient } from "vega"

import { Metric as MetricProto } from "@streamlit/protobuf"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import { EmotionTheme } from "~lib/theme/types"

/**
 * How much opacity to add to the top of an area chart's gradient fill.
 *
 * Fading the fill out towards its baseline removes roughly half of its alpha,
 * which would leave the shading fainter than the flat fill it replaces. Adding
 * opacity at the top keeps the shading's overall weight comparable. This is the
 * knob to turn if the shading needs to read stronger or softer overall.
 *
 * Note that `opacify` clamps at full opacity, so for a custom theme whose
 * background color is already opaque the boost is a no-op and the fill still
 * reads lighter overall than the flat one.
 */
const AREA_GRADIENT_TOP_OPACITY_BOOST = 0.15

/**
 * Returns the main color for a metric based on the MetricColor enum.
 */
export function getMetricColor(
  theme: EmotionTheme,
  color: MetricProto.MetricColor
): string {
  switch (color) {
    case MetricProto.MetricColor.RED:
      return theme.colors.redColor
    case MetricProto.MetricColor.GREEN:
      return theme.colors.greenColor
    case MetricProto.MetricColor.ORANGE:
      return theme.colors.orangeColor
    case MetricProto.MetricColor.YELLOW:
      return theme.colors.yellowColor
    case MetricProto.MetricColor.BLUE:
      return theme.colors.blueColor
    case MetricProto.MetricColor.VIOLET:
      return theme.colors.violetColor
    case MetricProto.MetricColor.PRIMARY:
      return theme.colors.primary
    // this must be grey
    default:
      return theme.colors.grayColor
  }
}

/**
 * Returns the background color for a metric delta indicator.
 * Uses the same background colors as Markdown bg colors.
 */
export function getMetricBackgroundColor(
  theme: EmotionTheme,
  color: MetricProto.MetricColor
): string {
  const lightTheme = hasLightBackgroundColor(theme)

  switch (color) {
    case MetricProto.MetricColor.RED:
      return theme.colors.redBackgroundColor
    case MetricProto.MetricColor.GREEN:
      return theme.colors.greenBackgroundColor
    case MetricProto.MetricColor.ORANGE:
      return theme.colors.orangeBackgroundColor
    case MetricProto.MetricColor.YELLOW:
      return theme.colors.yellowBackgroundColor
    case MetricProto.MetricColor.BLUE:
      return theme.colors.blueBackgroundColor
    case MetricProto.MetricColor.VIOLET:
      return theme.colors.violetBackgroundColor
    case MetricProto.MetricColor.PRIMARY:
      return transparentize(theme.colors.primary, lightTheme ? 0.9 : 0.7)
    // this must be grey
    default:
      return theme.colors.grayBackgroundColor
  }
}

/**
 * Returns the fill for an area chart's shaded region as a vertical gradient.
 *
 * The fill fades out towards the baseline, so the shading dissolves into the
 * space beyond it instead of ending in a hard horizontal edge.
 *
 * Gradient coordinates are normalized to the shaded region's bounding box, so
 * the fade tracks the region's vertical extent rather than following the line
 * itself. Placing the transparent stop at the baseline's own offset within that
 * box means a fill that diverges around the baseline (a series crossing zero)
 * fades out in both directions from it: downwards above the baseline, and
 * upwards below it.
 *
 * @param baselineOffset - Where the baseline sits in the shaded region's
 * bounding box, as a normalized offset from its top edge. `1` (the bottom edge)
 * for a fill that does not diverge, which collapses the fade to a single
 * direction.
 */
export function getMetricAreaGradient(
  theme: EmotionTheme,
  color: MetricProto.MetricColor,
  baselineOffset: number
): LinearGradient | string {
  const backgroundColor = getMetricBackgroundColor(theme, color)

  let fillColor: string
  let transparentFillColor: string
  try {
    fillColor = opacify(backgroundColor, AREA_GRADIENT_TOP_OPACITY_BOOST)
    // `transparentize` clamps alpha at 0, so this is fully transparent
    // regardless of how opaque the background color is.
    transparentFillColor = transparentize(backgroundColor, 1)
  } catch {
    // Custom theme colors are validated with the browser's CSS parser, which
    // accepts values color2k cannot parse (e.g. `currentcolor`). Fall back to
    // the flat fill rather than failing to render the chart at all.
    return backgroundColor
  }

  return {
    gradient: "linear",
    // Vertical gradient: y1 is the top edge of the shaded region, y2 its bottom.
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 1,
    stops: [
      { offset: 0, color: fillColor },
      { offset: baselineOffset, color: transparentFillColor },
      // Only reached when the fill diverges: below the baseline the shading
      // fades back in towards the lowest data point.
      ...(baselineOffset < 1 ? [{ offset: 1, color: fillColor }] : []),
    ],
  }
}

/**
 * Returns the text color for a metric delta indicator.
 * Uses the same text colors as Markdown.
 */
export function getMetricTextColor(
  theme: EmotionTheme,
  color: MetricProto.MetricColor
): string {
  switch (color) {
    case MetricProto.MetricColor.RED:
      return theme.colors.redTextColor
    case MetricProto.MetricColor.GREEN:
      return theme.colors.greenTextColor
    case MetricProto.MetricColor.ORANGE:
      return theme.colors.orangeTextColor
    case MetricProto.MetricColor.YELLOW:
      return theme.colors.yellowTextColor
    case MetricProto.MetricColor.BLUE:
      return theme.colors.blueTextColor
    case MetricProto.MetricColor.VIOLET:
      return theme.colors.violetTextColor
    case MetricProto.MetricColor.PRIMARY:
      return theme.colors.primary
    // this must be grey
    default:
      return theme.colors.grayTextColor
  }
}

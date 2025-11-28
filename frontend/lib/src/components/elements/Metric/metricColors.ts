/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { transparentize } from "color2k"

import { Metric as MetricProto } from "@streamlit/protobuf"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import { EmotionTheme } from "~lib/theme/types"

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

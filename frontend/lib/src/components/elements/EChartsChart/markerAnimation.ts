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

import { isPlainObject } from "lodash-es"

import { type EChartsOptionObject, mapOptionSeries } from "./CustomTheme"

/** The series markers that play an entry animation; ``markArea`` has none. */
const ANIMATED_MARKER_KEYS = ["markLine", "markPoint"] as const

/**
 * Skip ``markLine`` and ``markPoint`` entry animations when this option
 * replaces one the chart already shows.
 *
 * ``notMerge`` keeps series views, so series still tween, but it rebuilds
 * marker views and would replay their entry. Sets ``animationDuration`` to 0
 * unless the marker already sets it. In-place updates, such as a legend toggle,
 * still tween. Markers that first appear in this option skip their entry too.
 *
 * @param option The option about to replace the chart's current one.
 * @returns A copy of the option without marker entry animations.
 */
export function withoutMarkerEntryAnimations(
  option: EChartsOptionObject
): EChartsOptionObject {
  return mapOptionSeries(option, series => {
    const updated = { ...series }
    for (const key of ANIMATED_MARKER_KEYS) {
      const marker = series[key]
      if (
        isPlainObject(marker) &&
        (marker as Record<string, unknown>).animationDuration === undefined
      ) {
        updated[key] = {
          ...(marker as Record<string, unknown>),
          animationDuration: 0,
        }
      }
    }
    return updated
  })
}

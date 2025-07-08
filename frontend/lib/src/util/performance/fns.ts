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

import { StPerformanceMark, StPerformanceMetric } from "./types"

/**
 * Type-safe version of `performance.measure` for Streamlit usage.
 * @param measureArg - The name of the measure.
 * @param startOrMeasureOptions - The start mark or measure options.
 * @param endMark - The optional end mark.
 * @returns {void}
 */
export const measure = (
  measureArg: StPerformanceMetric,
  startOrMeasureOptions?: StPerformanceMark | PerformanceMeasureOptions,
  endMark?: StPerformanceMark
): PerformanceMeasure => {
  return performance.measure(measureArg, startOrMeasureOptions, endMark)
}
/**
 * Type-safe version of `performance.mark` for Streamlit usage. Marks a
 * performance entry with the given name.
 * @param markArg - The name of the performance mark.
 * @returns The created PerformanceMark object.
 */
export const mark = (markArg: StPerformanceMark): PerformanceMark => {
  return performance.mark(markArg)
}

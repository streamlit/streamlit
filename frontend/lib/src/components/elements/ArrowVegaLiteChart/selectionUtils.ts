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

import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

/**
 * Extracts and returns the names of selection parameters from a given Vega-Lite chart specification.
 * This method is specifically designed for use with Vega-Lite version 5 specifications.
 *
 * It parses the 'params' property of the specification, if present, to retrieve the names
 * of all selection parameters (parameters with a 'select' property).
 *
 * For more details on selection in Vega-Lite, visit:
 * https://vega.github.io/vega-lite/docs/selection.html
 *
 * @param spec {any} - The Vega-Lite chart specification object, expected to conform to the
 * structure utilized by Vega-Lite 5.
 * @returns {string[]} An array of strings, where each string is the name of a selector from
 * the chart's specification. Returns an empty array if no selectors are found.
 *
 * Example:
 * ```
 * const vegaLiteSpec = {
 *   params: [
 *     { name: 'brush', select: 'interval' },
 *     { name: 'click', select: 'point', toggle: 'event.shiftKey' }
 *   ]
 * };
 * const selectors = getSelectorsFromSpec(vegaLiteSpec);
 * console.log(selectors); // Output: ['brush', 'click']
 * ```
 */
export function getSelectorsFromSpec(spec: any): string[] {
  if ("params" in spec) {
    const select: any[] = []
    spec.params.forEach((item: any) => {
      // Only parameters with a select property are relevant
      // selection parameters for us. Also, its required
      // that the parameter have a name. This is required in the vega
      // lite spec, but we check anyways to be extra safe.
      if ("select" in item && "name" in item && item.name) {
        select.push(item.name)
      }
    })
    return select
  }
  return []
}

/**
 * Prepares the vega-lite spec for selections by transforming the select parameters
 * to a full object specification and by automatically adding encodings (if missing)
 * to point selections.
 *
 * The changes are applied in-place to the spec object.
 *
 * @param spec The Vega-Lite specification of the chart.
 */
export function prepareSpecForSelections(spec: any): void {
  if ("params" in spec && "encoding" in spec) {
    spec.params.forEach((param: any) => {
      if (!("select" in param)) {
        // We are only interested in transforming select parameters.
        // Other parameters are skipped.
        return
      }

      if (["interval", "point"].includes(param.select)) {
        // The select object can be either a single string (short-hand) specifying
        // "interval" or "point" or an object that can contain additional
        // properties as defined here: https://vega.github.io/vega-lite/docs/selection.html
        // To make our life easier, we convert the short-hand notation to the full object specification.
        param.select = {
          type: param.select,
        }
      }

      if (!("type" in param.select)) {
        // The type property is required in the spec.
        // But we check anyways and skip all parameters that don't have it.
        return
      }

      if (
        param.select.type === "point" &&
        !("encodings" in param.select) &&
        isNullOrUndefined(param.select.encodings)
      ) {
        // If encodings are not specified by the user, we add all the encodings from
        // the chart to the selection parameter. This is required so that points
        // selections are correctly resolved to a PointSelection and not an IndexSelection:
        // https://github.com/altair-viz/altair/issues/3285#issuecomment-1858860696
        param.select.encodings = Object.keys(spec.encoding)
      }
    })
  }
}

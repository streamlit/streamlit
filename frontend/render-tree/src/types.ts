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

import { Quiver } from "@streamlit/data-utils"

/**
 * All of the data that makes up a VegaLite chart.
 * This type is defined locally in render-tree to avoid circular dependencies
 * with the charts package.
 */
export interface VegaLiteChartElement {
  /**
   * The dataframe that will be used as the chart's main data source, if
   * specified using Vega-Lite's inline API.
   *
   * This is mutually exclusive with WrappedNamedDataset - if `data` is non-null,
   * `datasets` will not be populated; if `datasets` is populated, then `data`
   * will be null.
   */
  data: Quiver | null

  /** The a JSON-formatted string with the Vega-Lite spec. */
  spec: string

  /**
   * Dataframes associated with this chart using Vega-Lite's datasets API,
   * if any.
   */
  datasets: WrappedNamedDataset[]

  /** If True, will overwrite the chart width spec to fit to container. */
  useContainerWidth: boolean

  /** override the properties with a theme. Currently, only "streamlit" or None are accepted. */
  vegaLiteTheme: string

  /** The widget ID. Only set if selections are activated. */
  id: string

  /** Named selection parameters that are activated to trigger reruns. */
  selectionMode: string[]

  /** The form ID if the chart has activated selections and is used within a form. */
  formId: string
}

/** A mapping of `ArrowNamedDataSet.proto`. */
export interface WrappedNamedDataset {
  /** The dataset's optional name. */
  name: string | null

  /** True if the name field (above) was manually set. */
  hasName: boolean

  /** The data itself, wrapped in a Quiver object. */
  data: Quiver
}

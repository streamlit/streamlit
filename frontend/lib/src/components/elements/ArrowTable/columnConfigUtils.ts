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

import { getLogger } from "loglevel"

const LOG = getLogger("columnConfigUtils")

// Using this ID for column config will apply the config to all index columns
// This matches the identifier used in the backend and DataFrame component
export const INDEX_IDENTIFIER = "_index"

/**
 * Configuration options for a column.
 */
export interface ColumnConfig {
  hidden?: boolean
  // Additional config properties can be added here in the future
}

/**
 * Parse the column configuration JSON from the proto message.
 *
 * @param configJson - The column config JSON string from the proto.
 * @returns A Map of column identifiers to their configuration.
 */
export function getColumnConfig(
  configJson: string
): Map<string, ColumnConfig> {
  if (!configJson) {
    return new Map()
  }

  try {
    const parsed = JSON.parse(configJson)
    return new Map(Object.entries(parsed))
  } catch (error) {
    // This is not expected to happen, but if it does, we'll return an empty map
    // and log the error to the console.
    LOG.error("Failed to parse column config:", error)
    return new Map()
  }
}

/**
 * Determine if the index column should be hidden based on column configuration.
 *
 * @param columnConfig - The parsed column configuration mapping.
 * @returns true if the index should be hidden, false otherwise.
 */
export function shouldHideIndex(
  columnConfig: Map<string, ColumnConfig>
): boolean {
  const indexConfig = columnConfig.get(INDEX_IDENTIFIER)
  return indexConfig?.hidden === true
}

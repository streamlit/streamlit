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

import { Table, tableFromIPC } from "apache-arrow"

import { ARROW_REF_KEY } from "~lib/components/widgets/BidiComponent/constants"

type MixedData = {
  [ARROW_REF_KEY]: string
}

/**
 * The type of the data that can be returned from parsing and reconstructing a
 * Streamlit v2 Component's `data` parameter.
 */
type ParsedData =
  | string
  | number
  | boolean
  | null
  | Array<unknown>
  | Record<string, unknown>
  | Table

/**
 * Reconstruct data by replacing Arrow references with actual Arrow Tables
 * (first level of object only).
 */
export const reconstructMixedData = (
  data: string | MixedData | Record<string, unknown> | Array<unknown>,
  arrowBlobs: {
    [key: string]: Uint8Array<ArrayBufferLike>
  }
): ParsedData => {
  // If the data itself is an Arrow reference, replace it
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (typeof data[ARROW_REF_KEY] === "string") {
      const refId = data[ARROW_REF_KEY]
      const arrowBytes = arrowBlobs[refId]
      if (arrowBytes) {
        try {
          // Parse Arrow bytes and return Arrow Table
          return tableFromIPC(arrowBytes)
        } catch {
          return null
        }
      }
      return null
    }

    // Process only first-level properties for Arrow references
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof (value as MixedData)[ARROW_REF_KEY] === "string"
      ) {
        const refId = (value as MixedData)[ARROW_REF_KEY]
        const arrowBytes = arrowBlobs[refId]
        if (arrowBytes) {
          try {
            result[key] = tableFromIPC(arrowBytes)
          } catch {
            result[key] = null
          }
        } else {
          result[key] = null
        }
      } else {
        result[key] = value
      }
    }
    return result
  }

  return data
}

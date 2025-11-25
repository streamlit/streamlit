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

import { IArrow } from "@streamlit/protobuf"

import { Quiver } from "./Quiver"

/**
 * Create a Quiver instance from raw Arrow proto data.
 * This is a utility to ensure consistent Quiver instantiation across components.
 */
export function createQuiverFromProto(proto: IArrow): Quiver {
  return new Quiver(proto)
}

/**
 * Merge additional Arrow data into an existing Quiver instance.
 * Returns a new Quiver with the combined data.
 */
export function mergeQuiverData(base: Quiver, additional: IArrow): Quiver {
  const additionalQuiver = new Quiver(additional)
  return base.addRows(additionalQuiver)
}

/**
 * Create a Quiver instance from proto data, or return null if proto is null/undefined.
 * Convenience function for optional data.
 */
export function createQuiverOrNull(
  proto: IArrow | null | undefined
): Quiver | null {
  return proto ? new Quiver(proto) : null
}

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

import { useContext } from "react"

import { FlexContext } from "~lib/components/core/Layout/FlexContext"

/**
 * Resolves the effective `wrap` for a button or option group from the
 * tri-state `wrap` proto field.
 *
 * - `true` / `false`: use the explicit value.
 * - `null` / `undefined` (auto, the default): don't wrap inside a horizontal
 *   container — so the control keeps its single-row height and stays aligned
 *   with its neighbors — and wrap in any other layout.
 *
 * @param wrap The `wrap` value from the element proto (nullable).
 * @returns Whether wrapping is allowed.
 */
export function useResolvedWrap(wrap: boolean | null | undefined): boolean {
  const flexContext = useContext(FlexContext)
  const isInHorizontalLayout = flexContext?.isInHorizontalLayout ?? false
  return wrap ?? !isInHorizontalLayout
}

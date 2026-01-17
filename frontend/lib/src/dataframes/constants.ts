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

/**
 * Identifier used for column configuration to apply config to all index columns.
 *
 * This value **must** stay in sync with its Python counterpart defined in
 * `streamlit.elements.arrow.INDEX_IDENTIFIER`.
 *
 * Used by both st.table() (ArrowTable) and st.dataframe() (DataFrame) components.
 */
export const INDEX_IDENTIFIER = "_index" as const

/**
 * Prefix used in column config mapping when referring to a column via numeric position.
 * For example, "_pos:0" refers to the first column, "_pos:1" to the second, etc.
 */
export const COLUMN_POSITION_PREFIX = "_pos:" as const

/**
 * Predefined column widths configurable by the user.
 */
export const COLUMN_WIDTH_MAPPING = {
  small: 75,
  medium: 200,
  large: 400,
} as const

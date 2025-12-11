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

/**
 * Shared constant that is used to delimit the event name from the base id.
 * This value **must** stay in sync with its Python counterpart defined in
 * `streamlit.components.v2.bidi_component`.
 */
export const EVENT_DELIM = "__" as const

/**
 * Shared constant that is used to identify ArrowReference objects in the data
 * structure. This value **must** stay in sync with its Python counterpart
 * defined in `streamlit.components.v2.bidi_component`.
 */
export const ARROW_REF_KEY = "__streamlit_arrow_ref__" as const

/**
 * Shared constant that is used to prefix internal Streamlit keys.
 * This value **must** stay in sync with its Python counterpart defined in
 * `streamlit.runtime.state.session_state`.
 */
export const STREAMLIT_INTERNAL_KEY_PREFIX =
  "$$STREAMLIT_INTERNAL_KEY" as const

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
 * Elevation shadows for light theme.
 * Lower opacity values work well on light backgrounds.
 */
const elevationShadows = {
  tooltip: "0px 1px 4px rgba(0, 0, 0, 0.16)",
  popover: "0px 4px 16px rgba(0, 0, 0, 0.16)",
  toolbar: "1px 2px 8px rgba(0, 0, 0, 0.08)",
  sidebar: "-2rem 0 2rem 2rem rgba(0, 0, 0, 0.16)",
  none: "none",
}

export type ElevationShadows = typeof elevationShadows

export default elevationShadows

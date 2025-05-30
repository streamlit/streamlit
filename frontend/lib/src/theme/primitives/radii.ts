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

// md, default, xl, xxl can be changed based on the baseRadius theme config.
// chatInput, full, and maxCheckboxRadius are not impacted by this config.
export const radii = {
  md: "0.25rem",
  // This is the default radius used in most elements:
  default: "0.5rem",
  xl: "0.75rem",
  xxl: "1rem",
  // Radius specific to buttons (enables buttonRadius config):
  button: "0.5rem",
  // Chat input enforces a more rounded look:
  chatInput: "1.25rem",
  // Ensures that the element is fully rounded:
  full: "9999px",
  // The maximum radius for checkboxes to still be recognizable as a checkbox:
  maxCheckbox: "0.35rem",
}

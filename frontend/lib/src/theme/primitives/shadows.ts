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

export const shadows = {
  // Focus ring configuration
  // Used by getFocusBoxShadow and getPrimaryFocusBoxShadow helpers
  focusRingWidth: "0.2rem",
  // Alpha value for transparentize: 0 = unchanged, 1 = fully transparent
  focusRingAlpha: 0.5,

  // Elevation shadows - Light theme
  // Small floating elements like tooltips
  tooltipLight: "0px 1px 4px rgba(0, 0, 0, 0.16)",
  // Popovers, toasts, dropdowns, menus
  popoverLight: "0px 4px 16px rgba(0, 0, 0, 0.16)",
  // Subtle toolbar/floating bar elevation
  toolbarLight: "1px 2px 8px rgba(0, 0, 0, 0.08)",
  // Mobile sidebar overlay shadow
  sidebarLight: "-2rem 0 2rem 2rem rgba(0, 0, 0, 0.16)",

  // Elevation shadows - Dark theme
  tooltipDark: "0px 1px 4px rgba(0, 0, 0, 0.4)",
  popoverDark: "0px 4px 16px rgba(0, 0, 0, 0.7)",
  toolbarDark: "1px 2px 8px rgba(0, 0, 0, 0.2)",
  sidebarDark: "-2rem 0 2rem 2rem rgba(0, 0, 0, 0.4)",

  // Reset value
  none: "none",
}

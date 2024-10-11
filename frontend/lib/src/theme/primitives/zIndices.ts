/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

const sidebar = 100
const menuButton = sidebar + 10
const balloons = 1000000
const header = balloons - 10
const bottom = sidebar - 1
const sidebarMobile = balloons - 5
const popupMenu = balloons + 40
const fullscreenWrapper = balloons + 50
// Vega tooltips should be shown even when used
// in dialogs or in fullscreen mode
const vegaTooltips = fullscreenWrapper + 10
const tablePortal = fullscreenWrapper + 60
const cacheSpinner = sidebar + 1
// Toasts should overlap chatInput container
const toast = bottom + 1

export const zIndices = {
  hide: -1,
  auto: "auto",
  base: 0,
  // this is used if we want to ensure that an element
  // is shown above the parent elements.
  priority: 1,
  sidebar,
  menuButton,
  balloons,
  header,
  sidebarMobile,
  popupMenu,
  fullscreenWrapper,
  tablePortal,
  bottom,
  cacheSpinner,
  toast,
  vegaTooltips,
}

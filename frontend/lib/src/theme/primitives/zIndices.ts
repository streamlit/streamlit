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

const sidebar = 100
const menuButton = sidebar + 10
const balloons = 1000000
const header = balloons - 10
const bottom = sidebar - 1
const sidebarMobile = balloons - 5
const fullscreenWrapper = balloons + 50
const headerDecoration = balloons - 1
// Used for popup menus, chart tooltips, and other aspects
// that need to be shown above the fullscreen wrapper
const popup = fullscreenWrapper + 10
// Used for the shared BaseWeb overlay layer host (legacy dropdowns/calendars for
// widgets such as multiselect, date_input, time_input). Anchored just above popup
// so a BaseWeb dropdown opened inside a floating-ui popover (which sits at popup)
// paints above the popover body, while staying below tablePortal so dataframe
// overlays remain on top.
const basewebOverlay = popup + 2
// Used for modal dialog backdrops and surfaces. Keep this below popup so
// nested overlays opened from dialogs render above the modal surface.
const modal = popup - 1
// Used for rendering the cell overlay editor and column menus of the
// dataframe component. Anchored above popup so that dataframe overlays
// render above both BaseWeb popups and the modal surface (modal < popup).
const tablePortal = popup + 50
// Used for Vega chart tooltips in the dataframe statistics submenu.
// Must be above tablePortal so tooltips appear over the column menu portal.
const tablePortalTooltip = tablePortal + 10
const cacheSpinner = sidebar + 1
// Toasts should overlap chatInput container
// should also show above dialog
const toast = popup + 1

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
  modal,
  popup,
  basewebOverlay,
  fullscreenWrapper,
  tablePortal,
  tablePortalTooltip,
  bottom,
  cacheSpinner,
  toast,
  headerDecoration,
}

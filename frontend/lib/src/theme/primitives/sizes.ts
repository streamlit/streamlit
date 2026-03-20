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

import { spacing } from "./spacing"

// Base values used in computed sizes
const minElementHeight = "2.5rem"
const borderWidth = "1px"

export const sizes = {
  full: "100%",
  headerHeight: "3.75rem",
  // Old header height to avoid addtl cascading visual/snapshot changes
  fullScreenHeaderHeight: "2.875rem",
  sidebarTopSpace: "6rem",
  toastWidth: "21rem",
  // Use px here since we want to keep the width the same
  // regardless of the root font size.
  contentMaxWidth: "736px",
  maxChartTooltipWidth: "30rem",
  // Used for checkboxes, radio, and toggles:
  checkbox: "1rem",
  borderWidth,
  // Used for checkboxes/toggle
  smallElementHeight: "1.5rem",
  // min height used for most input widgets
  minElementHeight,
  // Height for hover/focus highlights inside input widgets (e.g., dropdown items)
  // Calculated as: minElementHeight - 2 * spacing.xs (vertical padding)
  elementHighlightHeight: `calc(${minElementHeight} - 2 * ${spacing.xs})`,
  tagMarginInsideBorder: `calc(${spacing.xs} - ${borderWidth})`,
  // min height for larger input widgets like text area and audio input
  largestElementHeight: "4.25rem",
  smallLogoHeight: "1.25rem",
  defaultLogoHeight: "1.5rem",
  largeLogoHeight: "2rem",
  sliderThumb: "0.75rem",
  wideSidePadding: "5rem",
  headerDecorationHeight: "0.125rem",
  appMainMenu: "12rem",
  appRunningMen: "1.6rem",
  appStatusMaxWidth: "20rem",
  tableColumnMaxWidth: "25rem",
  spinnerSize: "1.375rem",
  spinnerThickness: "0.125rem",
  tabHeight: "2.5rem",
  // Min width used for popover and dialog:
  minPopupWidth: "20rem",
  maxTooltipHeight: "18.75rem",
  chatAvatarSize: "2rem",
  // Used for the clear icon used by some Input elements
  clearIconSize: "1.5em",
  numberInputControlsWidth: "2rem",
  emptyDropdownHeight: "5.625rem",
  dropdownItemHeight: "2.5rem",
  maxDropdownHeight: "18.75rem",
  appDefaultBottomPadding: "3.5rem",
  defaultMapHeight: "31.25rem",
  defaultChartHeight: "21.875rem",
  defaultChartWidth: "25rem",
  // The minimum width of the menu (used for the dataframe column menu)
  minMenuWidth: "8rem",
  minChatInputFileListHeight: "3rem",
  uploadedFileIconSize: "2rem",
  headerItemHeight: "1.75rem",
  headerRightContentMaxWidth: "12.5rem",
  chatInputTextareaMinHeight: "1.5rem",
  chatInputPrimaryButtonSize: "2rem",
  // Offset to vertically center button with textarea text in simple mode
  // (3px margin the bottom with flex-end to center by default but keep it at the bottom)
  chatInputButtonVerticalOffset: "0.1875rem",
  dialogLargeWidth: "80rem",
  defaultStrokeWidth: 2.25,
  metricStrokeWidth: 2,
  // Default for box-shadow focus ring width
  focusRingWidth: "0.2rem",
  fileChipNameMinWidth: "4.875rem",
}

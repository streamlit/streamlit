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

/** Class of the HTML table that replaces the canvas grid when printing. */
export const DATAFRAME_PRINT_TABLE_CLASS = "stDataFramePrintTable"

/** Slot that holds the print table or the fallback note. Hidden on screen. */
export const DATAFRAME_PRINT_SLOT_CLASS = "stDataFramePrintSlot"

/** Shown instead of that table when the frame cannot be expanded. */
export const DATAFRAME_PRINT_NOTE_CLASS = "stDataFramePrintNote"

/**
 * Wrapper around the print table. Chromium does not shrink a table's border
 * box for `zoom`, so the scale is on this element and the slot follows it.
 */
export const DATAFRAME_PRINT_SCALE_CLASS = "stDataFramePrintScale"

/**
 * Natural width of the print table, in px. Print CSS divides the column width
 * by this length. The division uses `tan(atan2(...))` so the scale is a
 * number in browsers that cannot divide two lengths inside `calc()`.
 */
export const DATAFRAME_PRINT_WIDTH_VAR = "--st-df-print-width"

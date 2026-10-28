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

/** Note printed below a truncated table, or in place of the table when the frame cannot be expanded. */
export const DATAFRAME_PRINT_NOTE_CLASS = "stDataFramePrintNote"

/**
 * Wrapper around the print table. The table width is capped at the column,
 * and the font scales to that width, so this element stays inside the slot.
 */
export const DATAFRAME_PRINT_SCALE_CLASS = "stDataFramePrintScale"

/**
 * Natural width of the print table, in px. Print CSS compares the column
 * width with this length. The comparison uses `tan(atan2(...))` so the scale
 * is a number in browsers that cannot divide two lengths inside `calc()`.
 */
export const DATAFRAME_PRINT_WIDTH_VAR = "--st-df-print-width"

/**
 * Unitless font scale for browsers that cannot compute the print ratio.
 *
 * Left unset when `tan(atan2(100cqw, ...))` works, so the column width can
 * change after `beforeprint` without an inline value freezing the on-screen
 * column. `beforeprint` still uses screen media.
 */
export const DATAFRAME_PRINT_SCALE_VAR = "--st-df-print-scale"

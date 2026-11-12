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

import type { CSSObject } from "@emotion/styled"

import { PrintLayout } from "~lib/components/core/Block/ElementContainerConfig"

/**
 * Marks a subtree that stays mounted but is not on the printed page: a
 * closed tab panel.
 */
export const PRINT_INACTIVE_ATTRIBUTE = "data-st-inactive"

/**
 * Excludes an element that is mounted but not on the printed page: inside a
 * closed tab or a collapsed expander.
 */
export const PRINT_VISIBLE_FILTER = `:not([${PRINT_INACTIVE_ATTRIBUTE}] *):not(details:not([open]) *)`

const VISIBLE_PRINT_GRAPHIC = `.${PrintLayout.GRAPHIC}${PRINT_VISIBLE_FILTER}`

/**
 * A dataframe or `st.table` that prints. Those elements can be taller than a
 * page, so a bordered card around them must be allowed to split.
 */
const VISIBLE_PRINT_FIXED_WIDTH = `.${PrintLayout.FIXED_WIDTH}${PRINT_VISIBLE_FILTER}`

/** Asks the browser not to start a page break inside this box. */
export const printKeepTogetherRules: CSSObject = {
  breakInside: "avoid",
}

/**
 * Lets a tall table continue on the next page instead of moving the whole
 * card and leaving a blank strip behind.
 */
export const printAllowSplitRules: CSSObject = {
  breakInside: "auto",
}

/**
 * Print rules so an HTML table can fragment across pages: the header repeats,
 * and a row stays on one page when it fits.
 */
export const printTableSplitRules: CSSObject = {
  ...printAllowSplitRules,
  thead: {
    display: "table-header-group",
    breakInside: "avoid",
    breakAfter: "avoid",
  },
  tbody: {
    display: "table-row-group",
  },
  tr: {
    breakInside: "avoid",
  },
}

/**
 * Emotion selector that matches this box when it contains a chart (an
 * element with `PrintLayout.GRAPHIC`) that prints, so not inside a closed
 * tab or a closed expander. Pair it with `printKeepTogetherRules` so the
 * box is not split from that chart. Any visible `PrintLayout.FIXED_WIDTH`
 * element opts the box out, including a short dataframe, an empty
 * dataframe, and a fixed-height `st.table` that keeps its scroll box. A
 * card that pairs a chart with a summary dataframe therefore no longer
 * stays together. That is the trade-off for letting a tall table paginate
 * instead of leaving a blank strip. A box taller than a page still breaks.
 */
export const PRINT_CHART_CARD_SELECTOR = `&:has(${VISIBLE_PRINT_GRAPHIC}):not(:has(${VISIBLE_PRINT_FIXED_WIDTH}))`

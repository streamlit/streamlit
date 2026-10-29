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

import { DATAFRAME_PRINT_TABLE_CLASS } from "~lib/components/widgets/DataFrame/printClassNames"

/**
 * Marks a subtree that stays mounted but is not on the printed page: a
 * closed tab panel or a collapsed sidebar.
 */
export const PRINT_INACTIVE_ATTRIBUTE = "data-st-inactive"

/**
 * Excludes an element that is mounted but not on the printed page: inside a
 * closed tab, a collapsed sidebar, or a collapsed expander.
 */
export const PRINT_VISIBLE_FILTER = `:not([${PRINT_INACTIVE_ATTRIBUTE}] *):not(details:not([open]) *)`

/**
 * Charts by their own element classes. A chart's SVG or canvas prints as one
 * piece, so the browser moves it to the next page instead of splitting it.
 * Only built-in chart renderers with a stable frontend class are listed. A
 * new chart element must be added here to stack its column row and stay on
 * one page in print.
 */
export const PRINT_CHART_SELECTOR =
  ":is(.stVegaLiteChart, .stPlotlyChart, .stDeckGlJsonChart, .stGraphVizChart, .stEChartsChart)"

const VISIBLE_PRINT_CHART = `${PRINT_CHART_SELECTOR}${PRINT_VISIBLE_FILTER}`

/** Asks the browser not to start a page break inside this box. */
export const printKeepTogetherRules: CSSObject = {
  breakInside: "avoid",
}

/**
 * Keeps a bordered card that holds a chart on one page. The chart moves to
 * the next page as one piece, so a split card would leave its title and an
 * empty bordered strip behind. A card with a dataframe print table still
 * breaks, so the table can continue and repeat its header. Text and metric
 * cards split line by line like the rest of the page. A card taller than a
 * page still breaks; this rule never clips content.
 */
export const PRINT_CHART_CARD_SELECTOR = `&:has(${VISIBLE_PRINT_CHART}):not(:has(.${DATAFRAME_PRINT_TABLE_CLASS}))`

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

/**
 * Keep a screen-measured chart or dataframe inside its column when printing.
 *
 * These elements lock a pixel width from the on-screen layout. Print reflow
 * narrows the page without clearing that width, so the box spills out of its
 * column. Cap the width only. Forcing `height: auto` reflows the chart using
 * that on-screen width ratio and collapses it, which pulls the next heading
 * up into the card above. `overflow` other than `visible` also makes Chrome's
 * print layout overlap the following flex items.
 */
const printWidthCapRules = {
  maxWidth: "100%",
  minWidth: 0,
  overflow: "visible",
}

export const printWidthCapStyles: CSSObject = {
  "@media print": printWidthCapRules,
}

/**
 * Cap a chart SVG or canvas to its column without changing its height.
 * Leaving the height in place keeps the graphic's box from collapsing onto
 * the next element.
 */
export const printGraphicFitStyles: CSSObject = {
  "@media print": {
    // Inline SVGs paint outside the line box when printing. A block box
    // keeps the chart's height in the flow so it does not cover the next
    // heading.
    display: "block",
    maxWidth: "100%",
    // A canvas keeps its pixel height when the width is capped. Fit the
    // bitmap inside that box instead of squashing it horizontally.
    objectFit: "contain",
  },
}

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

import { createElement } from "react"

import { describe, expect, it } from "vitest"

import { Direction } from "~lib/components/core/Layout/utils"
import { render } from "~lib/test_util"

import {
  PRINT_CARD_CLASS,
  StyledColumn,
  StyledFlexContainerBlock,
} from "./styled-components"

/** Only the `<style>` tags a render call adds, not earlier tests' leftovers. */
const cssAddedBy = (renderCall: () => void): string => {
  const before = document.querySelectorAll("style").length
  renderCall()
  return [...document.querySelectorAll("style")]
    .slice(before)
    .map(style => style.textContent ?? "")
    .join("\n")
}

describe("StyledFlexContainerBlock print layout", () => {
  it("only stacks a column row that holds a card, dataframe, or chart", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.HORIZONTAL,
          border: false,
        })
      )
    )

    expect(css).toContain("@media print")
    // The row itself only becomes display:block, and only gives its columns
    // the full page width, when one of them holds a card, dataframe, or
    // chart. A row of compact widgets (metrics, buttons) matches none of
    // these and keeps its normal flex layout.
    expect(css).toContain(`:is(.${PRINT_CARD_CLASS}`)
    expect(css).toContain("[data-testid='stDataFrame']")
    expect(css).toContain("[data-testid='stVegaLiteChart']")
    expect(css).toContain(">.stColumn{display:block")
  })

  it("lets a dataframe's card break across a page so its header can repeat", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: true,
        })
      )
    )

    // A card normally stays on one page so a chart cannot land on the
    // heading below it, but a dataframe print table can be taller than the
    // page. Forcing that card to stay whole would push it onto the next
    // page and clip rows that already fit on this one.
    expect(css).toContain(":not(:has(.stDataFramePrintTable))")
    expect(css).toContain("break-inside:avoid")
  })
})

describe("StyledColumn print layout", () => {
  it("has no print rule of its own; the enclosing row drives it", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledColumn, {
          weight: 0.5,
          gap: undefined,
          showBorder: false,
        })
      )
    )

    // A plain column prints as a normal flex item unless its row's own
    // print rule (tested above) matches and overrides it from outside.
    expect(css).not.toContain("@media print")
  })
})

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

import { Block as BlockProto } from "@streamlit/protobuf"

import { Direction } from "~lib/components/core/Layout/utils"
import { render } from "~lib/test_util"

import {
  PRINT_CARD_CLASS,
  StyledColumn,
  StyledFlexContainerBlock,
  StyledLayoutWrapper,
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
  it("only stacks a column row that holds a card, dataframe, table, or chart", () => {
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
    // the full page width, when one of them holds a card, dataframe, static
    // table, or chart. A row of compact widgets (metrics, buttons) matches
    // none of these and keeps its normal flex layout. Images shrink, and
    // there is no built-in bokeh element class.
    expect(css).toContain(`:is(.${PRINT_CARD_CLASS}`)
    expect(css).toContain(".stDataFrame")
    expect(css).toContain(".stTable")
    expect(css).toContain(".stVegaLiteChart")
    expect(css).not.toContain(".stImage")
    expect(css).not.toContain(".stBokehChart")
    expect(css).toContain(".stPlotlyChart")
    expect(css).toContain(":not([data-st-inactive] *)")
    expect(css).toContain("details:not([open])")
    expect(css).not.toContain("data-testid")
    expect(css).toContain(">.stColumn")
    expect(css).toContain("display:block")
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

    // Landscape is too short for a chart card to finish below the
    // previous one, so the card moves to the next page instead of
    // splitting. A dataframe print table can be taller than the page,
    // and forcing that card to stay whole would clip rows that already
    // fit. Portrait keeps the card in normal flow.
    expect(css).toContain("@media (orientation: landscape)")
    expect(css).toContain(":not(:has(.stDataFramePrintTable))")
    expect(css).toContain("break-inside:avoid")
  })

  it("keeps a centered container's flex alignment and gaps with margin", () => {
    const centered = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          align: BlockProto.FlexContainer.Align.ALIGN_CENTER,
        })
      )
    )
    // No fixed height or gap to clear, but the dataframe-print-table escape
    // hatch (tested below) applies to every flex container.
    expect(centered).toContain("@media print")
    expect(centered).toContain(":has(.stDataFramePrintTable)")
    expect(centered).not.toContain("display:block")

    const gapped = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          gap: { pixelGap: 16 },
        })
      )
    )
    expect(gapped).toContain("margin-bottom:16px")
    // Balloons, snow, and the cache spinner are gone before a print.
    expect(gapped).not.toContain(":not(:has(.stBalloons))")
    expect(gapped).not.toContain(":not(:has(.stSnow))")
    expect(gapped).not.toContain(":not(:has(> .stCacheSpinner))")
    expect(gapped).toContain(":not(:has(> .stPageLink))")
    // The link's own margin only trims the flex gap by xs. The print margin
    // is the gap minus that trim.
    expect(gapped).toContain(":has(> .stPageLink)")
    expect(gapped).toContain("margin-bottom:calc(16px - 0.375rem)")
    expect(gapped).not.toContain("padding-bottom:16px")
  })

  it("keeps flex when a vertical container has a fixed height", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          height: "300px",
        })
      )
    )

    // Stretch children are height 100%. A block parent gives each of them
    // the full container, so a fixed-height container keeps flex, unless it
    // holds an expanded print table, which clips against the fixed height.
    expect(css).not.toContain("display:block")
    expect(css).toContain(
      ":has(.stDataFramePrintTable){height:auto;max-height:none;overflow:visible"
    )
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

describe("StyledLayoutWrapper print layout", () => {
  it("keeps flex for a fixed-height wrapper", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledLayoutWrapper, {
          height: "300px",
        })
      )
    )

    // Stays flex so its child retains the fixed height, unless that child
    // is an expanded print table, which needs to grow past it.
    expect(css).toContain("height:300px")
    expect(css).toContain(
      ":has(.stDataFramePrintTable){display:block;height:auto;max-height:none"
    )
  })
})

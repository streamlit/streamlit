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
  StyledElementContainer,
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
  it("only stacks a column row that holds a dataframe, table, or chart", () => {
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
    // the full page width, when one of them holds a dataframe, static
    // table, or chart. A row of compact widgets (metrics, buttons) matches
    // none of these and keeps its normal flex layout, bordered or not.
    // Images shrink, and there is no built-in bokeh element class.
    expect(css).toContain(":is(.stDataFrame")
    expect(css).not.toContain(`:is(.${PRINT_CARD_CLASS}`)
    expect(css).not.toContain(`>.stColumn.${PRINT_CARD_CLASS},`)
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
    // A stacked column has no definite height, so its height:100% content
    // block would stay a flex column and collapse in Chrome print.
    expect(css).toContain(".stVerticalBlock{display:block")
    expect(css).toContain("margin-bottom:1rem")
  })

  it("keeps a bordered chart card on one page", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: true,
        })
      )
    )

    // A chart prints as one piece and moves to the next page, so a split
    // card would leave an empty bordered strip behind. This applies to both
    // orientations.
    expect(css).toMatch(
      /:has\(:is\(\.stVegaLiteChart[^{]*\{break-inside:avoid/
    )
    expect(css).not.toContain("orientation")

    const plain = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
        })
      )
    )
    expect(plain).not.toContain("break-inside")
  })

  it("keeps bordered chart columns and a side-by-side card row on one page", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.HORIZONTAL,
          border: false,
          // A gap the other horizontal test does not use, so emotion adds
          // a new style tag instead of reusing that one.
          gap: { pixelGap: 12 },
        })
      )
    )

    expect(css).toMatch(
      new RegExp(
        `>\\.stColumn\\.${PRINT_CARD_CLASS}:has\\(:is\\(\\.stVegaLiteChart[^{]*\\{break-inside:avoid`
      )
    )
    // The whole row only stays together while it is not stacked.
    expect(css).toMatch(
      new RegExp(
        `:has\\(>\\s?\\.stColumn\\.${PRINT_CARD_CLASS}\\):not\\(:has\\(>\\s?\\.stColumn :is\\(\\.stDataFrame[^{]*\\{break-inside:avoid`
      )
    )
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
    // Balloons and snow are display:none in print, so the gap margin does
    // not exclude them.
    expect(gapped).not.toContain(":not(:has(.stBalloons))")
    expect(gapped).not.toContain(":not(:has(.stSnow))")
    expect(gapped).toContain(":not(:has(> .stPageLink))")
    expect(gapped).toContain(":not(:has(> .stCacheSpinner))")
    // A page link trims the flex gap by xs and a cache spinner cancels it
    // with -lg. The print margin is the gap minus that trim.
    expect(gapped).toContain(":has(> .stPageLink)")
    expect(gapped).toContain("margin-bottom:calc(16px - 0.375rem)")
    expect(gapped).toContain("margin-bottom:calc(16px - 1rem)")
    expect(gapped).not.toContain("padding-bottom:16px")
  })

  it("keeps flex when a vertical container has a fixed height", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          height: "300px",
          gap: { pixelGap: 16 },
        })
      )
    )

    // Stretch children are height 100%. A block parent gives each of them
    // the full container, so a fixed-height container keeps flex and its
    // gap, and print adds no block margin.
    expect(css).toContain("height:300px")
    expect(css).not.toContain("display:block")
    expect(css).not.toContain("margin-bottom")
  })

  it("uses block layout for a content-height container that only aligns vertically", () => {
    const css = cssAddedBy(() =>
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          justify: BlockProto.FlexContainer.Justify.SPACE_BETWEEN,
        })
      )
    )

    expect(css).toMatch(/@media print\{[^}]*display:block/)
  })
})

describe("StyledElementContainer print layout", () => {
  it("hides a balloons or snow container so the print gap leaves no blank strip", () => {
    const balloons = cssAddedBy(() =>
      render(
        createElement(StyledElementContainer, {
          isStale: false,
          width: "100%",
          height: "auto",
          elementType: "balloons",
          overflow: "visible",
        })
      )
    )
    expect(balloons).toContain("margin-bottom:-1rem")
    expect(balloons).toContain("@media print")
    expect(balloons).toContain("display:none")

    const text = cssAddedBy(() =>
      render(
        createElement(StyledElementContainer, {
          isStale: false,
          width: "100%",
          height: "auto",
          elementType: "markdown",
          overflow: "visible",
        })
      )
    )
    expect(text).not.toContain("display:none")
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

    // Stays flex so its child retains the fixed height.
    expect(css).toContain("height:300px")
    expect(css).not.toContain("display:block")

    const contentHeight = cssAddedBy(() =>
      render(createElement(StyledLayoutWrapper, { height: "auto" }))
    )
    expect(contentHeight).toMatch(/@media print\{[^}]*display:block/)
  })
})

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

import type { RenderResult } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Block as BlockProto } from "@streamlit/protobuf"

import { Direction } from "~lib/components/core/Layout/utils"
import { render } from "~lib/test_util"

import {
  PRINT_CARD_CLASS,
  PRINT_HIDDEN_CLASS,
  StyledColumn,
  StyledElementContainer,
  StyledFlexContainerBlock,
  StyledLayoutWrapper,
} from "./styled-components"

/**
 * The CSS rules of the rendered component's own emotion classes. Emotion
 * shares a class between identical styles, so the result does not depend on
 * which other tests rendered first.
 */
const cssOf = ({ container }: RenderResult): string => {
  const classNames = [...(container.firstElementChild?.classList ?? [])]
    .filter(className => className.startsWith("css-"))
    .map(className => new RegExp(`\\.${className}(?![\\w-])`))
  expect(classNames).not.toHaveLength(0)
  return [...document.querySelectorAll("style")]
    .map(style => style.textContent ?? "")
    .filter(rule => classNames.some(className => className.test(rule)))
    .join("\n")
}

/** A print `display:block` on the component's own class, not a nested rule. */
const OWN_PRINT_BLOCK = /@media print\{\.[\w-]+\{[^}]*display:block/

describe("StyledFlexContainerBlock print layout", () => {
  it("only stacks a column row that holds a dataframe, table, or chart", () => {
    const css = cssOf(
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
    // A stacked column grows only as far as its chart can scale, so a card
    // does not stretch across the page around a narrower chart.
    expect(css).toContain(
      ">.stColumn{display:block;width:min(100%, calc(var(--st-print-screen-width, 100%) * 1.25))"
    )
  })

  it("makes the columns of a side-by-side row size containers", () => {
    const css = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.HORIZONTAL,
          border: false,
        })
      )
    )

    // `cqi` inside a printed column then resolves at paper width, which a
    // content-width metric scales to. A stacking row is not matched.
    expect(css).toMatch(
      /:not\(:has\(> ?\.stColumn :is\(\.stDataFrame[^{]*\)\) ?> ?\.stColumn\{container-type:inline-size/
    )
    expect(css).not.toContain("float:")
    expect(
      cssOf(
        render(
          createElement(StyledFlexContainerBlock, {
            direction: Direction.HORIZONTAL,
            border: false,
            isContentSized: true,
          })
        )
      )
    ).not.toContain("container-type")
    expect(
      cssOf(
        render(
          createElement(StyledFlexContainerBlock, {
            direction: Direction.VERTICAL,
            border: false,
          })
        )
      )
    ).not.toContain("container-type")
  })

  it("stacks a horizontal container that holds a chart", () => {
    const css = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.HORIZONTAL,
          border: false,
          gap: { pixelGap: 20 },
        })
      )
    )

    // A columns row is excluded, because its columns stack through the
    // `.stColumn` rule. Each stacked child keeps its own width, capped to
    // the container, and the gap becomes a bottom margin.
    expect(css).toMatch(
      /:not\(:has\(> ?\.stColumn\)\):has\(:is\(\.stDataFrame[^{]*\{display:block;height:auto;overflow:visible/
    )
    expect(css).toMatch(
      /:not\(:has\(> ?\.stColumn\)\):has\([^{]*> ?\*\{max-width:100%;min-width:0/
    )
    expect(css).not.toMatch(
      /:not\(:has\(> ?\.stColumn\)\):has\([^{]*> ?\*\{[^}]*(?<!max-|min-)width:100%/
    )
    expect(css).toContain("margin-bottom:20px")
  })

  it("keeps a bordered chart card on one page", () => {
    const css = cssOf(
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

    const plain = cssOf(
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
    const css = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.HORIZONTAL,
          border: false,
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
    const centered = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          align: BlockProto.FlexContainer.Align.ALIGN_CENTER,
        })
      )
    )
    expect(centered).not.toContain("display:block")

    const gapped = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          gap: { pixelGap: 16 },
        })
      )
    )
    expect(gapped).toContain("margin-bottom:16px")
    // Only a child with a printed sibling after it gets the gap, so a
    // trailing st.empty, balloons, or snow container adds no blank strip.
    expect(gapped).toContain(`:has(~ :not(.${PRINT_HIDDEN_CLASS}))`)
    expect(gapped).not.toContain(":last-child")
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
    const css = cssOf(
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
    // gap, and print adds no block margin on its own class.
    expect(css).toContain("height:300px")
    expect(css).not.toMatch(OWN_PRINT_BLOCK)
    expect(css).not.toMatch(/\.css-[\w-]+ ?> ?:has\(~/)
  })

  it("releases a fixed height around a descendant row that stacks in print", () => {
    const css = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          height: "300px",
          overflow: "auto",
          gap: { pixelGap: 17 },
        })
      )
    )

    // Print cannot scroll, so the stacked row would be cut off at the
    // fixed height. The block grows to fit it as a block box.
    expect(css).toMatch(
      /:has\(\.stHorizontalBlock :is\(\.stDataFrame[^{]*\{height:auto;max-height:none;overflow:visible;display:block/
    )
    expect(css).toContain("margin-bottom:17px")
    // A stretch-height element was sized by the fixed height through size
    // containment. It drops containment so it keeps its content's height.
    expect(css).toMatch(
      /:has\(\.stHorizontalBlock [^{]*>[^{]*\{contain:none;?\}/
    )

    const centered = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          height: "301px",
          align: BlockProto.FlexContainer.Align.ALIGN_CENTER,
        })
      )
    )
    expect(centered).toMatch(
      /:has\(\.stHorizontalBlock [^{]*\{height:auto;max-height:none;overflow:visible;?\}/
    )
    expect(centered).not.toContain("display:block")

    const contentHeight = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
        })
      )
    )
    expect(contentHeight).not.toContain(":has(.stHorizontalBlock")
  })

  it("keeps flex for a percentage height only when it is definite", () => {
    // A form, expander, or chat message passes height 100%, which resolves
    // to auto in a content-height parent.
    const contentSized = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          height: "100%",
          gap: { pixelGap: 18 },
        })
      )
    )
    expect(contentSized).toMatch(/@media print\{[^}]*display:block/)

    const definite = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.VERTICAL,
          border: false,
          height: "100%",
          hasDefiniteHeight: true,
          gap: { pixelGap: 19 },
        })
      )
    )
    expect(definite).not.toMatch(OWN_PRINT_BLOCK)
  })

  it("uses block layout for a content-height container that only aligns vertically", () => {
    const css = cssOf(
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
    const balloons = cssOf(
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

    const text = cssOf(
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
    const css = cssOf(
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
    const css = cssOf(
      render(
        createElement(StyledLayoutWrapper, {
          height: "300px",
        })
      )
    )

    // Stays flex so its child retains the fixed height.
    expect(css).toContain("height:300px")
    expect(css).not.toMatch(OWN_PRINT_BLOCK)

    const contentHeight = cssOf(
      render(createElement(StyledLayoutWrapper, { height: "auto" }))
    )
    expect(contentHeight).toMatch(OWN_PRINT_BLOCK)

    const stretchInDefiniteParent = cssOf(
      render(
        createElement(StyledLayoutWrapper, {
          height: "auto",
          flex: "0 1 100%",
          hasDefiniteHeight: true,
        })
      )
    )
    expect(stretchInDefiniteParent).toContain("flex:0 1 100%")
    expect(stretchInDefiniteParent).not.toMatch(OWN_PRINT_BLOCK)
  })

  it("releases a fixed height around a row that stacks a chart", () => {
    const css = cssOf(
      render(
        createElement(StyledLayoutWrapper, {
          height: "250px",
          flex: "0 0 250px",
        })
      )
    )

    // The row can be the wrapper's own container or nested inside it.
    expect(css).toMatch(
      /:has\(\.stHorizontalBlock :is\(\.stDataFrame[^{]*\{display:block;[^}]*flex:0 0 auto;height:auto;max-height:none/
    )
    expect(css).not.toContain(":has(> .stHorizontalBlock")
  })
})

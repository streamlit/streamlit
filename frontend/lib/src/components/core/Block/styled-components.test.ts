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

import { PrintLayout } from "./ElementContainerConfig"
import {
  PRINT_BORDERED_COLUMN_CLASS,
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
    // the full page width, when one of them holds an element that opted
    // into a fixed-width print layout (a dataframe, static table, or chart).
    // A row of compact widgets (metrics, buttons) keeps its normal flex
    // layout, bordered or not.
    expect(css).toMatch(
      new RegExp(
        `:is\\(\\.${PrintLayout.FIXED_WIDTH}, ?\\.${PrintLayout.GRAPHIC}\\)`
      )
    )
    expect(css).not.toContain(`:is(.${PRINT_BORDERED_COLUMN_CLASS}`)
    expect(css).not.toContain(`>.stColumn.${PRINT_BORDERED_COLUMN_CLASS},`)
    // Elements opt in through ElementContainerConfig, so the row names none.
    expect(css).not.toContain(".stDataFrame")
    expect(css).not.toContain(".stVegaLiteChart")
    expect(css).not.toContain("container-type")
    expect(css).toContain(":not([data-st-inactive] *)")
    expect(css).toContain("details:not([open])")
    expect(css).not.toContain("data-testid")
    expect(css).toContain(">.stColumn")
    expect(css).toContain("display:block")
    // A stacked column has no definite height, so its height:100% content
    // block would stay a flex column and collapse in Chrome print.
    expect(css).toContain(".stVerticalBlock{display:block")
    expect(css).toContain("margin-bottom:1rem")
    expect(css).toContain(">.stColumn{display:block;width:100%;min-width:0")
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
      /:not\(:has\(> ?\.stColumn\)\):has\(:is\(\.stPrintFixedWidth[^{]*\{display:block;height:auto;overflow:visible/
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
    // card would leave an empty bordered strip behind. A visible dataframe
    // or table has to paginate, so its card may still break. This applies
    // to both orientations.
    expect(css).toMatch(
      /:has\(\.stPrintGraphic[^{]*:not\(:has\(\.stPrintFixedWidth[^{]*\{break-inside:avoid/
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

  it("keeps a side-by-side row of bordered columns on one page", () => {
    const css = cssOf(
      render(
        createElement(StyledFlexContainerBlock, {
          direction: Direction.HORIZONTAL,
          border: false,
          gap: { pixelGap: 12 },
        })
      )
    )

    // The whole row only stays together while it is not stacked.
    expect(css).toMatch(
      new RegExp(
        `:has\\(>\\s?\\.stColumn\\.${PRINT_BORDERED_COLUMN_CLASS}\\):not\\(:has\\(>\\s?\\.stColumn :is\\(\\.stPrintFixedWidth[^{]*\\{break-inside:avoid`
      )
    )
    // A single bordered chart column is kept together by StyledColumn.
    expect(css).not.toContain(`>.stColumn.${PRINT_BORDERED_COLUMN_CLASS}:has(`)
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
    // Every child but the last gets the gap as a bottom margin.
    expect(gapped).toMatch(/> ?:not\(:last-child\)\{margin-bottom:16px/)
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
    expect(css).not.toMatch(/\.css-[\w-]+ ?> ?:not\(:last-child\)/)
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
      /:has\(\.stHorizontalBlock :is\(\.stPrintFixedWidth[^{]*\{height:auto;max-height:none;overflow:visible;display:block/
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

  it("trims a page link's gap on screen only", () => {
    const css = cssOf(
      render(
        createElement(StyledElementContainer, {
          isStale: false,
          width: "100%",
          height: "auto",
          elementType: "pageLink",
          overflow: "visible",
        })
      )
    )

    // Print gives every child a gap margin, which the negative margins
    // would cancel.
    expect(css).toMatch(
      /@media screen\{[^}]*:has\(> ?\.stPageLink\)\{margin-top:-0\.375rem;margin-bottom:-0\.375rem/
    )
    expect(css).not.toMatch(/@media print\{[^}]*stPageLink/)
  })

  it("releases reserved height around a dataframe print table", () => {
    const css = cssOf(
      render(
        createElement(StyledElementContainer, {
          isStale: false,
          width: "100%",
          height: "300px",
          elementType: "arrowDataFrame",
          overflow: "visible",
        })
      )
    )

    expect(css).toMatch(
      /:has\(\.stDataFramePrintTable\)\{height:auto;max-height:none;[^}]*flex:0 0 auto;contain:none/
    )
  })
})

describe("StyledColumn print layout", () => {
  it("gives a plain column no print rule of its own", () => {
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

  it("keeps a bordered column with a chart on one page", () => {
    const css = cssOf(
      render(
        createElement(StyledColumn, {
          weight: 0.5,
          gap: undefined,
          showBorder: true,
        })
      )
    )

    // A visible dataframe or table must be allowed to paginate, so the
    // keep-together rule skips cards that hold one.
    expect(css).toMatch(
      /@media print\{[^}]*:has\(\.stPrintGraphic[^{]*:not\(:has\(\.stPrintFixedWidth[^{]*\{break-inside:avoid/
    )
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
      /:has\(\.stHorizontalBlock :is\(\.stPrintFixedWidth[^{]*\{display:block;[^}]*flex:0 0 auto;height:auto;max-height:none/
    )
    expect(css).not.toContain(":has(> .stHorizontalBlock")
  })
})

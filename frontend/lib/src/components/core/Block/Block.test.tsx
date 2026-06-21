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

import { ReactElement } from "react"

import { screen } from "@testing-library/react"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import { ScriptRunState } from "~lib/ScriptRunState"
import { renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { BlockNodeRenderer, FlexBoxContainer, VerticalBlock } from "./Block"

const FAKE_SCRIPT_HASH = "fake_script_hash"

function makeColumn(weight: number, children: BlockNode[] = []): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true, column: { weight } })
  )
}

function makeHorizontalBlockWithColumns(numColumns: number): BlockNode {
  const weight = 1 / numColumns

  return new BlockNode(
    FAKE_SCRIPT_HASH,
    Array.from({ length: numColumns }, () => makeColumn(weight)),
    new BlockProto({
      allowEmpty: true,
      flexContainer: {
        gapConfig: {
          gapSize: streamlit.GapSize.SMALL,
        },
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
      },
    })
  )
}

function makeVerticalBlock(
  children: BlockNode[] = [],
  additionalProps: Partial<BlockProto> = {}
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true, ...additionalProps })
  )
}

function makeVerticalBlockComponent(node: BlockNode): ReactElement {
  return (
    <FlexBoxContainer
      node={node}
      scriptRunId={""}
      scriptRunState={ScriptRunState.NOT_RUNNING}
      widgetsDisabled={false}
      // @ts-expect-error
      widgetMgr={undefined}
      // @ts-expect-error
      uploadClient={undefined}
    />
  )
}

describe("FlexBoxContainer Block Component", () => {
  it("should render a horizontal block with empty columns", () => {
    const block: BlockNode = makeVerticalBlock([
      makeHorizontalBlockWithColumns(4),
    ])
    renderWithContexts(makeVerticalBlockComponent(block))

    const horizontalBlock = screen.getByTestId("stHorizontalBlock")
    expect(horizontalBlock).toBeVisible()
    expect(horizontalBlock).toHaveAttribute("direction", "row")

    expect(screen.getAllByTestId("stColumn")).toHaveLength(4)
    expect(screen.getAllByTestId("stVerticalBlock")[0]).not.toHaveStyle(
      "overflow: auto"
    )
  })

  it("should add the user-specified key as class", () => {
    const block: BlockNode = makeVerticalBlock([], {
      id: "$$ID-899e9b72e1539f21f8e82565d36609d0-first container",
    })
    renderWithContexts(makeVerticalBlockComponent(block))

    expect(screen.getByTestId("stVerticalBlock")).toBeVisible()
    expect(screen.getByTestId("stVerticalBlock")).toHaveClass(
      "st-key-first-container"
    )
  })

  it("should activate scrolling when height is set", () => {
    const block: BlockNode = makeVerticalBlock(
      [makeHorizontalBlockWithColumns(4)],
      {
        heightConfig: { pixelHeight: 100 },
      }
    )

    renderWithContexts(makeVerticalBlockComponent(block))

    expect(screen.getAllByTestId("stVerticalBlock")[0]).toHaveStyle(
      "overflow: auto"
    )
  })

  it("should show border when border is True", () => {
    const block: BlockNode = makeVerticalBlock(
      [makeHorizontalBlockWithColumns(4)],
      {
        flexContainer: { border: true },
      }
    )
    renderWithContexts(makeVerticalBlockComponent(block))

    expect(screen.getAllByTestId("stVerticalBlock")[0]).toHaveStyle(
      "border: 1px solid rgba(49, 51, 63, 0.2);"
    )
  })

  describe("VerticalBlock", () => {
    it("should render and be visible", () => {
      const block = new BlockNode(FAKE_SCRIPT_HASH, [], new BlockProto())
      renderWithContexts(
        <VerticalBlock
          node={block}
          scriptRunId={""}
          scriptRunState={ScriptRunState.NOT_RUNNING}
          widgetsDisabled={false}
          // @ts-expect-error
          widgetMgr={undefined}
          // @ts-expect-error
          uploadClient={undefined}
        />
      )
      const verticalBlock = screen.getByTestId("stVerticalBlock")
      expect(verticalBlock).toBeVisible()
    })
  })
})

describe("FlexBoxContainer layout props", () => {
  it.each([
    [
      "align: start",
      { align: BlockProto.FlexContainer.Align.ALIGN_START },
      "align-items: start;",
    ],
    [
      "align: center",
      { align: BlockProto.FlexContainer.Align.ALIGN_CENTER },
      "align-items: center;",
    ],
    [
      "align: end",
      { align: BlockProto.FlexContainer.Align.ALIGN_END },
      "align-items: end;",
    ],
    [
      "align: stretch",
      { align: BlockProto.FlexContainer.Align.STRETCH },
      "align-items: stretch;",
    ],
  ])("should apply %s", (_desc, flexContainer, expectedStyle) => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer,
    })
    renderWithContexts(makeVerticalBlockComponent(block))
    expect(screen.getByTestId("stVerticalBlock")).toHaveStyle(expectedStyle)
  })

  it.each([
    [
      "justify: start",
      { justify: BlockProto.FlexContainer.Justify.JUSTIFY_START },
      "justify-content: start;",
    ],
    [
      "justify: center",
      { justify: BlockProto.FlexContainer.Justify.JUSTIFY_CENTER },
      "justify-content: center;",
    ],
    [
      "justify: end",
      { justify: BlockProto.FlexContainer.Justify.JUSTIFY_END },
      "justify-content: end;",
    ],
    [
      "justify: space-between",
      { justify: BlockProto.FlexContainer.Justify.SPACE_BETWEEN },
      "justify-content: space-between;",
    ],
  ])("should apply %s", (_desc, flexContainer, expectedStyle) => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer,
    })
    renderWithContexts(makeVerticalBlockComponent(block))
    expect(screen.getByTestId("stVerticalBlock")).toHaveStyle(expectedStyle)
  })

  it.each([
    [
      "gap: xxsmall",
      { gapConfig: { gapSize: streamlit.GapSize.XXSMALL } },
      "gap: 0.25rem;",
    ],
    [
      "gap: xsmall",
      { gapConfig: { gapSize: streamlit.GapSize.XSMALL } },
      "gap: 0.5rem;",
    ],
    [
      "gap: small",
      { gapConfig: { gapSize: streamlit.GapSize.SMALL } },
      "gap: 1rem;",
    ],
    [
      "gap: medium",
      { gapConfig: { gapSize: streamlit.GapSize.MEDIUM } },
      "gap: 2rem;",
    ],
    [
      "gap: large",
      { gapConfig: { gapSize: streamlit.GapSize.LARGE } },
      "gap: 4rem;",
    ],
    [
      "gap: xlarge",
      { gapConfig: { gapSize: streamlit.GapSize.XLARGE } },
      "gap: 6rem;",
    ],
    [
      "gap: xxlarge",
      { gapConfig: { gapSize: streamlit.GapSize.XXLARGE } },
      "gap: 8rem;",
    ],
    [
      "gap: none",
      { gapConfig: { gapSize: streamlit.GapSize.NONE } },
      "gap: 0;",
    ],
  ])("should apply %s", (_desc, flexContainer, expectedStyle) => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer,
    })
    renderWithContexts(makeVerticalBlockComponent(block))
    expect(screen.getByTestId("stVerticalBlock")).toHaveStyle(expectedStyle)
  })

  it.each([
    ["wrap: true", { wrap: true }, "flex-wrap: wrap;"],
    ["wrap: false", { wrap: false }, "flex-wrap: nowrap;"],
  ])("should apply %s", (_desc, flexContainer, expectedStyle) => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer,
    })
    renderWithContexts(makeVerticalBlockComponent(block))
    expect(screen.getByTestId("stVerticalBlock")).toHaveStyle(expectedStyle)
  })
})

describe("BlockNodeRenderer CSS key class placement", () => {
  const widgetMgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

  function makeBlockNodeComponent(node: BlockNode): ReactElement {
    return (
      <BlockNodeRenderer
        node={node}
        scriptRunId=""
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        widgetMgr={widgetMgr}
        // @ts-expect-error
        uploadClient={undefined}
      />
    )
  }

  it("places st-key-* on StyledLayoutWrapper for expander blocks", () => {
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        expandable: { label: "test expander", expanded: false },
        id: "$$ID-abc123-my_expander",
      })
    )

    renderWithContexts(makeBlockNodeComponent(node))

    const layoutWrapper = screen.getByTestId("stLayoutWrapper")
    expect(layoutWrapper).toHaveClass("st-key-my_expander")

    const innerBlock = screen.getByTestId("stVerticalBlock")
    expect(innerBlock.className).not.toContain("st-key-")
  })

  it("places st-key-* on StyledLayoutWrapper for popover blocks", () => {
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        // open: true so the popover body is mounted and stVerticalBlock is in the DOM
        popover: { label: "test popover", open: true },
        id: "$$ID-abc123-my_popover",
      })
    )

    renderWithContexts(makeBlockNodeComponent(node))

    const layoutWrapper = screen.getByTestId("stLayoutWrapper")
    expect(layoutWrapper).toHaveClass("st-key-my_popover")

    const innerBlock = screen.getByTestId("stVerticalBlock")
    expect(innerBlock.className).not.toContain("st-key-")
  })
})

describe("GridContainer Component", () => {
  function makeGridBlock(
    gridContainerProps: Partial<BlockProto.IGridContainer> = {},
    children: BlockNode[] = []
  ): BlockNode {
    return new BlockNode(
      FAKE_SCRIPT_HASH,
      children,
      new BlockProto({
        allowEmpty: true,
        gridContainer: {
          maxColumns: 0,
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          showCellBorder: false,
          cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT,
          ...gridContainerProps,
        },
      })
    )
  }

  const widgetMgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

  function makeGridNodeRendererComponent(node: BlockNode): ReactElement {
    return (
      <BlockNodeRenderer
        node={node}
        scriptRunId=""
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        widgetMgr={widgetMgr}
        // @ts-expect-error
        uploadClient={undefined}
      />
    )
  }

  it("should render a grid container", () => {
    const block = makeGridBlock()
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toBeVisible()
    expect(gridContainer).toHaveClass("stGrid")
  })

  it("should apply display: grid style", () => {
    const block = makeGridBlock()
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveStyle("display: grid")
  })

  it("should apply auto-fit grid template columns in auto mode", () => {
    const block = makeGridBlock({
      maxColumns: 0,
      minColumnWidthPx: 200,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    // Check that it uses auto-fit with minmax
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr))"
    )
  })

  it("should apply fixed column template in fixed mode without min width", () => {
    const block = makeGridBlock({
      maxColumns: 3,
      minColumnWidthPx: 0,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(3, minmax(0, 1fr))"
    )
  })

  it.each([
    [
      "row gap: small, column gap: small",
      {
        rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
        columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
      },
      "gap: 1rem 1rem;",
    ],
    [
      "row gap: medium, column gap: large",
      {
        rowGapConfig: { gapSize: streamlit.GapSize.MEDIUM },
        columnGapConfig: { gapSize: streamlit.GapSize.LARGE },
      },
      "gap: 2rem 4rem;",
    ],
    [
      "row gap: none, column gap: none",
      {
        rowGapConfig: { gapSize: streamlit.GapSize.NONE },
        columnGapConfig: { gapSize: streamlit.GapSize.NONE },
      },
      "gap: 0 0;",
    ],
  ])("should apply %s", (_desc, gapConfig, expectedStyle) => {
    const block = makeGridBlock(gapConfig)
    renderWithContexts(makeGridNodeRendererComponent(block))
    expect(screen.getByTestId("stGrid")).toHaveStyle(expectedStyle)
  })

  it.each([
    [
      "auto rows: auto for content mode",
      { cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT },
      "grid-auto-rows: auto;",
    ],
    [
      "auto rows: 1fr for equal mode",
      { cellHeightMode: BlockProto.GridContainer.CellHeightMode.EQUAL },
      "grid-auto-rows: 1fr;",
    ],
    [
      "auto rows: fixed px for fixed mode",
      {
        cellHeightMode: BlockProto.GridContainer.CellHeightMode.FIXED,
        cellHeightConfig: { pixelHeight: 100 },
      },
      "grid-auto-rows: 100px;",
    ],
  ])("should apply %s", (_desc, cellConfig, expectedStyle) => {
    const block = makeGridBlock(cellConfig)
    renderWithContexts(makeGridNodeRendererComponent(block))
    expect(screen.getByTestId("stGrid")).toHaveStyle(expectedStyle)
  })

  it("should apply user key as CSS class", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        gridContainer: {
          maxColumns: 0,
          minColumnWidthPx: 220,
        },
        id: "$$ID-abc123-my_grid",
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveClass("st-key-my_grid")
  })
})

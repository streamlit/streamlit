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

import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import { text } from "~lib/render-tree/test-utils"
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

function makeColumnsRow({
  weights,
  wrap = true,
  resizable = false,
  children,
}: {
  weights: number[]
  wrap?: boolean
  resizable?: boolean
  /** Overrides the columns derived from `weights`, e.g. to nest a row. */
  children?: BlockNode[]
}): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children ?? weights.map(weight => makeColumn(weight)),
    new BlockProto({
      allowEmpty: true,
      flexContainer: {
        gapConfig: {
          gapSize: streamlit.GapSize.SMALL,
        },
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        wrap,
        resizable,
      },
    })
  )
}

function makeHorizontalBlockWithColumns(
  numColumns: number,
  wrap = true
): BlockNode {
  return makeColumnsRow({
    weights: Array.from({ length: numColumns }, () => 1 / numColumns),
    wrap,
  })
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
    ["gap: 0 pixels", { gapConfig: { pixelGap: 0 } }, "gap: 0px;"],
    ["gap: 20 pixels", { gapConfig: { pixelGap: 20 } }, "gap: 20px;"],
    ["gap: 50 pixels", { gapConfig: { pixelGap: 50 } }, "gap: 50px;"],
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

  it("enables horizontal scrolling for a horizontal container with wrap=false", () => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        wrap: false,
      },
    })
    renderWithContexts(makeVerticalBlockComponent(block))

    const horizontalBlock = screen.getByTestId("stHorizontalBlock")
    expect(horizontalBlock).toHaveStyle("overflow-x: auto;")
    expect(horizontalBlock).toHaveStyle("overflow-y: visible;")
    expect(horizontalBlock).toHaveStyle("flex-wrap: nowrap;")
    expect(horizontalBlock).toHaveAttribute("data-test-wrap", "false")
  })

  it("adds focus-ring padding compensation for an unbordered horizontal scroll container", () => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        wrap: false,
        border: false,
      },
    })
    renderWithContexts(makeVerticalBlockComponent(block))

    // An unbordered scroll container gets vertical padding (cancelled by a
    // negative margin) so child focus rings and shadows are not clipped by the
    // browser-coerced cross-axis overflow.
    const horizontalBlock = screen.getByTestId("stHorizontalBlock")
    expect(horizontalBlock).toHaveStyle("overflow-x: auto;")
    expect(horizontalBlock).toHaveStyle("overflow-y: visible;")
    expect(horizontalBlock).toHaveStyle("padding-block: 0.2rem;")
    expect(horizontalBlock).toHaveStyle("margin-block: -0.2rem;")
  })

  it("omits focus-ring padding compensation for a bordered horizontal scroll container", () => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        wrap: false,
        border: true,
      },
    })
    renderWithContexts(makeVerticalBlockComponent(block))

    // A bordered container already has enough internal padding, so it must not
    // add the extra focus-ring compensation margin.
    const horizontalBlock = screen.getByTestId("stHorizontalBlock")
    expect(horizontalBlock).toHaveStyle("overflow-x: auto;")
    expect(horizontalBlock).toHaveStyle("overflow-y: visible;")
    expect(horizontalBlock).not.toHaveStyle("margin-block: -0.2rem;")
  })

  it("does not enable horizontal scrolling for a horizontal container with wrap=true", () => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        wrap: true,
      },
    })
    renderWithContexts(makeVerticalBlockComponent(block))

    const horizontalBlock = screen.getByTestId("stHorizontalBlock")
    expect(horizontalBlock).not.toHaveStyle("overflow-x: auto;")
    expect(horizontalBlock).toHaveStyle("flex-wrap: wrap;")
    expect(horizontalBlock).toHaveAttribute("data-test-wrap", "true")
  })

  it("does not enable horizontal scrolling for a vertical container with wrap=false", () => {
    const block: BlockNode = makeVerticalBlock([], {
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.VERTICAL,
        wrap: false,
      },
    })
    renderWithContexts(makeVerticalBlockComponent(block))

    expect(screen.getByTestId("stVerticalBlock")).not.toHaveStyle(
      "overflow-x: auto;"
    )
  })

  it("should set min-width on columns when wrap is false", () => {
    const block: BlockNode = makeVerticalBlock([
      makeHorizontalBlockWithColumns(3, false),
    ])
    renderWithContexts(makeVerticalBlockComponent(block))

    const columns = screen.getAllByTestId("stColumn")
    expect(columns).toHaveLength(3)
    for (const column of columns) {
      expect(column).toHaveStyle("min-width: 8rem;")
    }
  })

  it("should not set the nowrap min-width floor when wrap is true", () => {
    const block: BlockNode = makeVerticalBlock([
      makeHorizontalBlockWithColumns(3, true),
    ])
    renderWithContexts(makeVerticalBlockComponent(block))

    const columns = screen.getAllByTestId("stColumn")
    expect(columns).toHaveLength(3)
    for (const column of columns) {
      expect(column).not.toHaveStyle("min-width: 8rem;")
    }
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

describe("BlockNodeRenderer transparent blocks", () => {
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

  it("renders children directly with no wrapping container", () => {
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("transparent child")],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )

    renderWithContexts(makeBlockNodeComponent(node))

    expect(screen.getByText("transparent child")).toBeVisible()

    expect(screen.queryByTestId("stVerticalBlock")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stLayoutWrapper")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stExpander")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stColumn")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stHorizontalBlock")).not.toBeInTheDocument()
  })

  it("renders nothing when empty even with allowEmpty", () => {
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )

    const { container } = renderWithContexts(makeBlockNodeComponent(node))

    expect(container).toBeEmptyDOMElement()
  })

  it("column inside transparent wrapper renders directly in parent horizontal block", () => {
    const column = makeColumn(0.5)
    const transparentBlock = new BlockNode(
      FAKE_SCRIPT_HASH,
      [column],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    const horizontalBlock = new BlockNode(
      FAKE_SCRIPT_HASH,
      [transparentBlock],
      new BlockProto({
        allowEmpty: true,
        flexContainer: {
          gapConfig: { gapSize: streamlit.GapSize.SMALL },
          direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        },
      })
    )
    const root = makeVerticalBlock([horizontalBlock])

    renderWithContexts(makeVerticalBlockComponent(root))

    const horizontalBlockEl = screen.getByTestId("stHorizontalBlock")
    expect(horizontalBlockEl).toHaveAttribute("direction", "row")

    // Column is a direct descendant of the horizontal block — no transparent wrapper DOM.
    const columnEl = within(horizontalBlockEl).getByTestId("stColumn")
    expect(columnEl).toBeVisible()

    // Transparent wrapper adds no extra stVerticalBlock.
    expect(screen.getAllByTestId("stVerticalBlock")).toHaveLength(2)
  })
})

describe("resizable columns", () => {
  /** Width the row is mocked at, so 80px of drag equals 10% of the row. */
  const ROW_WIDTH = 800

  const DRAG_START_X = 200

  function setViewportWidth(innerWidth: number): void {
    Object.defineProperty(window, "innerWidth", {
      value: innerWidth,
      writable: true,
      configurable: true,
    })
  }

  beforeEach(() => {
    // Flush the drag's coalesced update synchronously so assertions don't have
    // to await a real animation frame.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0)
      return 0
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setViewportWidth(1024)
  })

  function renderRow(row: BlockNode): void {
    renderWithContexts(makeVerticalBlockComponent(makeVerticalBlock([row])))

    // jsdom reports a zero-size rect for every element, so the row has to be
    // given a width for a pixel drag to translate into a width fraction.
    const [rowElement] = screen.getAllByTestId("stHorizontalBlock")
    vi.spyOn(rowElement, "getBoundingClientRect").mockReturnValue({
      width: ROW_WIDTH,
    } as DOMRect)
  }

  async function dragBy(handle: HTMLElement, deltaPx: number): Promise<void> {
    const user = userEvent.setup()
    const endX = DRAG_START_X + deltaPx

    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: handle,
        coords: { clientX: DRAG_START_X },
      },
      { target: handle, coords: { clientX: endX } },
      { keys: "[/MouseLeft]", target: handle, coords: { clientX: endX } },
    ])
  }

  it("renders a handle between each adjacent pair of columns", () => {
    renderRow(makeColumnsRow({ weights: [0.25, 0.25, 0.5], resizable: true }))

    const columns = screen.getAllByTestId("stColumn")
    expect(columns).toHaveLength(3)
    // Two boundaries for three columns: the last column never gets a handle.
    expect(screen.getAllByRole("separator")).toHaveLength(2)
    for (const column of columns) {
      // Anchors the absolutely positioned handle.
      expect(column).toHaveStyle("position: relative")
      // A min-width would let a clamped column claim more than its weight and
      // wrap the row onto a second line, so the floor lives in the drag math.
      expect(column).not.toHaveStyle("min-width: 4rem")
    }
  })

  it("renders no handle for a single resizable column", () => {
    renderRow(makeColumnsRow({ weights: [1], resizable: true }))

    expect(screen.getAllByTestId("stColumn")).toHaveLength(1)
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
  })

  it("renders no handles for columns that did not opt in", () => {
    renderRow(makeColumnsRow({ weights: [0.5, 0.5] }))

    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
    for (const column of screen.getAllByTestId("stColumn")) {
      expect(column).not.toHaveStyle("position: relative")
      expect(column).not.toHaveStyle("min-width: 4rem")
    }
  })

  it("renders no handles when the row holds more than just columns", () => {
    renderRow(
      makeColumnsRow({
        weights: [],
        resizable: true,
        children: [makeColumn(0.5), makeVerticalBlock([])],
      })
    )

    expect(screen.getByTestId("stColumn")).toBeVisible()
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
  })

  it("redistributes width between the dragged pair only", async () => {
    renderRow(makeColumnsRow({ weights: [0.25, 0.25, 0.5], resizable: true }))
    const columns = screen.getAllByTestId("stColumn")

    await dragBy(screen.getAllByRole("separator")[0], 80)

    expect(columns[0]).toHaveStyle("width: calc(35% - 1rem)")
    expect(columns[1]).toHaveStyle("width: calc(15% - 1rem)")
    // The column outside the dragged pair keeps its spec proportion.
    expect(columns[2]).toHaveStyle("width: calc(50% - 1rem)")
  })

  it("stops shrinking a column at its minimum width", async () => {
    renderRow(makeColumnsRow({ weights: [0.5, 0.5], resizable: true }))
    const columns = screen.getAllByTestId("stColumn")

    await dragBy(screen.getAllByRole("separator")[0], -10_000)

    // 64px of an 800px row.
    expect(columns[0]).toHaveStyle("width: calc(8% - 1rem)")
    expect(columns[1]).toHaveStyle("width: calc(92% - 1rem)")
  })

  it("restores the spec proportions on double click", async () => {
    const user = userEvent.setup()
    renderRow(makeColumnsRow({ weights: [0.25, 0.25, 0.5], resizable: true }))
    const columns = screen.getAllByTestId("stColumn")
    const handle = screen.getAllByRole("separator")[0]
    await dragBy(handle, 80)

    await user.dblClick(handle)

    expect(columns[0]).toHaveStyle("width: calc(25% - 1rem)")
    expect(columns[1]).toHaveStyle("width: calc(25% - 1rem)")
  })

  it("resizes with the arrow keys and resets with Enter", async () => {
    const user = userEvent.setup()
    renderRow(makeColumnsRow({ weights: [0.25, 0.25, 0.5], resizable: true }))
    const columns = screen.getAllByTestId("stColumn")
    const handle = screen.getAllByRole("separator")[0]
    handle.focus()

    // Four 10px steps of an 800px row grow the left column by 5%.
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}")

    expect(columns[0]).toHaveStyle("width: calc(30% - 1rem)")
    expect(columns[1]).toHaveStyle("width: calc(20% - 1rem)")
    expect(handle).toHaveAttribute("aria-valuenow", "60")

    await user.keyboard("{Enter}")

    expect(columns[0]).toHaveStyle("width: calc(25% - 1rem)")
    expect(handle).toHaveAttribute("aria-valuenow", "50")
  })

  it("hides the handles while the columns are stacked", async () => {
    setViewportWidth(400)
    renderRow(makeColumnsRow({ weights: [0.25, 0.25, 0.5], resizable: true }))

    expect(screen.getAllByTestId("stColumn")).toHaveLength(3)
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()

    act(() => {
      setViewportWidth(1000)
      window.dispatchEvent(new Event("resize"))
    })

    await waitFor(() =>
      expect(screen.getAllByRole("separator")).toHaveLength(2)
    )
  })

  it("keeps the handles on narrow viewports when the row cannot wrap", () => {
    setViewportWidth(400)

    renderRow(
      makeColumnsRow({ weights: [0.5, 0.5], resizable: true, wrap: false })
    )

    // A `wrap=False` row scrolls horizontally instead of stacking, so its
    // columns stay side by side and remain resizable.
    expect(screen.getAllByRole("separator")).toHaveLength(1)
  })

  it("keeps nested resizable columns independent of the outer row", async () => {
    const nestedRow = makeColumnsRow({ weights: [0.5, 0.5], resizable: true })
    renderRow(
      makeColumnsRow({
        weights: [],
        resizable: true,
        children: [makeColumn(0.5), makeColumn(0.5, [nestedRow])],
      })
    )
    const columns = screen.getAllByTestId("stColumn")

    // The outer row's handle comes first in document order because the nested
    // row lives in the second outer column.
    await dragBy(screen.getAllByRole("separator")[0], 80)

    expect(columns[0]).toHaveStyle("width: calc(60% - 1rem)")
    expect(columns[1]).toHaveStyle("width: calc(40% - 1rem)")
    // The nested row keeps its own widths.
    expect(columns[2]).toHaveStyle("width: calc(50% - 1rem)")
    expect(columns[3]).toHaveStyle("width: calc(50% - 1rem)")
  })
})

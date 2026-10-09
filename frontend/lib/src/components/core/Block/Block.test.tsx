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

import type { ReactElement } from "react"

import { screen, waitFor, within } from "@testing-library/react"
import type * as ReactAriaComponents from "react-aria-components"

import {
  Block as BlockProto,
  Button as ButtonProto,
  type Element,
  ForwardMsgMetadata,
  streamlit,
} from "@streamlit/protobuf"

import {
  type AppNode,
  BlockNode,
  ElementNode,
  TransientNode,
} from "~lib/AppNode"
import { STEP_BLOCK_ATTRIBUTE } from "~lib/components/core/Layout/stepConnector"
import { mockEndpoints } from "~lib/mocks/mocks"
import { text, textInput } from "~lib/render-tree/test-utils"
import { ScriptRunState } from "~lib/ScriptRunState"
import { mockEllipsizedLabels, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { BlockNodeRenderer, FlexBoxContainer, VerticalBlock } from "./Block"
import { gridCellJustifyContent } from "./styled-components"

// SelectionIndicator uses SharedElementTransition which calls getAnimations() in an
// async callback after component unmount, causing spurious uncaught exceptions in JSDOM.
// Mocking it here prevents the animation machinery from running in unit tests.
vi.mock("react-aria-components", async importOriginal => {
  const actual = await importOriginal<typeof ReactAriaComponents>()
  return { ...actual, SelectionIndicator: () => null }
})

const FAKE_SCRIPT_HASH = "fake_script_hash"

function makeColumn(weight: number, children: AppNode[] = []): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true, column: { weight } })
  )
}

function makeHorizontalBlockWithColumns(
  numColumns: number,
  wrap = true
): BlockNode {
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
        wrap,
      },
    })
  )
}

function makeVerticalBlock(
  children: AppNode[] = [],
  additionalProps: Partial<BlockProto> = {}
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true, ...additionalProps })
  )
}

function makeButton(label: string): ElementNode {
  const element = {
    type: "button",
    button: ButtonProto.create({ id: "column-wrap-button", label }),
  } as unknown as Element

  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    "",
    FAKE_SCRIPT_HASH
  )
}

function makeColumnsBlock(columnChildren: AppNode[]): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    [makeColumn(1, columnChildren)],
    new BlockProto({
      allowEmpty: true,
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        wrap: true,
      },
    })
  )
}

function makeVerticalBlockComponent(node: BlockNode): ReactElement {
  return (
    <FlexBoxContainer
      node={node}
      scriptRunId={""}
      scriptRunState={ScriptRunState.NOT_RUNNING}
      widgetsDisabled={false}
      // @ts-expect-error - widgetMgr is required
      widgetMgr={undefined}
      // @ts-expect-error - uploadClient is required
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
          // @ts-expect-error - widgetMgr is required
          widgetMgr={undefined}
          // @ts-expect-error - uploadClient is required
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
        // @ts-expect-error - uploadClient is required
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

describe("BlockNodeRenderer step blocks", () => {
  const widgetMgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

  function makeStepNodeComponent(
    type: BlockProto.Expandable.Type,
    children: AppNode[]
  ): ReactElement {
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      children,
      new BlockProto({
        allowEmpty: true,
        expandable: { label: "my step", expanded: true, type },
      })
    )

    return (
      <BlockNodeRenderer
        node={node}
        scriptRunId=""
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        widgetMgr={widgetMgr}
        // @ts-expect-error - uploadClient is required
        uploadClient={undefined}
      />
    )
  }

  it("marks a step block and renders its connector", () => {
    renderWithContexts(
      makeStepNodeComponent(BlockProto.Expandable.Type.STEP, [
        text("step child"),
      ])
    )

    expect(screen.getByTestId("stLayoutWrapper")).toHaveAttribute(
      STEP_BLOCK_ATTRIBUTE,
      "true"
    )
    expect(screen.getByTestId("stExpanderStepConnector")).toBeVisible()
  })

  it("does not mark a default expander block as a step", () => {
    renderWithContexts(
      makeStepNodeComponent(BlockProto.Expandable.Type.DEFAULT, [
        text("expander child"),
      ])
    )

    expect(screen.getByTestId("stLayoutWrapper")).not.toHaveAttribute(
      STEP_BLOCK_ATTRIBUTE
    )
  })

  it("puts the step marker and the CSS key class on the same wrapper", () => {
    // The connector CSS selects step wrappers as direct children of the flex
    // container, so a key must not move the marker onto a different element.
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("step child")],
      new BlockProto({
        allowEmpty: true,
        expandable: {
          label: "my step",
          expanded: true,
          type: BlockProto.Expandable.Type.STEP,
        },
        id: "$$ID-abc123-my_step",
      })
    )

    renderWithContexts(
      <BlockNodeRenderer
        node={node}
        scriptRunId=""
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        widgetMgr={widgetMgr}
        // @ts-expect-error - uploadClient is required
        uploadClient={undefined}
      />
    )

    const layoutWrapper = screen.getByTestId("stLayoutWrapper")
    expect(layoutWrapper).toHaveAttribute(STEP_BLOCK_ATTRIBUTE, "true")
    expect(layoutWrapper).toHaveClass("st-key-my_step")
  })

  it("renders a step without children as a plain header with no connector", () => {
    renderWithContexts(
      makeStepNodeComponent(BlockProto.Expandable.Type.STEP, [])
    )

    expect(screen.getByText("my step")).toBeVisible()
    expect(
      screen.queryByTestId("stExpanderStepConnector")
    ).not.toBeInTheDocument()
    // An empty step draws no connector of its own, but it must stay marked so
    // the preceding step can extend its line down to this step's icon.
    expect(screen.getByTestId("stLayoutWrapper")).toHaveAttribute(
      STEP_BLOCK_ATTRIBUTE,
      "true"
    )
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
        // @ts-expect-error - uploadClient is required
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

describe("BlockNodeRenderer direct column wrapping context", () => {
  mockEllipsizedLabels()
  const label = "Regenerate the complete quarterly report now"

  async function renderColumnChildren(children: AppNode[]): Promise<void> {
    renderWithContexts(
      makeVerticalBlockComponent(
        makeVerticalBlock([makeColumnsBlock(children)])
      )
    )
    expect(await screen.findByRole("button", { name: label })).toBeVisible()
  }

  it("resolves auto wrap to false for a button directly in a column", async () => {
    await renderColumnChildren([makeButton(label)])

    // Title is applied in an effect after Markdown renders the label text.
    expect(await screen.findByTitle(label)).toBeVisible()
  })

  it("preserves direct column placement through transparent blocks", async () => {
    const transparentBlock = new BlockNode(
      FAKE_SCRIPT_HASH,
      [makeButton(label)],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    await renderColumnChildren([transparentBlock])

    expect(await screen.findByTitle(label)).toBeVisible()
  })

  it("resets direct column placement in a nested layout container", async () => {
    const nestedContainer = makeVerticalBlock([makeButton(label)], {
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.VERTICAL,
        wrap: true,
      },
    })
    await renderColumnChildren([nestedContainer])

    expect(screen.queryByTitle(label)).not.toBeInTheDocument()
  })
})

describe("BlockNodeRenderer direct grid cell wrapping context", () => {
  mockEllipsizedLabels()
  const label = "Regenerate the complete quarterly report now"

  function makeGridCellBlock(children: AppNode[]): BlockNode {
    return new BlockNode(
      FAKE_SCRIPT_HASH,
      children,
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: {},
      })
    )
  }

  function makeGridBlockWithChildren(children: AppNode[]): BlockNode {
    return new BlockNode(
      FAKE_SCRIPT_HASH,
      children,
      new BlockProto({
        allowEmpty: true,
        gridContainer: {
          maxColumns: 3,
          wrap: true,
        },
      })
    )
  }

  async function renderGridChildren(children: AppNode[]): Promise<void> {
    renderWithContexts(
      makeVerticalBlockComponent(
        makeVerticalBlock([makeGridBlockWithChildren(children)])
      )
    )
    expect(await screen.findByRole("button", { name: label })).toBeVisible()
  }

  it("resolves auto wrap to false for a button in grid.cell()", async () => {
    await renderGridChildren([makeGridCellBlock([makeButton(label)])])

    expect(await screen.findByTitle(label)).toBeVisible()
  })

  it("resolves auto wrap to false for a button as a direct grid child", async () => {
    await renderGridChildren([makeButton(label)])

    expect(await screen.findByTitle(label)).toBeVisible()
  })

  it("resets wrap in a nested layout container inside a grid cell", async () => {
    const nestedContainer = makeVerticalBlock([makeButton(label)], {
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.VERTICAL,
        wrap: true,
      },
    })
    await renderGridChildren([makeGridCellBlock([nestedContainer])])

    expect(screen.queryByTitle(label)).not.toBeInTheDocument()
  })
})

describe("BlockNodeRenderer container types", () => {
  const widgetMgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })
  const endpoints = mockEndpoints()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeBlockNodeComponent(node: BlockNode): ReactElement {
    return (
      <BlockNodeRenderer
        node={node}
        scriptRunId=""
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        widgetMgr={widgetMgr}
        endpoints={endpoints}
        // @ts-expect-error - uploadClient is required
        uploadClient={undefined}
      />
    )
  }

  it("renders nothing for an empty block that does not allow empty", () => {
    const node = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: false })
    )
    renderWithContexts(makeBlockNodeComponent(node))

    expect(screen.queryByTestId("stLayoutWrapper")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stVerticalBlock")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stForm")).not.toBeInTheDocument()
  })

  it("renders a form block and registers submit behaviors", () => {
    const setFormSubmitBehaviorsSpy = vi.spyOn(
      widgetMgr,
      "setFormSubmitBehaviors"
    )
    renderWithContexts(
      makeBlockNodeComponent(
        makeVerticalBlock([text("form child")], {
          form: {
            formId: "form-1",
            clearOnSubmit: true,
            enterToSubmit: false,
            border: true,
          },
        })
      )
    )

    expect(screen.getByTestId("stForm")).toBeVisible()
    expect(screen.getByText("form child")).toBeVisible()
    expect(setFormSubmitBehaviorsSpy).toHaveBeenCalledWith(
      "form-1",
      true,
      false
    )
  })

  it("renders a chat message block", () => {
    renderWithContexts(
      makeBlockNodeComponent(
        makeVerticalBlock([text("hello")], {
          chatMessage: { name: "assistant" },
        })
      )
    )

    expect(screen.getByTestId("stChatMessage")).toBeVisible()
    expect(screen.getByText("hello")).toBeVisible()
  })

  it("renders an empty chat message", () => {
    renderWithContexts(
      makeBlockNodeComponent(
        makeVerticalBlock([], { chatMessage: { name: "user" } })
      )
    )

    expect(screen.getByTestId("stChatMessage")).toBeVisible()
    expect(screen.getByTestId("stChatMessageContent")).toBeVisible()
  })

  it("renders a dialog block when open", () => {
    renderWithContexts(
      makeBlockNodeComponent(
        makeVerticalBlock([text("dialog body")], {
          dialog: {
            title: "My dialog",
            isOpen: true,
            dismissible: true,
            width: BlockProto.Dialog.DialogWidth.LARGE,
          },
        })
      )
    )

    expect(screen.getByTestId("stDialog")).toBeVisible()
    expect(screen.getByText("dialog body")).toBeVisible()
    expect(
      screen.queryByTestId("stDialogContentEndPad")
    ).not.toBeInTheDocument()
  })

  it("pads the end of a left drawer dialog", () => {
    renderWithContexts(
      makeBlockNodeComponent(
        makeVerticalBlock([text("drawer body")], {
          dialog: {
            title: "My drawer",
            isOpen: true,
            dismissible: true,
            width: BlockProto.Dialog.DialogWidth.LARGE,
            position: BlockProto.Dialog.DialogPosition.LEFT,
          },
        })
      )
    )

    expect(screen.getByText("drawer body")).toBeVisible()
    expect(screen.getByTestId("stDialogContentEndPad")).toHaveStyle({
      height: "2rem",
    })
  })

  it("hides a leftover dialog from a previous full-app run", () => {
    const dialogBlock = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("dialog body")],
      new BlockProto({
        allowEmpty: true,
        dialog: {
          title: "My dialog",
          isOpen: true,
          dismissible: true,
          // id activates on_dismiss; the spy below would fire if this hide
          // went through Dialog.handleClose instead of unmounting.
          id: "test-dialog-id",
          width: BlockProto.Dialog.DialogWidth.LARGE,
        },
      }),
      "previous-run"
    )
    const setTriggerValue = vi.spyOn(widgetMgr, "setTriggerValue")

    renderWithContexts(makeBlockNodeComponent(dialogBlock), {
      scriptRunContext: {
        scriptRunState: ScriptRunState.RUNNING,
        scriptRunId: "current-run",
        fragmentIdsThisRun: [],
      },
    })

    expect(screen.queryByTestId("stDialog")).not.toBeInTheDocument()
    expect(screen.queryByText("dialog body")).not.toBeInTheDocument()
    expect(setTriggerValue).not.toHaveBeenCalled()
  })

  it.each([
    {
      desc: "from the current full-app run while running",
      nodeScriptRunId: "current-run",
      fragmentId: undefined,
      scriptRunState: ScriptRunState.RUNNING,
      fragmentIdsThisRun: [] as string[],
    },
    {
      desc: "leftover while a rerun is only requested",
      nodeScriptRunId: "previous-run",
      fragmentId: undefined,
      scriptRunState: ScriptRunState.RERUN_REQUESTED,
      fragmentIdsThisRun: [] as string[],
    },
    {
      desc: "leftover during a fragment run",
      nodeScriptRunId: "previous-run",
      fragmentId: "dialog-fragment",
      scriptRunState: ScriptRunState.RUNNING,
      fragmentIdsThisRun: ["dialog-fragment"],
    },
  ])(
    "keeps a dialog $desc",
    ({ nodeScriptRunId, fragmentId, scriptRunState, fragmentIdsThisRun }) => {
      const dialogBlock = new BlockNode(
        FAKE_SCRIPT_HASH,
        [text("dialog body")],
        new BlockProto({
          allowEmpty: true,
          dialog: {
            title: "My dialog",
            isOpen: true,
            dismissible: true,
            width: BlockProto.Dialog.DialogWidth.LARGE,
          },
        }),
        nodeScriptRunId,
        fragmentId
      )

      renderWithContexts(makeBlockNodeComponent(dialogBlock), {
        scriptRunContext: {
          scriptRunState,
          scriptRunId: "current-run",
          fragmentIdsThisRun,
        },
      })

      expect(screen.getByTestId("stDialog")).toBeVisible()
      expect(screen.getByText("dialog body")).toBeVisible()
    }
  )

  it("renders a tab container", () => {
    const tab = makeVerticalBlock([text("tab body")], {
      tab: { label: "Tab 0" },
    })
    renderWithContexts(
      makeBlockNodeComponent(makeVerticalBlock([tab], { tabContainer: {} }))
    )

    expect(screen.getByTestId("stTabs")).toBeVisible()
    expect(screen.getByRole("tab", { name: "Tab 0" })).toBeVisible()
    expect(screen.getByTestId("stTabs")).not.toHaveStyle({ height: "400px" })
  })

  it("applies a constraining pixel height to a tab container", () => {
    const tab = makeVerticalBlock([text("tab body")], {
      tab: { label: "Tab 0" },
    })
    renderWithContexts(
      makeBlockNodeComponent(
        makeVerticalBlock([tab], {
          tabContainer: {},
          heightConfig: { pixelHeight: 400 },
        })
      )
    )

    expect(screen.getByTestId("stTabs")).toBeVisible()
    expect(screen.getByRole("tab", { name: "Tab 0" })).toBeVisible()
    expect(screen.getByTestId("stTabs")).toHaveStyle({ height: "400px" })
  })
})

describe("GridContainer Component", () => {
  function makeGridBlock(
    gridContainerProps: Partial<BlockProto.GridContainer.$Properties> = {},
    children: AppNode[] = []
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
        // @ts-expect-error - uploadClient is required
        uploadClient={undefined}
      />
    )
  }

  it("reuses one justify object per alignment", () => {
    const { VerticalAlignment } = BlockProto.GridContainer
    expect(gridCellJustifyContent(VerticalAlignment.CENTER)).toBe(
      gridCellJustifyContent(VerticalAlignment.CENTER)
    )
    expect(gridCellJustifyContent(VerticalAlignment.BOTTOM)).toBe(
      gridCellJustifyContent(VerticalAlignment.BOTTOM)
    )
    expect(gridCellJustifyContent(VerticalAlignment.TOP)).toBe(
      gridCellJustifyContent(VerticalAlignment.TOP)
    )
  })

  it("should render a grid container", () => {
    const block = makeGridBlock()
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toBeVisible()
    expect(gridContainer).toHaveClass("stGrid")
    expect(gridContainer).toHaveAttribute("data-test-wrap", "true")
  })

  it("should apply display: grid style", () => {
    const block = makeGridBlock()
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveStyle("display: grid")
  })

  it("should apply an explicit column count from the default content width", () => {
    const block = makeGridBlock({
      maxColumns: 0,
      minColumnWidthPx: 200,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    // Unmeasured first paint uses the padded content box (704px):
    // (704+16)/(200+16) = 3
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(3, minmax(0, 1fr))"
    )
    expect(gridContainer).toHaveAttribute("data-test-column-count", "3")
  })

  it("uses the padded content box rather than raw contentMaxWidth", () => {
    const block = makeGridBlock({
      maxColumns: 0,
      minColumnWidthPx: 170,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    // 736px would fit 4 columns; 704px fits 3.
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(3, minmax(0, 1fr))"
    )
    expect(gridContainer).toHaveAttribute("data-test-column-count", "3")
  })

  it("should cap integer columns at the declared count", () => {
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

  it("should keep the declared count and scroll when wrap is false", () => {
    const block = makeGridBlock({
      maxColumns: 4,
      minColumnWidthPx: 200,
      wrap: false,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(4, minmax(200px, 1fr))"
    )
    expect(gridContainer).toHaveStyle("overflow-x: auto;")
    expect(gridContainer).toHaveStyle("padding-block: 0.2rem")
    expect(gridContainer).toHaveStyle("margin-block: -0.2rem")
    expect(gridContainer).toHaveAttribute("data-test-wrap", "false")
  })

  it("does not scroll a no-wrap grid whose tracks fit", () => {
    const block = makeGridBlock({
      maxColumns: 2,
      minColumnWidthPx: 100,
      wrap: false,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).not.toHaveStyle("overflow-x: auto")
    expect(gridContainer).not.toHaveStyle("padding-block: 0.2rem")
  })

  it("makes a text-only overflowing no-wrap grid keyboard scrollable", async () => {
    const block = makeGridBlock(
      {
        maxColumns: 4,
        minColumnWidthPx: 200,
        wrap: false,
      },
      [makeTextElement("Note")]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    await waitFor(() => {
      expect(gridContainer).toHaveAttribute("tabindex", "0")
    })
    expect(gridContainer).not.toHaveAttribute("role")
  })

  it("does not add a tab stop on a no-wrap grid that already has a widget", async () => {
    const block = makeGridBlock(
      {
        maxColumns: 4,
        minColumnWidthPx: 200,
        wrap: false,
      },
      [makeButton("Edit")]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    await waitFor(() => {
      expect(gridContainer).toHaveStyle("overflow-x: auto")
    })
    expect(gridContainer).not.toHaveAttribute("tabindex")
  })

  it("fills the layout wrapper when the grid has a bounded height", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { useStretch: true },
        gridContainer: {
          maxColumns: 0,
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          showCellBorder: false,
          cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT,
        },
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const scrollBody = screen.getByTestId("stGridScrollBody")
    expect(scrollBody).toHaveStyle("height: 100%")
    expect(scrollBody).toHaveAttribute("data-test-scroll", "false")
    expect(screen.getByTestId("stGrid")).toHaveStyle("height: auto")
  })

  it("does not clip a pixel-height grid until in-flow tracks overflow", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { pixelHeight: 160 },
        gridContainer: {
          maxColumns: 2,
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          showCellBorder: false,
          cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT,
        },
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const scrollBody = screen.getByTestId("stGridScrollBody")
    expect(scrollBody).toHaveStyle("height: 100%")
    expect(scrollBody).toHaveAttribute("data-test-scroll", "false")
    expect(screen.getByTestId("stGrid")).not.toHaveStyle("overflow-y: auto")
  })

  it("lets a bounded no-wrap grid grow to its track floor so the port can scroll", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { pixelHeight: 160 },
        gridContainer: {
          maxColumns: 4,
          minColumnWidthPx: 200,
          wrap: false,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          showCellBorder: false,
          cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT,
        },
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    // 4 * 200px tracks + 3 * 1rem gaps. The measure box must be at least
    // this wide or the scrollport's scrollWidth stays at the port width.
    expect(screen.getByTestId("stGridContentMeasure")).toHaveStyle(
      "min-width: 848px"
    )
    expect(screen.getByTestId("stGridScrollBody")).toHaveStyle(
      "overflow-x: auto"
    )
  })

  it("scrolls a bounded grid when reserved equal mode is set", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { pixelHeight: 400 },
        gridContainer: {
          maxColumns: 2,
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          showCellBorder: false,
          cellHeightMode: BlockProto.GridContainer.CellHeightMode.EQUAL,
        },
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGridScrollBody")).toHaveStyle("height: 100%")
    expect(screen.getByTestId("stGrid")).toHaveStyle("height: auto")
    expect(screen.getByTestId("stGrid")).toHaveStyle("grid-auto-rows: auto")
  })

  it("keeps content-height grids auto-sized", () => {
    const block = makeGridBlock()
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGrid")).toHaveStyle("height: auto")
    // The port stays mounted so a later bounded height does not remount
    // the grid. It does not participate in layout.
    expect(screen.getByTestId("stGridScrollBody")).toHaveStyle(
      "display: contents"
    )
  })

  it("keeps the grid element mounted when height becomes bounded", () => {
    const { rerenderWithContexts } = renderWithContexts(
      makeGridNodeRendererComponent(makeGridBlock())
    )
    const grid = screen.getByTestId("stGrid")
    const bounded = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { pixelHeight: 400 },
        gridContainer: {
          maxColumns: 0,
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          showCellBorder: false,
          cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT,
        },
      })
    )
    rerenderWithContexts(makeGridNodeRendererComponent(bounded))

    expect(screen.getByTestId("stGrid")).toBe(grid)
    expect(screen.getByTestId("stGridScrollBody")).toHaveStyle("height: 100%")
  })

  it("does not clip cell content until in-flow overflow is measured", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: {},
      })
    )
    const block = makeGridBlock(
      { cellHeightMode: BlockProto.GridContainer.CellHeightMode.FIXED },
      [cell]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGridCell")).toHaveStyle("overflow: visible")
    expect(screen.getByTestId("stGridCell")).toHaveStyle("height: 100%")
    expect(screen.getByTestId("stGridCellBody")).toHaveAttribute(
      "data-test-scroll",
      "false"
    )
  })

  function makeTextElement(body: string, stretch = false): ElementNode {
    const element = {
      type: "text",
      text: { body },
      ...(stretch ? { heightConfig: { useStretch: true } } : {}),
    } as unknown as Element

    return new ElementNode(
      element,
      ForwardMsgMetadata.create(),
      "",
      FAKE_SCRIPT_HASH
    )
  }

  it("fills a grid.cell() block in a definite-height row so stretch children grow", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [makeTextElement("Revenue"), makeTextElement("chart", true)],
      new BlockProto({
        allowEmpty: true,
        flexContainer: {
          direction: BlockProto.FlexContainer.Direction.VERTICAL,
          wrap: false,
          border: false,
          justify: BlockProto.FlexContainer.Justify.JUSTIFY_START,
          align: BlockProto.FlexContainer.Align.ALIGN_START,
          gapConfig: { gapSize: streamlit.GapSize.SMALL },
        },
        gridCell: {},
      })
    )
    const block = makeGridBlock(
      {
        cellHeightMode: BlockProto.GridContainer.CellHeightMode.FIXED,
        verticalAlignment: BlockProto.GridContainer.VerticalAlignment.CENTER,
        cellHeightConfig: { pixelHeight: 240 },
      },
      [cell]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridCell = screen.getByTestId("stGridCell")
    expect(within(gridCell).getByTestId("stLayoutWrapper")).toHaveStyle({
      height: "100%",
      flex: "1 1 auto",
    })
    expect(within(gridCell).getByTestId("stVerticalBlock")).toHaveStyle({
      height: "100%",
      justifyContent: "safe center",
    })

    const containers = within(gridCell).getAllByTestId("stElementContainer")
    const stretch = containers.find(container =>
      container.textContent?.includes("chart")
    )
    expect(stretch).toHaveStyle({ flex: "1 1 0%", height: "100%" })
    const label = containers.find(container =>
      container.textContent?.includes("Revenue")
    )
    expect(label).not.toHaveStyle({ flex: "1 1 0%" })
  })

  function mockMeasuredHeights(): () => void {
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const height = this.dataset.testid === "stGridCellContent" ? 400 : 120
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: height,
          right: 200,
          width: 200,
          height,
          toJSON: () => ({}),
        }
      })
    return () => spy.mockRestore()
  }

  function renderFixedHeightCell(children: AppNode[]): void {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      children,
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: {},
      })
    )
    renderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock(
          {
            cellHeightMode: BlockProto.GridContainer.CellHeightMode.FIXED,
            cellHeightConfig: { pixelHeight: 240 },
          },
          [cell]
        )
      )
    )
  }

  it("makes a text-only scrolling cell keyboard reachable", async () => {
    const restore = mockMeasuredHeights()
    try {
      renderFixedHeightCell([makeTextElement("A long note")])
      const body = screen.getByTestId("stGridCellBody")
      await waitFor(() => {
        expect(body).toHaveAttribute("tabindex", "0")
      })
      expect(body).not.toHaveAttribute("role")
      expect(body).not.toHaveAttribute("aria-label")
    } finally {
      restore()
    }
  })

  it("does not add a tab stop when a scrolling cell already has a widget", async () => {
    const restore = mockMeasuredHeights()
    try {
      renderFixedHeightCell([makeButton("Edit")])
      const body = screen.getByTestId("stGridCellBody")
      await waitFor(() => {
        expect(body).toHaveAttribute("data-test-scroll", "true")
      })
      expect(body).not.toHaveAttribute("tabindex")
      expect(await screen.findByRole("button", { name: "Edit" })).toBeVisible()
    } finally {
      restore()
    }
  })

  it("keeps a grid.cell() block content-sized when the row height is content", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [makeTextElement("Short")],
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: {},
      })
    )
    const block = makeGridBlock(
      {
        cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT,
        verticalAlignment: BlockProto.GridContainer.VerticalAlignment.CENTER,
      },
      [cell]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridCell = screen.getByTestId("stGridCell")
    expect(within(gridCell).getByTestId("stLayoutWrapper")).toHaveStyle({
      height: "auto",
    })
    expect(within(gridCell).getByTestId("stVerticalBlock")).not.toHaveStyle({
      height: "100%",
    })
    expect(screen.getByTestId("stGridCellBody")).toHaveStyle(
      "display: contents"
    )
  })

  it("leaves a direct stretch child on height 100% without flex-grow", () => {
    const block = makeGridBlock(
      { cellHeightMode: BlockProto.GridContainer.CellHeightMode.FIXED },
      [makeTextElement("direct", true)]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const container = within(screen.getByTestId("stGridCell")).getByTestId(
      "stElementContainer"
    )
    expect(container).toHaveStyle({ height: "100%" })
    expect(container).not.toHaveStyle({ flex: "1 1 0%" })
    expect(
      within(screen.getByTestId("stGridCell")).queryByTestId("stLayoutWrapper")
    ).not.toBeInTheDocument()
  })

  it("resolves columns from the laid-out width instead of the 704px fallback", () => {
    const rect = {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 40,
      right: 260,
      width: 260,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(rect)
    try {
      const block = makeGridBlock({
        maxColumns: 0,
        minColumnWidthPx: 200,
      })
      renderWithContexts(makeGridNodeRendererComponent(block))
      // (260 + 16) / (200 + 16) = 1 column, not the 704px fallback's 3.
      expect(screen.getByTestId("stGrid")).toHaveAttribute(
        "data-test-column-count",
        "1"
      )
    } finally {
      spy.mockRestore()
    }
  })

  it("does not add a cell scrollport in content-height mode", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: {},
      })
    )
    const block = makeGridBlock(
      { cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT },
      [cell]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGridCellBody")).toHaveStyle(
      "display: contents"
    )
    expect(screen.getByTestId("stGridCellBody")).toHaveAttribute(
      "data-test-scroll",
      "false"
    )
  })

  it("keeps a cell mounted when row height becomes fixed", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [makeTextElement("Short")],
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: {},
      })
    )
    const { rerenderWithContexts } = renderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock(
          { cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT },
          [cell]
        )
      )
    )
    const gridCell = screen.getByTestId("stGridCell")
    rerenderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock(
          {
            cellHeightMode: BlockProto.GridContainer.CellHeightMode.FIXED,
            cellHeightConfig: { pixelHeight: 240 },
          },
          [cell]
        )
      )
    )

    expect(screen.getByTestId("stGridCell")).toBe(gridCell)
    expect(screen.getByTestId("stGridCellBody")).toHaveStyle("height: 100%")
  })

  it("should span all columns when columnSpanAll is set", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: { columnSpanAll: true },
      })
    )
    const block = makeGridBlock({ maxColumns: 4 }, [cell])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGridCell")).toHaveStyle("grid-column: 1/-1")
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
      "auto rows: auto for reserved equal mode",
      { cellHeightMode: BlockProto.GridContainer.CellHeightMode.EQUAL },
      "grid-auto-rows: auto;",
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

  it("renders element children as cells with a public stGridCell class", () => {
    const block = makeGridBlock({}, [
      textInput("First", "grid-cell-a"),
      textInput("Second", "grid-cell-b"),
    ])
    renderWithContexts(makeGridNodeRendererComponent(block))

    const cells = screen.getAllByTestId("stGridCell")
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveClass("stGridCell")
    expect(cells[1]).toHaveClass("stGridCell")
    expect(cells[0]).not.toBe(cells[1])
  })

  it("does not create a cell for a duplicate widget id", () => {
    const block = makeGridBlock({}, [
      textInput("First", "same-id"),
      textInput("Second", "same-id"),
    ])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getAllByTestId("stGridCell")).toHaveLength(1)
    expect(screen.getAllByTestId("stElementContainer")).toHaveLength(1)
  })

  it("places each child of a transparent wrapper in its own cell", () => {
    const fragment = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("First card"), text("Second card")],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    const block = makeGridBlock({}, [fragment])
    renderWithContexts(makeGridNodeRendererComponent(block))

    const cells = screen.getAllByTestId("stGridCell")
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent("First card")
    expect(cells[1]).toHaveTextContent("Second card")
  })

  it("keeps grid.cell output inside a transparent wrapper as one cell", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("Grouped"), text("Together")],
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: {},
      })
    )
    const fragment = new BlockNode(
      FAKE_SCRIPT_HASH,
      [cell],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    const block = makeGridBlock({}, [fragment])
    renderWithContexts(makeGridNodeRendererComponent(block))

    const cells = screen.getAllByTestId("stGridCell")
    expect(cells).toHaveLength(1)
    expect(cells[0]).toHaveTextContent("Grouped")
    expect(cells[0]).toHaveTextContent("Together")
  })

  it("flattens nested transparent wrappers into cells", () => {
    const inner = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("Inner")],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    const outer = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("Outer"), inner],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    const block = makeGridBlock({}, [outer])
    renderWithContexts(makeGridNodeRendererComponent(block))

    const cells = screen.getAllByTestId("stGridCell")
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent("Outer")
    expect(cells[1]).toHaveTextContent("Inner")
  })

  it("does not create a cell for an empty transparent wrapper", () => {
    const fragment = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    const block = makeGridBlock({}, [fragment, text("Kept")])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getAllByTestId("stGridCell")).toHaveLength(1)
    expect(screen.getByText("Kept")).toBeVisible()
  })

  it("keeps a non-transparent block as one cell", () => {
    const group = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("A"), text("B")],
      new BlockProto({ allowEmpty: true, vertical: {} })
    )
    const block = makeGridBlock({}, [group])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getAllByTestId("stGridCell")).toHaveLength(1)
    expect(screen.getByTestId("stGridCell")).toHaveTextContent("A")
    expect(screen.getByTestId("stGridCell")).toHaveTextContent("B")
  })

  it("does not create a cell for an empty transient child", () => {
    const block = makeGridBlock({}, [
      new TransientNode(FAKE_SCRIPT_HASH),
      textInput("Kept", "grid-cell-kept"),
    ])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getAllByTestId("stGridCell")).toHaveLength(1)
  })

  it("keeps a direct widget cell mounted when a spinner wraps it", () => {
    const widget = textInput("Name", "grid-spinner-widget")
    const { rerenderWithContexts } = renderWithContexts(
      makeGridNodeRendererComponent(makeGridBlock({}, [widget]))
    )
    const cell = screen.getByTestId("stGridCell")

    rerenderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock({}, [
          new TransientNode(FAKE_SCRIPT_HASH, widget, [text("Loading")]),
        ])
      )
    )

    expect(screen.getByTestId("stGridCell")).toBe(cell)
    expect(screen.getByText("Loading")).toBeVisible()
    expect(within(cell).getByTestId("stSkeleton")).toBeVisible()
  })

  it("keeps column span when a spinner wraps the cell", () => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [text("Featured")],
      new BlockProto({
        allowEmpty: true,
        vertical: {},
        gridCell: { columnSpanAll: true },
      })
    )
    const block = makeGridBlock({ maxColumns: 4 }, [
      new TransientNode(FAKE_SCRIPT_HASH, cell, [text("Loading")]),
    ])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGridCell")).toHaveStyle("grid-column: 1/-1")
    expect(screen.getByText("Featured")).toBeVisible()
    expect(screen.getByText("Loading")).toBeVisible()
  })

  it("uses the grid pixel width for first-paint column count", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        widthConfig: { pixelWidth: 416 },
        gridContainer: {
          maxColumns: 0,
          minColumnWidthPx: 200,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          showCellBorder: false,
          cellHeightMode: BlockProto.GridContainer.CellHeightMode.CONTENT,
        },
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    // Unmeasured first paint uses pixelWidth 416: (416+16)/(200+16) = 2
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    )
    expect(gridContainer).toHaveAttribute("data-test-column-count", "2")
  })
})

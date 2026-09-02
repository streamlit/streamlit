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

import { screen, within } from "@testing-library/react"

import {
  Block as BlockProto,
  Button as ButtonProto,
  CustomThemeConfig,
  Element,
  ForwardMsgMetadata,
  streamlit,
} from "@streamlit/protobuf"

import { AppNode, BlockNode, ElementNode } from "~lib/AppNode"
import { STEP_BLOCK_ATTRIBUTE } from "~lib/components/core/Layout/stepConnector"
import { mockEndpoints } from "~lib/mocks/mocks"
import { text } from "~lib/render-tree/test-utils"
import { ScriptRunState } from "~lib/ScriptRunState"
import { renderWithContexts } from "~lib/test_util"
import { darkTheme } from "~lib/theme/themeConfigs"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { BlockNodeRenderer, FlexBoxContainer, VerticalBlock } from "./Block"

// SelectionIndicator uses SharedElementTransition which calls getAnimations() in an
// async callback after component unmount, causing spurious uncaught exceptions in JSDOM.
// Mocking it here prevents the animation machinery from running in unit tests.
vi.mock("react-aria-components", async importOriginal => {
  const actual = await importOriginal<typeof import("react-aria-components")>()
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
        // @ts-expect-error
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
        // @ts-expect-error
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

describe("BlockNodeRenderer direct column wrapping context", () => {
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
        // @ts-expect-error
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
  })

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

describe("BlockNodeRenderer theme override", () => {
  const widgetMgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })
  const endpoints = mockEndpoints()

  function renderThemedBlock(
    theme: BlockProto["theme"],
    children: AppNode[] = [text("scoped child")]
  ): void {
    renderWithContexts(
      <BlockNodeRenderer
        node={
          new BlockNode(
            FAKE_SCRIPT_HASH,
            children,
            new BlockProto({
              allowEmpty: true,
              flexContainer: {
                direction: BlockProto.FlexContainer.Direction.VERTICAL,
              },
              theme,
            })
          )
        }
        scriptRunId=""
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        widgetMgr={widgetMgr}
        endpoints={endpoints}
        // @ts-expect-error
        uploadClient={undefined}
      />
    )
  }

  it("does not paint a background for a primary-only override", () => {
    renderThemedBlock({ values: { primaryColor: "#7c3aed" } })
    const block = screen.getByTestId("stVerticalBlock")
    expect(block).toBeVisible()
    expect(block).not.toHaveStyle("background-color: rgb(124, 58, 237)")
  })

  it("paints background and text when those tokens are set", () => {
    renderThemedBlock({
      values: {
        backgroundColor: "#abcdef",
        textColor: "#111111",
      },
    })
    const block = screen.getByTestId("stVerticalBlock")
    expect(block).toHaveStyle("background-color: #abcdef")
    expect(block).toHaveStyle("color: #111111")
  })

  it("paints variant background and text for an explicit base", () => {
    renderThemedBlock({ base: CustomThemeConfig.BaseTheme.DARK })
    const block = screen.getByTestId("stVerticalBlock")
    expect(block).toBeVisible()
    expect(block).toHaveStyle(
      `background-color: ${darkTheme.emotion.colors.bgColor}`
    )
    expect(block).toHaveStyle(`color: ${darkTheme.emotion.colors.bodyText}`)
  })
})

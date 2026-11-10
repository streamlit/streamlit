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

import { type ReactElement, useContext } from "react"

import { act, screen, waitFor, within } from "@testing-library/react"
import type * as ReactAriaComponents from "react-aria-components"

import {
  Block as BlockProto,
  Button as ButtonProto,
  Delta as DeltaProto,
  Element,
  ForwardMsgMetadata,
  streamlit,
} from "@streamlit/protobuf"

import {
  type AppNode,
  AppRoot,
  BlockNode,
  ElementNode,
  TransientNode,
} from "~lib/AppNode"
import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import { STEP_BLOCK_ATTRIBUTE } from "~lib/components/core/Layout/stepConnector"
import { mockEndpoints } from "~lib/mocks/mocks"
import {
  forwardMsgMetadata,
  loadingBlock,
  makeProto,
  skeletonSpinner,
  text,
  textInput,
} from "~lib/render-tree/test-utils"
import { ScriptRunState } from "~lib/ScriptRunState"
import { mockEllipsizedLabels, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { BlockNodeRenderer, FlexBoxContainer, VerticalBlock } from "./Block"
import { RenderNodeVisitor } from "./RenderNodeVisitor"
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

function makeStretchSpace(): ElementNode {
  const element = {
    type: "space",
    space: {},
    widthConfig: { useStretch: true },
    heightConfig: { useStretch: true },
  } as unknown as Element

  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    "",
    FAKE_SCRIPT_HASH
  )
}

function makeHorizontalBlock(children: AppNode[]): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({
      allowEmpty: true,
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
        wrap: true,
      },
    })
  )
}

function makeColumnsBlock(columnChildren: AppNode[]): BlockNode {
  return makeHorizontalBlock([makeColumn(1, columnChildren)])
}

const DefiniteHeightProbe = (): ReactElement => (
  <div data-testid="definiteHeightProbe">
    {String(useContext(FlexContext)?.hasDefiniteHeight)}
  </div>
)

/** The top-level declarations of an element's emotion `@media print` rule. */
function printDeclarations(element: HTMLElement): string {
  const css = [...document.querySelectorAll("style")]
    .map(style => style.textContent ?? "")
    .join("\n")
  return [...element.classList]
    .filter(className => className.startsWith("css-"))
    .map(
      className =>
        new RegExp(`@media print\\{\\.${className}\\{([^}]*)\\}`).exec(
          css
        )?.[1] ?? ""
    )
    .join(";")
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
      "border: 1px solid #dcd8d4;"
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

  it.each([
    [
      "top",
      BlockProto.Column.VerticalAlignment.TOP,
      "justify-content: start;",
    ],
    [
      "center",
      BlockProto.Column.VerticalAlignment.CENTER,
      "justify-content: center;",
    ],
    [
      "bottom",
      BlockProto.Column.VerticalAlignment.BOTTOM,
      "justify-content: end;",
    ],
  ])(
    "aligns content inside a %s-aligned column instead of shrinking it",
    (_label, verticalAlignment, expectedJustify) => {
      const column = new BlockNode(
        FAKE_SCRIPT_HASH,
        [],
        new BlockProto({
          allowEmpty: true,
          column: { weight: 1, verticalAlignment },
        })
      )
      renderWithContexts(
        makeVerticalBlockComponent(
          makeVerticalBlock([makeHorizontalBlock([column])])
        )
      )

      const columnElement = screen.getByTestId("stColumn")
      // Auto margins would shrink the column and break equal-height borders.
      expect(columnElement).not.toHaveStyle("margin-top: auto;")
      expect(within(columnElement).getByTestId("stVerticalBlock")).toHaveStyle(
        expectedJustify
      )
    }
  )

  it("stretches a stretch-height container to the row in a horizontal parent", () => {
    const stretchChild = makeVerticalBlock([], {
      heightConfig: { useStretch: true },
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.VERTICAL,
        border: true,
      },
    })
    renderWithContexts(
      makeVerticalBlockComponent(
        makeVerticalBlock([makeHorizontalBlock([stretchChild])])
      )
    )

    const layoutWrapper = within(
      screen.getByTestId("stHorizontalBlock")
    ).getByTestId("stLayoutWrapper")
    expect(layoutWrapper).toHaveStyle("align-self: stretch;")
    expect(layoutWrapper).toHaveStyle("min-height: 100%;")
    // No max height, so taller content can grow it past a fixed-height row.
    expect(layoutWrapper).not.toHaveStyle("max-height: 100%;")
    expect(layoutWrapper).not.toHaveStyle("height: 100%;")
    // The bordered block fills its stretched wrapper through flex, without a
    // percentage height that would let it shrink below its content.
    const innerBlock = within(layoutWrapper).getByTestId("stVerticalBlock")
    expect(innerBlock).toHaveStyle("height: auto;")
    expect(innerBlock).toHaveStyle("flex: 1;")
  })

  it("fills a vertical parent with a flex basis for a stretch-height container", () => {
    const stretchChild = makeVerticalBlock([], {
      heightConfig: { useStretch: true },
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.VERTICAL,
      },
    })
    renderWithContexts(
      makeVerticalBlockComponent(makeVerticalBlock([stretchChild]))
    )

    const layoutWrapper = screen.getByTestId("stLayoutWrapper")
    // A percentage height would cap the container at its parent's height.
    expect(layoutWrapper).toHaveStyle("flex: 0 1 100%;")
    expect(layoutWrapper).toHaveStyle("height: auto;")
    expect(layoutWrapper).not.toHaveStyle("align-self: stretch;")
  })

  describe("print layout", () => {
    const stretchChild = (): BlockNode =>
      makeVerticalBlock([], {
        heightConfig: { useStretch: true },
        flexContainer: {
          direction: BlockProto.FlexContainer.Direction.VERTICAL,
          justify: BlockProto.FlexContainer.Justify.JUSTIFY_CENTER,
        },
      })

    it("keeps flex for a stretch-height container in a fixed-height parent", () => {
      renderWithContexts(
        makeVerticalBlockComponent(
          makeVerticalBlock([stretchChild()], {
            heightConfig: { pixelHeight: 400 },
            flexContainer: {
              direction: BlockProto.FlexContainer.Direction.VERTICAL,
            },
          })
        )
      )

      const layoutWrapper = screen.getByTestId("stLayoutWrapper")
      const innerBlock = within(layoutWrapper).getByTestId("stVerticalBlock")
      expect(printDeclarations(layoutWrapper)).not.toContain("display:block")
      expect(printDeclarations(innerBlock)).not.toContain("display:block")
    })

    it("uses block layout for a stretch-height container in a content-height parent", () => {
      renderWithContexts(
        makeVerticalBlockComponent(makeVerticalBlock([stretchChild()]))
      )

      const layoutWrapper = screen.getByTestId("stLayoutWrapper")
      const innerBlock = within(layoutWrapper).getByTestId("stVerticalBlock")
      expect(printDeclarations(layoutWrapper)).toContain("display:block")
      expect(printDeclarations(innerBlock)).toContain("display:block")
    })
  })

  it("does not apply the stretch overrides to a content-height container", () => {
    const contentChild = makeVerticalBlock([], {
      heightConfig: { useContent: true },
      flexContainer: {
        direction: BlockProto.FlexContainer.Direction.VERTICAL,
      },
    })
    renderWithContexts(
      makeVerticalBlockComponent(makeVerticalBlock([contentChild]))
    )

    const layoutWrapper = screen.getByTestId("stLayoutWrapper")
    expect(layoutWrapper).not.toHaveStyle("flex: 0 1 100%;")
    expect(within(layoutWrapper).getByTestId("stVerticalBlock")).toHaveStyle(
      "height: auto;"
    )
  })

  it("does not stretch st.space along the cross axis of a horizontal parent", () => {
    renderWithContexts(
      makeVerticalBlockComponent(
        makeVerticalBlock([makeHorizontalBlock([makeStretchSpace()])])
      )
    )

    const spaceContainer = screen.getByTestId("stElementContainer")
    expect(within(spaceContainer).getByTestId("stSpace")).toBeVisible()
    expect(spaceContainer).not.toHaveStyle("align-self: stretch;")
    expect(spaceContainer).not.toHaveStyle("max-height: 100%;")
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
          columns: 3,
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
    // A content-height form keeps filling its layout wrapper.
    expect(screen.getByTestId("stForm")).toHaveStyle("height: 100%;")
  })

  it("renders a stretch-height form that grows with its content", () => {
    renderWithContexts(
      makeBlockNodeComponent(
        makeVerticalBlock([text("form child")], {
          heightConfig: { useStretch: true },
          form: { formId: "stretch-form", border: true },
        })
      )
    )

    expect(screen.getByTestId("stLayoutWrapper")).toHaveStyle(
      "flex: 0 1 100%;"
    )
    const form = screen.getByTestId("stForm")
    expect(form).toHaveStyle("height: auto;")
    expect(form).toHaveStyle("flex: 1 1 0%;")
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

  it.each([
    ["a pixel-height", { pixelHeight: 300 }, "true"],
    ["a stretch-height root-level", { useStretch: true }, "false"],
    ["a content-height", { useContent: true }, "false"],
  ])(
    "derives the panel's definite height from %s tab container",
    (_label, heightConfig, expected) => {
      const collectElements = vi
        .spyOn(RenderNodeVisitor, "collectReactElements")
        .mockReturnValue([<DefiniteHeightProbe key="probe" />])
      try {
        const tab = makeVerticalBlock([text("tab body")], {
          tab: { label: "Tab 0" },
        })
        renderWithContexts(
          makeBlockNodeComponent(
            makeVerticalBlock([tab], { tabContainer: {}, heightConfig })
          )
        )

        expect(screen.getByTestId("definiteHeightProbe")).toHaveTextContent(
          expected
        )
      } finally {
        collectElements.mockRestore()
      }
    }
  )

  it("stretches a stretch-height tab container to the row in a horizontal parent", () => {
    const tab = makeVerticalBlock([text("tab body")], {
      tab: { label: "Tab 0" },
    })
    renderWithContexts(
      makeBlockNodeComponent(
        makeHorizontalBlock([
          makeVerticalBlock([tab], {
            tabContainer: {},
            heightConfig: { useStretch: true },
          }),
        ])
      )
    )

    const tabs = screen.getByTestId("stTabs")
    expect(tabs).toHaveStyle("align-self: stretch;")
    expect(tabs).toHaveStyle("max-height: 100%;")
    expect(tabs).not.toHaveStyle("height: 100%;")
  })
})

describe("loading blocks", () => {
  const CURRENT_RUN = "current-run"
  const PREVIOUS_RUN = "previous-run"

  function runContext(
    isRunning = true,
    scriptRunId = CURRENT_RUN
  ): Parameters<typeof renderWithContexts>[1] {
    return {
      scriptRunContext: {
        scriptRunState: isRunning
          ? ScriptRunState.RUNNING
          : ScriptRunState.NOT_RUNNING,
        scriptRunId,
      },
    }
  }

  /** Render `node` through `BlockNodeRenderer`, which owns the skeleton slot. */
  function blockComponent(node: BlockNode): ReactElement {
    return (
      <BlockNodeRenderer
        node={node}
        scriptRunId=""
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetsDisabled={false}
        // @ts-expect-error - widgetMgr is required
        widgetMgr={undefined}
        // @ts-expect-error - uploadClient is required
        uploadClient={undefined}
      />
    )
  }

  function renderBlock(
    node: BlockNode,
    isRunning = true,
    scriptRunId = CURRENT_RUN
  ): ReturnType<typeof renderWithContexts> {
    return renderWithContexts(
      blockComponent(node),
      runContext(isRunning, scriptRunId)
    )
  }

  /** Render a loading block that holds a spinner from its skeleton slot. */
  function renderWithSkeletonSpinner(showTime = false): HTMLElement {
    const spinner = skeletonSpinner("Fetching data...", CURRENT_RUN, showTime)
    renderBlock(
      loadingBlock(
        [new TransientNode(CURRENT_RUN, undefined, [spinner])],
        CURRENT_RUN
      )
    )
    return screen.getByTestId("stLoadingBlockSkeleton")
  }

  it("reserves the skeleton height and marks the block busy while it waits", () => {
    renderBlock(loadingBlock([], CURRENT_RUN))

    const skeleton = screen.getByTestId("stLoadingBlockSkeleton")
    expect(skeleton).toHaveStyle({ height: "200px" })
    // An unlabeled skeleton is decorative.
    expect(skeleton).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByTestId("stVerticalBlock")).toHaveAttribute(
      "aria-busy",
      "true"
    )
    expect(screen.queryByTestId("stPendingSkeleton")).not.toBeInTheDocument()
  })

  it("keeps previous content mounted under an overlay", () => {
    renderBlock(
      loadingBlock([text("previous chart", PREVIOUS_RUN)], CURRENT_RUN)
    )

    expect(screen.getByText("previous chart")).toBeInTheDocument()
    expect(screen.getByTestId("stPendingSkeleton")).toBeInTheDocument()
    expect(
      screen.queryByTestId("stLoadingBlockSkeleton")
    ).not.toBeInTheDocument()
  })

  it.each([
    ["the run drew content", [text("chart", CURRENT_RUN)], true],
    ["the run has ended", [text("chart", PREVIOUS_RUN)], false],
  ])("shows no skeleton once %s", (_, children, isRunning) => {
    renderBlock(loadingBlock(children, CURRENT_RUN), isRunning)

    expect(screen.getByTestId("stVerticalBlock")).not.toHaveAttribute(
      "aria-busy"
    )
    expect(
      screen.queryByTestId("stLoadingBlockSkeleton")
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("stPendingSkeleton")).not.toBeInTheDocument()
  })

  it.each([
    ["while its run is in progress", true, 2, 1],
    ["once its run has ended", false, 1, 0],
  ])(
    "renders an empty nested loading block only while needed: %s",
    (_, isRunning, blockCount, skeletonCount) => {
      renderBlock(
        makeVerticalBlock([loadingBlock([], CURRENT_RUN)]),
        isRunning
      )

      expect(screen.getAllByTestId("stVerticalBlock")).toHaveLength(blockCount)
      expect(screen.queryAllByTestId("stLoadingBlockSkeleton")).toHaveLength(
        skeletonCount
      )
    }
  )

  it("shows a single skeleton for nested loading blocks", () => {
    renderBlock(loadingBlock([loadingBlock([], CURRENT_RUN)], CURRENT_RUN))

    expect(screen.getAllByTestId("stLoadingBlockSkeleton")).toHaveLength(1)
    expect(screen.getByTestId("stLoadingBlockSkeleton")).toBeVisible()
    // The inner block shows no skeleton of its own, so it takes no space.
    expect(screen.getAllByTestId("stVerticalBlock")).toHaveLength(1)
  })

  it("shows a spinner's text on the skeleton instead of the spinner", async () => {
    const skeleton = renderWithSkeletonSpinner()

    expect(await within(skeleton).findByRole("status")).toHaveTextContent(
      "Fetching data..."
    )
    expect(skeleton).not.toHaveAttribute("aria-hidden")
    expect(screen.queryByTestId("stSpinner")).not.toBeInTheDocument()
    expect(within(skeleton).queryByText(/seconds/)).not.toBeInTheDocument()
  })

  it("shows a timed spinner's elapsed time on the skeleton", async () => {
    const skeleton = renderWithSkeletonSpinner(true)

    expect(await within(skeleton).findByText("(0.0 seconds)")).toBeVisible()
    expect(screen.queryByTestId("stSpinner")).not.toBeInTheDocument()
  })

  it("waits for the grace period before a block from an earlier run shows its skeleton", () => {
    vi.useFakeTimers()
    try {
      const { rerenderWithContexts } = renderBlock(
        loadingBlock([], PREVIOUS_RUN),
        false,
        PREVIOUS_RUN
      )
      rerenderWithContexts(
        blockComponent(loadingBlock([], CURRENT_RUN)),
        runContext()
      )

      // The empty block takes no space, so it adds no gap during the wait.
      expect(screen.queryByTestId("stVerticalBlock")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(screen.getByTestId("stLoadingBlockSkeleton")).toBeVisible()

      // A run that interrupts this one, with no render in between, waits again.
      // So does a run that interrupts one whose wait is still in progress.
      for (const runId of ["next-run", "last-run"]) {
        rerenderWithContexts(
          blockComponent(loadingBlock([], runId)),
          runContext(true, runId)
        )
        act(() => {
          vi.advanceTimersByTime(300)
        })
        expect(screen.queryByTestId("stVerticalBlock")).not.toBeInTheDocument()
      }
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(screen.getByTestId("stLoadingBlockSkeleton")).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ["an element", text("previous chart", PREVIOUS_RUN)],
    [
      "a container",
      makeVerticalBlock([text("previous chart", PREVIOUS_RUN)], {
        flexContainer: {},
      }),
    ],
  ])("covers %s that a standalone skeleton waits on", (_, previous) => {
    const skeleton = new ElementNode(
      makeProto(Element, { skeleton: {} }),
      ForwardMsgMetadata.create(),
      CURRENT_RUN,
      FAKE_SCRIPT_HASH
    )
    renderBlock(
      makeVerticalBlock([previous.withPendingSkeleton(skeleton)], {
        flexContainer: {},
      })
    )

    expect(screen.getByText("previous chart")).toBeVisible()
    const overlay = screen.getByTestId("stPendingSkeleton")
    expect(overlay).toHaveAttribute("aria-hidden", "true")
    expect(overlay.parentElement).toHaveAttribute("aria-busy", "true")
  })

  it("shows the skeleton when this run wrote the kept element further down", async () => {
    const skeleton = new ElementNode(
      makeProto(Element, { skeleton: {} }),
      ForwardMsgMetadata.create(),
      CURRENT_RUN,
      FAKE_SCRIPT_HASH
    )
    const button = (label: string, scriptRunId: string): ElementNode =>
      new ElementNode(
        makeProto(Element, { button: { id: "$$ID-moved-button", label } }),
        ForwardMsgMetadata.create(),
        scriptRunId,
        FAKE_SCRIPT_HASH
      )
    renderBlock(
      makeVerticalBlock(
        [
          button("Old", PREVIOUS_RUN).withPendingSkeleton(skeleton),
          button("New", CURRENT_RUN),
        ],
        { flexContainer: {} }
      )
    )

    // The layout shifted: this run's copy renders, and the slot that kept the
    // previous copy shows its skeleton.
    expect(await screen.findByRole("button", { name: "New" })).toBeVisible()
    expect(screen.getByTestId("stSkeletonElement")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Old" })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("stPendingSkeleton")).not.toBeInTheDocument()
  })

  it("keeps the children mounted when a container becomes a loading block", () => {
    const chart = text("previous chart", PREVIOUS_RUN)
    const { rerenderWithContexts } = renderBlock(
      makeVerticalBlock([chart], {
        flexContainer: {
          direction: BlockProto.FlexContainer.Direction.VERTICAL,
        },
      }),
      false,
      PREVIOUS_RUN
    )
    const chartNode = screen.getByText("previous chart")

    rerenderWithContexts(
      blockComponent(loadingBlock([chart], CURRENT_RUN)),
      runContext()
    )

    expect(screen.getByTestId("stPendingSkeleton")).toBeInTheDocument()
    expect(screen.getByText("previous chart")).toBe(chartNode)
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
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          border: false,
          rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
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
    // Three 200px tracks fit the 704px fallback, so only the cap gives 2.
    const block = makeGridBlock({
      columns: 2,
      minColumnWidthPx: 200,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    )
    expect(gridContainer).toHaveAttribute("data-test-column-count", "2")
  })

  it("resolves the column count from the column gap, not the row gap", () => {
    // A 4rem column gap fits two 200px tracks in 704px. The zero row gap
    // would fit three.
    const block = makeGridBlock({
      minColumnWidthPx: 200,
      rowGapConfig: { gapSize: streamlit.GapSize.NONE },
      columnGapConfig: { gapSize: streamlit.GapSize.LARGE },
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGrid")).toHaveAttribute(
      "data-test-column-count",
      "2"
    )
  })

  it("should keep the declared count and scroll when wrap is false", () => {
    const block = makeGridBlock({
      columns: 4,
      minColumnWidthPx: 200,
      wrap: false,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveStyle(
      "grid-template-columns: repeat(4, minmax(200px, 1fr))"
    )
    expect(gridContainer).toHaveStyle("overflow-x: auto;")
    expect(gridContainer).toHaveStyle("overflow-y: hidden;")
    // Clearance for the hover toolbar, inside the cross-axis clip. Bottom
    // padding is the focus ring. No negative margin, so this does not cover
    // the element above.
    expect(gridContainer).toHaveStyle(
      "padding-top: calc(0.25rem + 0.25rem + 0.25rem + 0.1rem + max(1.5rem, 24px))"
    )
    expect(gridContainer).toHaveStyle("padding-bottom: 0.2rem")
    expect(gridContainer).not.toHaveStyle("margin-block: -0.2rem")
    expect(gridContainer).toHaveAttribute("data-test-wrap", "false")
  })

  it("does not scroll a no-wrap grid whose tracks fit", () => {
    const block = makeGridBlock({
      columns: 2,
      minColumnWidthPx: 100,
      wrap: false,
    })
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).not.toHaveStyle("overflow-x: auto")
    expect(getComputedStyle(gridContainer).paddingTop).toBe("")
  })

  it("scrolls a text-only no-wrap grid without adding a tab stop", () => {
    const block = makeGridBlock(
      {
        columns: 4,
        minColumnWidthPx: 200,
        wrap: false,
      },
      [makeTextElement("Note")]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    // Like st.container(height=...), a scrolling grid is not a tab stop.
    const gridContainer = screen.getByTestId("stGrid")
    expect(gridContainer).toHaveStyle("overflow-x: auto")
    expect(gridContainer).not.toHaveAttribute("tabindex")
  })

  it("grows a stretch-height grid with its content instead of scrolling", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { useStretch: true },
        gridContainer: {
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          border: false,
          rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
        },
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    // Same rule as st.container: fill a bounded parent via flex basis, and
    // grow past it when the content is taller. Not an inner scrollport.
    const layoutWrapper = screen.getByTestId("stLayoutWrapper")
    expect(layoutWrapper).toHaveStyle("flex: 0 1 100%;")
    expect(layoutWrapper).toHaveStyle("height: auto;")
    expect(layoutWrapper).not.toHaveStyle("height: 100%;")
    expect(screen.getByTestId("stGridScrollBody")).toHaveStyle(
      "display: contents"
    )
    expect(screen.getByTestId("stGrid")).toHaveStyle("height: auto")
  })

  it("uses dense packing only when dense is set", () => {
    const { rerenderWithContexts } = renderWithContexts(
      makeGridNodeRendererComponent(makeGridBlock())
    )
    expect(screen.getByTestId("stGrid")).not.toHaveStyle(
      "grid-auto-flow: dense"
    )

    rerenderWithContexts(
      makeGridNodeRendererComponent(makeGridBlock({ dense: true }))
    )
    expect(screen.getByTestId("stGrid")).toHaveStyle("grid-auto-flow: dense")
  })

  it("does not clip a pixel-height grid until in-flow tracks overflow", () => {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { pixelHeight: 160 },
        gridContainer: {
          columns: 2,
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          border: false,
          rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
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
          columns: 4,
          minColumnWidthPx: 200,
          wrap: false,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          border: false,
          rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
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
    expect(screen.getByTestId("stGridScrollBody")).toHaveStyle(
      "overflow-y: hidden"
    )
    // The port is a fixed height, so the toolbar room lives on the grid
    // inside it rather than growing the port.
    expect(screen.getByTestId("stGrid")).toHaveStyle(
      "padding-top: calc(0.25rem + 0.25rem + 0.25rem + 0.1rem + max(1.5rem, 24px))"
    )
  })

  function mockGridAndPortWidths(
    gridWidth: number,
    portWidth: number,
    portClientWidth = portWidth
  ): () => void {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const width =
          this.dataset.testid === "stGridScrollBody" ? portWidth : gridWidth
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: 160,
          right: width,
          width,
          height: 160,
          toJSON: () => ({}),
        }
      })
    const clientSpy = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === "stGridScrollBody"
          ? portClientWidth
          : gridWidth
      })
    return () => {
      rectSpy.mockRestore()
      clientSpy.mockRestore()
    }
  }

  function renderBoundedNoWrapGrid(): void {
    const block = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({
        allowEmpty: true,
        heightConfig: { pixelHeight: 160 },
        gridContainer: {
          columns: 4,
          minColumnWidthPx: 200,
          wrap: false,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          border: false,
          rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
        },
      })
    )
    renderWithContexts(makeGridNodeRendererComponent(block))
  }

  it("scrolls a bounded no-wrap grid from the scrollport, not the expanded grid", async () => {
    // The grid element is already at the track floor. Deciding from that
    // width would clear the scrollbar. The port is still narrower.
    const restore = mockGridAndPortWidths(900, 400)
    try {
      renderBoundedNoWrapGrid()
      await waitFor(() => {
        expect(screen.getByTestId("stGridScrollBody")).toHaveStyle(
          "overflow-x: auto"
        )
      })
      expect(screen.getByTestId("stGridContentMeasure")).toHaveStyle(
        "min-width: 848px"
      )
      // Tracks that fit the port with no scrollbar gutter stay unscrolled
      // vertically.
      expect(screen.getByTestId("stGridScrollBody")).toHaveAttribute(
        "data-test-scroll",
        "false"
      )
    } finally {
      restore()
    }
  })

  it("does not scroll a bounded no-wrap grid when the scrollport fits the tracks", async () => {
    // A narrow grid measurement must not turn scrolling on once the port
    // is wide enough for every track.
    const restore = mockGridAndPortWidths(400, 900)
    try {
      renderBoundedNoWrapGrid()
      await waitFor(() => {
        expect(screen.getByTestId("stGridContentMeasure")).not.toHaveStyle(
          "min-width: 848px"
        )
      })
      expect(screen.getByTestId("stGridScrollBody")).not.toHaveStyle(
        "overflow-x: auto"
      )
    } finally {
      restore()
    }
  })

  it("scrolls a bounded no-wrap grid when a vertical scrollbar narrows the port", async () => {
    // The border box fits the 848px tracks. The content box beside a classic
    // scrollbar does not, so the right edge must scroll instead of clipping.
    const restore = mockGridAndPortWidths(900, 900, 820)
    try {
      renderBoundedNoWrapGrid()
      await waitFor(() => {
        expect(screen.getByTestId("stGridScrollBody")).toHaveStyle(
          "overflow-x: auto"
        )
      })
      expect(screen.getByTestId("stGridContentMeasure")).toHaveStyle(
        "min-width: 848px"
      )
    } finally {
      restore()
    }
  })

  it("scrolls a bounded no-wrap grid vertically when a horizontal scrollbar shortens the port", async () => {
    // The 160px tracks fit the 160px border box. A classic horizontal
    // scrollbar leaves 150px above it, so the bottom must scroll instead of
    // being clipped by the cross-axis overflow.
    const restoreWidths = mockGridAndPortWidths(900, 400)
    const offsetSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(160)
    const clientSpy = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === "stGridScrollBody" ? 150 : 160
      })
    try {
      renderBoundedNoWrapGrid()
      const scrollBody = screen.getByTestId("stGridScrollBody")
      await waitFor(() => {
        expect(scrollBody).toHaveAttribute("data-test-scroll", "true")
      })
      expect(scrollBody).toHaveStyle("overflow-y: auto")
      expect(scrollBody).toHaveStyle("overflow-x: auto")
      // The horizontally scrolling grid already holds the toolbar room, so
      // the port does not add a second copy.
      expect(getComputedStyle(scrollBody).paddingTop).toBe("")
    } finally {
      clientSpy.mockRestore()
      offsetSpy.mockRestore()
      restoreWidths()
    }
  })

  it("reserves toolbar room at the top once a bounded grid scrolls vertically", async () => {
    // Rows of 400px in a 160px port. A chart toolbar above the first row
    // would sit outside the port's top edge without the padding.
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const height =
          this.dataset.testid === "stGridContentMeasure" ? 400 : 160
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: height,
          right: 704,
          width: 704,
          height,
          toJSON: () => ({}),
        }
      })
    try {
      renderWithContexts(
        makeGridNodeRendererComponent(
          new BlockNode(
            FAKE_SCRIPT_HASH,
            [makeTextElement("Tall content")],
            new BlockProto({
              allowEmpty: true,
              heightConfig: { pixelHeight: 160 },
              gridContainer: {
                minColumnWidthPx: 220,
                rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
                columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
                verticalAlignment:
                  BlockProto.GridContainer.VerticalAlignment.TOP,
                border: false,
                rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
              },
            })
          )
        )
      )
      const scrollBody = screen.getByTestId("stGridScrollBody")
      await waitFor(() => {
        expect(scrollBody).toHaveAttribute("data-test-scroll", "true")
      })
      expect(scrollBody).toHaveStyle("overflow-y: auto")
      expect(scrollBody).toHaveStyle(
        "padding-top: calc(0.25rem + 0.25rem + 0.25rem + 0.1rem + max(1.5rem, 24px))"
      )
      // A wrapping grid does not scroll horizontally, so the grid itself
      // stays unpadded.
      expect(getComputedStyle(screen.getByTestId("stGrid")).paddingTop).toBe(
        ""
      )
    } finally {
      spy.mockRestore()
    }
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
          minColumnWidthPx: 220,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          border: false,
          rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
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
      { rowHeightMode: BlockProto.GridContainer.RowHeightMode.FIXED },
      [cell]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGridCell")).toHaveStyle("overflow: visible")
    expect(screen.getByTestId("stGridCell")).toHaveStyle("height: 100%")
    const body = screen.getByTestId("stGridCellBody")
    expect(body).toHaveAttribute("data-test-scroll", "false")
    // Toolbar room is only reserved once the cell scrolls.
    expect(getComputedStyle(body).paddingTop).toBe("")
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
        rowHeightMode: BlockProto.GridContainer.RowHeightMode.FIXED,
        verticalAlignment: BlockProto.GridContainer.VerticalAlignment.CENTER,
        rowHeightConfig: { pixelHeight: 240 },
      },
      [cell]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridCell = screen.getByTestId("stGridCell")
    expect(within(gridCell).getByTestId("stLayoutWrapper")).toHaveStyle({
      height: "100%",
      flex: "1 1 auto",
    })
    const cellBlock = within(gridCell).getByTestId("stVerticalBlock")
    expect(cellBlock).toHaveStyle({
      height: "100%",
      justifyContent: "safe center",
    })
    // The row height is definite, so print keeps the flex alignment.
    expect(printDeclarations(cellBlock)).not.toContain("display:block")

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

  function makeGridCellWithChildren(children: AppNode[]): BlockNode {
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

  it.each([
    ["content", BlockProto.GridContainer.RowHeightMode.CONTENT, "false"],
    ["fixed", BlockProto.GridContainer.RowHeightMode.FIXED, "true"],
  ])(
    "gives grid.cell() children a definite height in a %s row: %s",
    (_label, rowHeightMode, expected) => {
      const collectElements = vi
        .spyOn(RenderNodeVisitor, "collectReactElements")
        .mockReturnValue([<DefiniteHeightProbe key="probe" />])
      try {
        const block = makeGridBlock(
          { rowHeightMode, rowHeightConfig: { pixelHeight: 240 } },
          [makeGridCellWithChildren([makeTextElement("body")])]
        )
        renderWithContexts(makeGridNodeRendererComponent(block))

        expect(screen.getByTestId("definiteHeightProbe")).toHaveTextContent(
          expected
        )
      } finally {
        collectElements.mockRestore()
      }
    }
  )

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
            rowHeightMode: BlockProto.GridContainer.RowHeightMode.FIXED,
            rowHeightConfig: { pixelHeight: 240 },
          },
          [cell]
        )
      )
    )
  }

  it("scrolls a text-only fixed-height cell without adding a tab stop", async () => {
    const restore = mockMeasuredHeights()
    try {
      renderFixedHeightCell([makeTextElement("A long note")])
      const body = screen.getByTestId("stGridCellBody")
      await waitFor(() => {
        expect(body).toHaveAttribute("data-test-scroll", "true")
      })
      expect(body).not.toHaveAttribute("tabindex")
    } finally {
      restore()
    }
  })

  it("reserves toolbar room at the top of a scrolling fixed-height cell", async () => {
    const restore = mockMeasuredHeights()
    try {
      renderFixedHeightCell([makeTextElement("A long note")])
      const body = screen.getByTestId("stGridCellBody")
      await waitFor(() => {
        expect(body).toHaveAttribute("data-test-scroll", "true")
      })
      expect(body).toHaveStyle(
        "padding-top: calc(0.25rem + 0.25rem + 0.25rem + 0.1rem + max(1.5rem, 24px))"
      )
    } finally {
      restore()
    }
  })

  /**
   * Swaps in a ResizeObserver whose callbacks a test can fire, and runs
   * animation frames right away so the observer updates apply in `act`.
   */
  function captureResizeObservers(): {
    fireResize: () => void
    restore: () => void
  } {
    const callbacks = new Set<ResizeObserverCallback>()
    const original = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      private readonly callback: ResizeObserverCallback

      public unobserve = vi.fn()

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      public observe(): void {
        callbacks.add(this.callback)
      }

      public disconnect(): void {
        callbacks.delete(this.callback)
      }
    }
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(callback => {
        callback(0)
        return 0
      })
    return {
      fireResize: () => {
        act(() => {
          callbacks.forEach(callback => callback([], {} as ResizeObserver))
        })
      },
      restore: () => {
        globalThis.ResizeObserver = original
        rafSpy.mockRestore()
      },
    }
  }

  /** Mocks element boxes: `height` for the given test id, 160px otherwise. */
  function mockBoxes(
    measuredTestId: string,
    size: { width: number; height: number }
  ): () => void {
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const height =
          this.dataset.testid === measuredTestId ? size.height : 160
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: height,
          right: size.width,
          width: size.width,
          height,
          toJSON: () => ({}),
        }
      })
    return () => spy.mockRestore()
  }

  it("reflows the column count when the grid resizes, keeping cells mounted", () => {
    const size = { width: 704, height: 40 }
    const restoreBoxes = mockBoxes("stGrid", size)
    const observers = captureResizeObservers()
    try {
      renderWithContexts(
        makeGridNodeRendererComponent(
          makeGridBlock({ minColumnWidthPx: 200 }, [
            textInput("Name", "grid-resize-name"),
            text("Second"),
          ])
        )
      )
      const grid = screen.getByTestId("stGrid")
      expect(grid).toHaveAttribute("data-test-column-count", "3")
      const [inputCell] = screen.getAllByTestId("stGridCell")
      const inputContainer = within(inputCell).getByTestId(
        "stElementContainer"
      )

      size.width = 260
      observers.fireResize()
      expect(grid).toHaveAttribute("data-test-column-count", "1")

      size.width = 704
      observers.fireResize()
      expect(grid).toHaveAttribute("data-test-column-count", "3")
      expect(screen.getAllByTestId("stGridCell")[0]).toBe(inputCell)
      expect(within(inputCell).getByTestId("stElementContainer")).toBe(
        inputContainer
      )
    } finally {
      observers.restore()
      restoreBoxes()
    }
  })

  it("scrolls a measured fixed-height cell only once its content outgrows it", () => {
    const size = { width: 200, height: 100 }
    const restoreBoxes = mockBoxes("stGridCellContent", size)
    const observers = captureResizeObservers()
    try {
      renderFixedHeightCell([makeTextElement("A note")])
      const body = screen.getByTestId("stGridCellBody")
      // 100px of content in a 160px cell fits.
      expect(body).toHaveAttribute("data-test-scroll", "false")
      expect(body).not.toHaveStyle("overflow-y: auto")

      size.height = 400
      observers.fireResize()
      expect(body).toHaveAttribute("data-test-scroll", "true")
      expect(body).toHaveStyle("overflow-y: auto")
    } finally {
      observers.restore()
      restoreBoxes()
    }
  })

  it("scrolls a measured pixel-height grid only once its rows outgrow it", () => {
    const size = { width: 704, height: 100 }
    const restoreBoxes = mockBoxes("stGridContentMeasure", size)
    const observers = captureResizeObservers()
    try {
      renderWithContexts(
        makeGridNodeRendererComponent(
          new BlockNode(
            FAKE_SCRIPT_HASH,
            [makeTextElement("Rows")],
            new BlockProto({
              allowEmpty: true,
              heightConfig: { pixelHeight: 160 },
              gridContainer: {
                minColumnWidthPx: 220,
                rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
                columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
                rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
              },
            })
          )
        )
      )
      const scrollBody = screen.getByTestId("stGridScrollBody")
      // 100px of rows in a 160px port fit.
      expect(scrollBody).toHaveAttribute("data-test-scroll", "false")

      size.height = 400
      observers.fireResize()
      expect(scrollBody).toHaveAttribute("data-test-scroll", "true")
      expect(scrollBody).toHaveStyle("overflow-y: auto")
    } finally {
      observers.restore()
      restoreBoxes()
    }
  })

  it("fills a content row with a grid.cell() block and keeps the alignment", () => {
    const block = makeGridBlock(
      {
        rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
        verticalAlignment: BlockProto.GridContainer.VerticalAlignment.CENTER,
      },
      [makeGridCellWithChildren([makeTextElement("chart", true)])]
    )
    renderWithContexts(makeGridNodeRendererComponent(block))

    const gridCell = screen.getByTestId("stGridCell")
    expect(within(gridCell).getByTestId("stLayoutWrapper")).toHaveStyle({
      flex: "1 1 auto",
      minHeight: "0",
    })
    const cellBlock = within(gridCell).getByTestId("stVerticalBlock")
    expect(cellBlock).toHaveStyle({ justifyContent: "safe center" })
    // The row stretches the cell, like a column, so print keeps the flex
    // alignment.
    expect(printDeclarations(cellBlock)).not.toContain("display:block")
    // A content row has no definite height, so stretch children keep their
    // own flex instead of sharing the cell.
    expect(within(gridCell).getByTestId("stElementContainer")).not.toHaveStyle(
      { flex: "1 1 0%" }
    )
    expect(screen.getByTestId("stGridCellBody")).toHaveStyle(
      "display: contents"
    )
  })

  it("leaves a direct stretch child on height 100% without flex-grow", () => {
    const block = makeGridBlock(
      { rowHeightMode: BlockProto.GridContainer.RowHeightMode.FIXED },
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
      { rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT },
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
          { rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT },
          [cell]
        )
      )
    )
    const gridCell = screen.getByTestId("stGridCell")
    rerenderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock(
          {
            rowHeightMode: BlockProto.GridContainer.RowHeightMode.FIXED,
            rowHeightConfig: { pixelHeight: 240 },
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
    const block = makeGridBlock({ columns: 4 }, [cell])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGridCell")).toHaveStyle("grid-column: 1/-1")
  })

  it.each([
    [
      "clamps a column span to the resolved column count",
      { columnSpan: 4 },
      { gridColumn: "span 3" },
    ],
    ["applies a column span", { columnSpan: 2 }, { gridColumn: "span 2" }],
    ["applies a row span", { rowSpan: 2 }, { gridRow: "span 2" }],
  ])("%s", (_desc, gridCell, expectedStyle) => {
    const cell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true, vertical: {}, gridCell })
    )
    // st.grid(4) wraps to 3 columns at the 704px fallback.
    const block = makeGridBlock({ columns: 4 }, [cell])
    renderWithContexts(makeGridNodeRendererComponent(block))

    expect(screen.getByTestId("stGrid")).toHaveAttribute(
      "data-test-column-count",
      "3"
    )
    const cellElement = screen.getByTestId("stGridCell")
    expect(cellElement).toHaveStyle(expectedStyle)
    // A span on one axis leaves the other axis at a single track.
    const otherAxis = "gridColumn" in expectedStyle ? "gridRow" : "gridColumn"
    expect(getComputedStyle(cellElement)[otherAxis]).toBe("")
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
      { rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT },
      "grid-auto-rows: auto;",
    ],
    [
      "auto rows: fixed px for fixed mode",
      {
        rowHeightMode: BlockProto.GridContainer.RowHeightMode.FIXED,
        rowHeightConfig: { pixelHeight: 100 },
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

  it.each([
    ["after", false],
    ["before", true],
  ])(
    "gives a kept widget's skeleton its own cell when this run's copy renders %s it",
    (_, currentFirst) => {
      const consoleErrorSpy = vi.spyOn(console, "error")
      const skeleton = new ElementNode(
        makeProto(Element, { skeleton: {} }),
        ForwardMsgMetadata.create(),
        "current-run",
        FAKE_SCRIPT_HASH
      )
      const kept = textInput(
        "Old",
        "moved",
        "previous-run"
      ).withPendingSkeleton(skeleton)
      const current = textInput("New", "moved", "current-run")
      renderWithContexts(
        makeGridNodeRendererComponent(
          makeGridBlock({}, currentFirst ? [current, kept] : [kept, current])
        )
      )

      // One cell shows the skeleton, and the other renders this run's copy.
      const cells = screen.getAllByTestId("stGridCell")
      expect(cells).toHaveLength(2)
      const skeletonCell = currentFirst ? cells[1] : cells[0]
      expect(
        within(skeletonCell).getByTestId("stSkeletonElement")
      ).toBeVisible()
      expect(screen.getAllByTestId("stSkeletonElement")).toHaveLength(1)
      expect(screen.queryByTestId("stPendingSkeleton")).not.toBeInTheDocument()
      expect(
        consoleErrorSpy.mock.calls.some(([message]) =>
          String(message).includes("same key")
        )
      ).toBe(false)
      consoleErrorSpy.mockRestore()
    }
  )

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

  it("does not create a cell for an empty block that does not allow empty", () => {
    // A `grid.container()` that is never written to renders nothing in a
    // vertical layout. An empty `grid.cell()` allows empty and keeps its cell.
    const unwrittenContainer = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: false, vertical: {} })
    )
    const reservedCell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true, vertical: {}, gridCell: {} })
    )
    const block = makeGridBlock({ border: true }, [
      unwrittenContainer,
      reservedCell,
      text("Kept"),
    ])
    renderWithContexts(makeGridNodeRendererComponent(block))

    const cells = screen.getAllByTestId("stGridCell")
    expect(cells).toHaveLength(2)
    expect(cells[0]).not.toHaveTextContent("Kept")
    expect(cells[1]).toHaveTextContent("Kept")
  })

  it("keeps a later cell's controls mounted when an earlier empty container fills in", () => {
    // `placeholder = grid.container()`, a text input in the next
    // `grid.cell()`, then a write into `placeholder`.
    const placeholder = (children: AppNode[]): BlockNode =>
      new BlockNode(
        FAKE_SCRIPT_HASH,
        children,
        new BlockProto({ allowEmpty: false, vertical: {} })
      )
    const queryCell = new BlockNode(
      FAKE_SCRIPT_HASH,
      [textInput("Query", "grid-later-query")],
      new BlockProto({ allowEmpty: true, vertical: {}, gridCell: {} })
    )
    const { rerenderWithContexts } = renderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock({}, [placeholder([]), queryCell])
      )
    )
    // The input container is a new node whenever the input remounts.
    const inputContainer = within(
      screen.getByTestId("stGridCell")
    ).getByTestId("stElementContainer")

    rerenderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock({}, [placeholder([text("Results")]), queryCell])
      )
    )

    const cells = screen.getAllByTestId("stGridCell")
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent("Results")
    expect(within(cells[1]).getByTestId("stElementContainer")).toBe(
      inputContainer
    )
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

  it("keeps fragment cells separate and mounted when a spinner wraps their wrapper", () => {
    const fragment = new BlockNode(
      FAKE_SCRIPT_HASH,
      [
        textInput("First", "grid-spinner-first"),
        textInput("Second", "grid-spinner-second"),
      ],
      new BlockProto({ allowEmpty: true, transparent: {} })
    )
    const { rerenderWithContexts } = renderWithContexts(
      makeGridNodeRendererComponent(makeGridBlock({}, [fragment]))
    )
    const [firstCell, secondCell] = screen.getAllByTestId("stGridCell")

    rerenderWithContexts(
      makeGridNodeRendererComponent(
        makeGridBlock({}, [
          new TransientNode(FAKE_SCRIPT_HASH, fragment, [text("Loading")]),
        ])
      )
    )

    const cells = screen.getAllByTestId("stGridCell")
    expect(cells).toHaveLength(3)
    expect(cells[0]).toHaveTextContent("Loading")
    expect(cells[0]).not.toHaveTextContent("First")
    expect(cells[1]).toBe(firstCell)
    expect(cells[2]).toBe(secondCell)
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
    const block = makeGridBlock({ columns: 4 }, [
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
          minColumnWidthPx: 200,
          rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
          columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
          verticalAlignment: BlockProto.GridContainer.VerticalAlignment.TOP,
          border: false,
          rowHeightMode: BlockProto.GridContainer.RowHeightMode.CONTENT,
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

describe("element retention", () => {
  const widgetMgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

  // ElementNodeRenderer lazy-loads TextInput. Load it up front so the first
  // render doesn't depend on how fast a cold dynamic import resolves.
  beforeAll(async () => {
    await import("~lib/components/widgets/TextInput/TextInput")
  }, 30_000)

  function writeElement(
    root: AppRoot,
    scriptRunId: string,
    index: number,
    element: Element.$Properties
  ): AppRoot {
    return root.applyDelta(
      scriptRunId,
      makeProto(DeltaProto, { newElement: element }),
      forwardMsgMetadata([0, index])
    )
  }

  function renderMain(root: AppRoot): ReactElement {
    return (
      <FlexBoxContainer
        node={root.main}
        widgetsDisabled={false}
        widgetMgr={widgetMgr}
        // @ts-expect-error - uploadClient is required
        uploadClient={undefined}
      />
    )
  }

  const nameInput = {
    textInput: { id: "$$ID-name-key", label: "Name", default: "" },
  }

  it("keeps a displaced widget mounted until the run re-emits it", async () => {
    let root = new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        new BlockNode(
          FAKE_SCRIPT_HASH,
          [],
          new BlockProto({ allowEmpty: true })
        ),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    )
    root = writeElement(root, "run0", 0, { text: { body: "first" } })
    root = writeElement(root, "run0", 1, nameInput)
    root = root.clearStaleNodes("run0")

    const { rerenderWithContexts } = renderWithContexts(renderMain(root), {
      scriptRunContext: {
        scriptRunId: "run0",
        scriptRunState: ScriptRunState.NOT_RUNNING,
      },
    })
    const input = await screen.findByRole("textbox", { name: "Name" })

    // A notice is inserted above the input and overwrites its delta path.
    const running = {
      scriptRunContext: {
        scriptRunId: "run1",
        scriptRunState: ScriptRunState.RUNNING,
      },
    }
    root = writeElement(root, "run1", 0, { text: { body: "first" } })
    root = writeElement(root, "run1", 1, { text: { body: "notice" } })
    rerenderWithContexts(renderMain(root), running)

    expect(await screen.findByText("notice")).toBeVisible()
    expect(input).toBeInTheDocument()
    expect(input).not.toBeVisible()
    expect(
      input.closest("[data-testid='stElementContainer']")
    ).toHaveAttribute("data-retained", "true")

    // The input arrives one slot later and reclaims the mounted instance.
    root = writeElement(root, "run1", 2, nameInput)
    rerenderWithContexts(renderMain(root), running)

    expect(screen.getByRole("textbox", { name: "Name" })).toBe(input)
    expect(input).toBeVisible()
    expect(
      input.closest("[data-testid='stElementContainer']")
    ).not.toHaveAttribute("data-retained")
  })

  it("keeps a displaced widget in a grid cell mounted until the run re-emits it", async () => {
    const writeGrid = (root: AppRoot, scriptRunId: string): AppRoot =>
      root.applyDelta(
        scriptRunId,
        makeProto(DeltaProto, {
          addBlock: {
            allowEmpty: true,
            gridContainer: {
              minColumnWidthPx: 220,
              rowGapConfig: { gapSize: streamlit.GapSize.SMALL },
              columnGapConfig: { gapSize: streamlit.GapSize.SMALL },
            },
          },
        }),
        forwardMsgMetadata([0, 0])
      )
    const writeGridElement = (
      root: AppRoot,
      scriptRunId: string,
      index: number,
      element: Element.$Properties
    ): AppRoot =>
      root.applyDelta(
        scriptRunId,
        makeProto(DeltaProto, { newElement: element }),
        forwardMsgMetadata([0, 0, index])
      )
    const cellOf = (element: HTMLElement): HTMLElement | null =>
      element.closest<HTMLElement>("[data-testid='stGridCell']")

    let root = new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        new BlockNode(
          FAKE_SCRIPT_HASH,
          [],
          new BlockProto({ allowEmpty: true })
        ),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    )
    root = writeGrid(root, "run0")
    root = writeGridElement(root, "run0", 0, { text: { body: "first" } })
    root = writeGridElement(root, "run0", 1, nameInput)
    root = root.clearStaleNodes("run0")

    const { rerenderWithContexts } = renderWithContexts(renderMain(root), {
      scriptRunContext: {
        scriptRunId: "run0",
        scriptRunState: ScriptRunState.NOT_RUNNING,
      },
    })
    const input = await screen.findByRole("textbox", { name: "Name" })

    // A notice is inserted above the input and overwrites its grid slot.
    const running = {
      scriptRunContext: {
        scriptRunId: "run1",
        scriptRunState: ScriptRunState.RUNNING,
      },
    }
    root = writeGrid(root, "run1")
    root = writeGridElement(root, "run1", 0, { text: { body: "first" } })
    root = writeGridElement(root, "run1", 1, { text: { body: "notice" } })
    rerenderWithContexts(renderMain(root), running)

    expect(await screen.findByText("notice")).toBeVisible()
    expect(input).toBeInTheDocument()
    expect(cellOf(input)).not.toBeVisible()

    // The input arrives one slot later and reclaims the mounted cell.
    root = writeGridElement(root, "run1", 2, nameInput)
    rerenderWithContexts(renderMain(root), running)

    expect(screen.getByRole("textbox", { name: "Name" })).toBe(input)
    expect(cellOf(input)).toBeVisible()
    expect(screen.getAllByTestId("stGridCell")).toHaveLength(3)
  })

  it("unmounts a displaced widget that the run never re-emits", async () => {
    let root = new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        new BlockNode(
          FAKE_SCRIPT_HASH,
          [],
          new BlockProto({ allowEmpty: true })
        ),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    )
    root = writeElement(root, "run0", 0, nameInput)
    root = root.clearStaleNodes("run0")

    const { rerenderWithContexts } = renderWithContexts(renderMain(root))
    expect(await screen.findByRole("textbox", { name: "Name" })).toBeVisible()

    root = writeElement(root, "run1", 0, { text: { body: "replacement" } })
    rerenderWithContexts(renderMain(root))
    expect(await screen.findByText("replacement")).toBeVisible()
    expect(
      screen.getByRole("textbox", { name: "Name", hidden: true })
    ).not.toBeVisible()

    root = root.clearStaleNodes("run1")
    rerenderWithContexts(renderMain(root))

    expect(screen.getByText("replacement")).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull()
  })
})

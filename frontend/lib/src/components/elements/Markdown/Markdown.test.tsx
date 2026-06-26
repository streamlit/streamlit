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

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  Element,
  ForwardMsgMetadata,
  Markdown as MarkdownProto,
  streamlit,
} from "@streamlit/protobuf"

import { ElementNode } from "~lib/AppNode"
import ElementNodeRenderer, {
  ElementNodeRendererProps,
} from "~lib/components/core/Block/ElementNodeRenderer"
import {
  FlexContext,
  IFlexContext,
} from "~lib/components/core/Layout/FlexContext"
import { Direction } from "~lib/components/core/Layout/utils"
import { ComponentRegistry } from "~lib/components/widgets/CustomComponent/ComponentRegistry"
import { FileUploadClient } from "~lib/FileUploadClient"
import { mockEndpoints, mockSessionInfo } from "~lib/mocks/mocks"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Markdown, { MarkdownProps } from "./Markdown"

const getProps = (
  elementProps: Partial<MarkdownProps["element"]> = {}
): MarkdownProps => ({
  element: MarkdownProto.create({
    body:
      "Emphasis, aka italics, with *asterisks* or _underscores_." +
      "Combined emphasis with **asterisks and _underscores_**." +
      "[I'm an inline-style link with title](https://www.https://streamlit.io/ Streamlit)",
    allowHtml: false,
    ...elementProps,
  }),
})

describe("Markdown element", () => {
  it("renders markdown as expected", () => {
    const props = getProps()
    render(<Markdown {...props} />)
    const markdown = screen.getByTestId("stMarkdown")
    expect(markdown).toBeInTheDocument()
    expect(markdown).toHaveClass("stMarkdown")
  })
})

describe("Markdown element with help", () => {
  it("renders markdown with help tooltip as expected", async () => {
    const user = userEvent.setup()
    const props = getProps({ help: "help text" })
    render(<Markdown {...props} />)
    const tooltip = screen.getByTestId("stTooltipHoverTarget")

    await user.hover(tooltip)

    const helpText = await screen.findByText("help text")
    expect(helpText).toBeVisible()
  })

  it("renders markdown without tooltip when help is empty string", () => {
    const props = getProps({ help: "" })
    render(<Markdown {...props} />)

    // Empty help should not render a tooltip icon
    expect(
      screen.queryByTestId("stTooltipHoverTarget")
    ).not.toBeInTheDocument()
  })

  it("renders markdown help tooltip with newlines correctly", async () => {
    const user = userEvent.setup()
    const props = getProps({ help: "Line 1\n\nLine 2\n\nLine 3" })
    render(<Markdown {...props} />)

    // Verify the help text is NOT leaked into the markdown body
    const markdown = screen.getByTestId("stMarkdownContainer")
    expect(markdown).not.toHaveTextContent("Line 2")
    expect(markdown).not.toHaveTextContent("Line 3")

    // Hover to show tooltip
    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    // Verify tooltip contains all lines (rendered as separate paragraphs)
    const helpContent = await screen.findByTestId("stTooltipContent")
    expect(helpContent).toBeVisible()
    expect(helpContent).toHaveTextContent("Line 1")
    expect(helpContent).toHaveTextContent("Line 2")
    expect(helpContent).toHaveTextContent("Line 3")
  })

  it("renders markdown help tooltip with literal backslash-n without converting to newline", async () => {
    const user = userEvent.setup()
    // User wants to display literal \n in tooltip (e.g., documentation about escape sequences)
    const props = getProps({ help: "Use \\n for newlines" })
    render(<Markdown {...props} />)

    // Hover to show tooltip
    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    // Verify tooltip shows literal \n text, not an actual newline
    const helpContent = await screen.findByTestId("stTooltipContent")
    expect(helpContent).toBeVisible()
    // The text should contain the literal backslash-n, rendered as a single line
    expect(helpContent).toHaveTextContent("Use \\n for newlines")
  })

  it("renders markdown help tooltip with spaces around newlines correctly", async () => {
    const user = userEvent.setup()
    const props = getProps({ help: "Tool tip with \n\n new lines" })
    render(<Markdown {...props} />)

    // Verify the help text is NOT leaked into the markdown body
    const markdown = screen.getByTestId("stMarkdownContainer")
    expect(markdown).not.toHaveTextContent("new lines")

    // Hover to show tooltip
    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    // Verify tooltip contains the text with proper paragraph breaks
    const helpContent = await screen.findByTestId("stTooltipContent")
    expect(helpContent).toBeVisible()

    // Markdown with leading/trailing spaces on paragraphs: "Tool tip with " and " new lines"
    // Both parts should be present (markdown may normalize some whitespace)
    const text = helpContent.textContent || ""
    expect(text).toContain("Tool tip")
    expect(text).toContain("new lines")
  })

  it("renders markdown help tooltip with closing bracket correctly", async () => {
    const user = userEvent.setup()
    // Closing bracket ] would prematurely close the :help[] directive
    const props = getProps({ help: "Help before ] help after" })
    render(<Markdown {...props} />)

    // Verify the help text is NOT leaked into the markdown body
    const markdown = screen.getByTestId("stMarkdownContainer")
    expect(markdown).not.toHaveTextContent("Help before")
    expect(markdown).not.toHaveTextContent("help after")

    // Hover to show tooltip
    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    // Verify tooltip contains the full text including the bracket
    const helpContent = await screen.findByTestId("stTooltipContent")
    expect(helpContent).toBeVisible()
    expect(helpContent).toHaveTextContent("Help before ] help after")
  })

  it("renders markdown help tooltip with inline code correctly", async () => {
    const user = userEvent.setup()
    const props = getProps({ help: "Use `st.markdown()` for text" })
    render(<Markdown {...props} />)

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    const helpContent = await screen.findByTestId("stTooltipContent")
    expect(helpContent).toBeVisible()
    // Verify text content is present (markdown formatting may vary)
    expect(helpContent).toHaveTextContent("Use")
    expect(helpContent).toHaveTextContent("st.markdown()")
    expect(helpContent).toHaveTextContent("for text")
  })

  it("renders markdown help tooltip with complex markdown features", async () => {
    const user = userEvent.setup()
    // Combination of special characters: code, brackets, newlines
    const props = getProps({
      help: "Use `code[i]` or array]\n\nNext line with **bold**",
    })
    render(<Markdown {...props} />)

    // Verify nothing leaked
    const markdown = screen.getByTestId("stMarkdownContainer")
    expect(markdown).not.toHaveTextContent("code[i]")
    expect(markdown).not.toHaveTextContent("bold")

    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltip)

    const helpContent = await screen.findByTestId("stTooltipContent")
    expect(helpContent).toBeVisible()
    // Verify all parts of the content are present
    expect(helpContent).toHaveTextContent("Use")
    expect(helpContent).toHaveTextContent("code[i]")
    expect(helpContent).toHaveTextContent("array]")
    expect(helpContent).toHaveTextContent("Next line")
    expect(helpContent).toHaveTextContent("bold")
  })

  it("renders single-line HTML body with help as an icon and no literal :help[] text (gh-15211)", async () => {
    const user = userEvent.setup()
    const props = getProps({
      body: "<p>an example</p>",
      allowHtml: true,
      help: "HTML help tooltip",
    })
    render(<Markdown {...props} />)

    expect(await screen.findByText("an example")).toBeVisible()

    // The literal ":help[]" must not leak into the rendered output.
    const markdown = screen.getByTestId("stMarkdown")
    expect(markdown).not.toHaveTextContent(":help[]")

    await user.hover(screen.getByTestId("stTooltipHoverTarget"))

    const helpContent = await screen.findByTestId("stTooltipContent")
    expect(helpContent).toBeVisible()
    expect(helpContent).toHaveTextContent("HTML help tooltip")
  })

  it("renders multi-line HTML body with help as an icon (gh-15211)", async () => {
    const props = getProps({
      body: "<div>\n<p>line 1</p>\n<p>line 2</p>\n</div>",
      allowHtml: true,
      help: "HTML help tooltip",
    })
    render(<Markdown {...props} />)

    expect(await screen.findByText("line 1")).toBeVisible()
    expect(screen.getByText("line 2")).toBeVisible()

    const markdown = screen.getByTestId("stMarkdown")
    expect(markdown).not.toHaveTextContent(":help[]")
    expect(screen.getByTestId("stTooltipHoverTarget")).toBeVisible()
  })

  it("renders LaTeX body with help via the LaTeX branch (anti-regression)", () => {
    const props = getProps({
      body: "\\KaTeX",
      elementType: MarkdownProto.Type.LATEX,
      allowHtml: false,
      help: "LaTeX help tooltip",
    })
    render(<Markdown {...props} />)

    // LaTeX branch must render the inline tooltip icon, not inject :help[].
    const markdown = screen.getByTestId("stMarkdown")
    expect(markdown).not.toHaveTextContent(":help[]")
    expect(screen.getByTestId("stTooltipHoverTarget")).toBeVisible()
  })
})

describe("Markdown badge with help", () => {
  it("renders a markdown badge and displays a tooltip when help is provided", async () => {
    const user = userEvent.setup()
    const element = MarkdownProto.create({
      body: ":blue-badge[Testing Badge]",
      help: "Tooltip text",
      elementType: MarkdownProto.Type.NATIVE,
      allowHtml: false,
    })
    render(<Markdown element={element} />)

    // Expect at least one badge to render
    const badges = screen.getAllByText("Testing Badge")
    expect(badges.length).toBeGreaterThanOrEqual(1)

    // Tooltip hover target should exist
    const hoverTarget = screen.getByTestId("stTooltipHoverTarget")

    // Hover over to trigger tooltip
    await user.hover(hoverTarget)

    // Tooltip text should appear
    const tooltip = await screen.findByText("Tooltip text")
    expect(tooltip).toBeVisible()
  })

  it("renders markdown badge without tooltip when help not provided", () => {
    const element = MarkdownProto.create({
      body: ":blue-badge[Testing Badge]",
      elementType: MarkdownProto.Type.NATIVE,
      allowHtml: false,
    })
    render(<Markdown element={element} />)

    // Expect a badge to render without tooltip
    expect(screen.getByText("Testing Badge")).toBeVisible()
    expect(
      screen.queryByTestId("stTooltipHoverTarget")
    ).not.toBeInTheDocument()
  })

  it("renders multiple markdown badges with inline tooltip instead of BaseButtonTooltip", () => {
    const element = MarkdownProto.create({
      body: ":blue-badge[Badge 1] :grey-badge[Badge 2]",
      help: "Multiple badges tooltip",
      elementType: MarkdownProto.Type.NATIVE,
      allowHtml: false,
    })
    render(<Markdown element={element} />)

    // Expect inline tooltip to exist
    const inlineTooltips = screen.getAllByTestId("stTooltipHoverTarget")
    expect(inlineTooltips.length).toBeGreaterThan(0)

    // Expect that both badges render
    expect(screen.getByText("Badge 1")).toBeVisible()
    expect(screen.getByText("Badge 2")).toBeVisible()
  })

  it("renders markdown badge mixed with text using inline tooltip instead of BaseButtonTooltip", () => {
    const element = MarkdownProto.create({
      body: ":blue-badge[Badge 1] with some text",
      help: "Badges with text in markdown tooltip",
      elementType: MarkdownProto.Type.NATIVE,
      allowHtml: false,
    })
    render(<Markdown element={element} />)

    // Expect inline tooltip to exist
    const inlineTooltips = screen.getAllByTestId("stTooltipHoverTarget")
    expect(inlineTooltips.length).toBeGreaterThan(0)

    // Expect that badge renders
    expect(screen.getByText("Badge 1")).toBeVisible()
  })

  it("renders markdown badge with escaped brackets with BaseButtonTooltip", async () => {
    const user = userEvent.setup()
    const element = MarkdownProto.create({
      body: ":blue-badge[Label \\[with\\] brackets]",
      help: "Tooltip for escaped brackets",
      elementType: MarkdownProto.Type.NATIVE,
      allowHtml: false,
    })
    render(<Markdown element={element} />)

    // Expect at least one badge to render
    const badges = screen.getAllByText("Label [with] brackets")
    expect(badges.length).toBeGreaterThanOrEqual(1)

    // Tooltip hover target should exist
    const hoverTarget = screen.getByTestId("stTooltipHoverTarget")

    // Hover over to trigger tooltip
    await user.hover(hoverTarget)

    // Tooltip text should appear
    const tooltip = await screen.findByText("Tooltip for escaped brackets")
    expect(tooltip).toBeVisible()
  })

  it("renders markdown badge with escaped backslashes with BaseButtonTooltip", async () => {
    const user = userEvent.setup()
    const element = MarkdownProto.create({
      body: ":blue-badge[Label with \\\\ slashes]",
      help: "Tooltip with backslash",
      elementType: MarkdownProto.Type.NATIVE,
      allowHtml: false,
    })

    render(<Markdown element={element} />)

    // Expect at least one badge to render
    const badges = screen.getAllByText("Label with \\ slashes")
    expect(badges.length).toBeGreaterThanOrEqual(1)

    // Tooltip hover target should exist
    const hoverTarget = screen.getByTestId("stTooltipHoverTarget")

    // Hover over to trigger tooltip
    await user.hover(hoverTarget)

    // Tooltip text should appear
    const tooltip = await screen.findByText("Tooltip with backslash")
    expect(tooltip).toBeVisible()
  })
})

// Integration tests for Markdown auto width behavior via ElementNodeRenderer
// These tests verify that width="auto" (no widthConfig) applies container-aware sizing
describe("Markdown auto width behavior", () => {
  const FAKE_SCRIPT_HASH = "fake_script_hash"

  function createMarkdownNode(
    scriptRunId: string,
    widthConfig?: streamlit.WidthConfig
  ): ElementNode {
    const element = new Element({
      markdown: new MarkdownProto({
        body: "Test markdown",
        allowHtml: false,
        elementType: MarkdownProto.Type.NATIVE,
      }),
    })
    if (widthConfig) {
      element.widthConfig = widthConfig
    }
    const node = new ElementNode(
      element,
      ForwardMsgMetadata.create({}),
      scriptRunId,
      FAKE_SCRIPT_HASH
    )
    return node
  }

  function getElementNodeRendererProps(
    props: Partial<ElementNodeRendererProps> &
      Pick<ElementNodeRendererProps, "node">
  ): ElementNodeRendererProps {
    const sessionInfo = mockSessionInfo()
    const endpoints = mockEndpoints()
    return {
      endpoints: endpoints,
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: vi.fn(),
        formsDataChanged: vi.fn(),
      }),
      widgetsDisabled: false,
      uploadClient: new FileUploadClient({
        sessionInfo: sessionInfo,
        endpoints,
        formsWithPendingRequestsChanged: () => {},
        requestFileURLs: vi.fn(),
      }),
      componentRegistry: new ComponentRegistry(endpoints),
      ...props,
    }
  }

  const renderMarkdownWithFlexContext = (
    props: ElementNodeRendererProps,
    flexContext: IFlexContext
  ): void => {
    render(
      <FlexContext.Provider value={flexContext}>
        <ElementNodeRenderer {...props} />
      </FlexContext.Provider>
    )
  }

  it("should use fit-content width in horizontal layout when no widthConfig", async () => {
    const scriptRunId = "SCRIPT_RUN_ID"
    const props = getElementNodeRendererProps({
      node: createMarkdownNode(scriptRunId),
    })

    const horizontalFlexContext: IFlexContext = {
      direction: Direction.HORIZONTAL,
      isInHorizontalLayout: true,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    renderMarkdownWithFlexContext(props, horizontalFlexContext)

    await waitFor(() => expect(screen.queryByTestId("stSkeleton")).toBeNull())

    const container = screen.getByTestId("stElementContainer")
    expect(container).toBeVisible()
    expect(container).toHaveStyle({ width: "fit-content" })
  })

  it("should use 100% width in vertical layout when no widthConfig", async () => {
    const scriptRunId = "SCRIPT_RUN_ID"
    const props = getElementNodeRendererProps({
      node: createMarkdownNode(scriptRunId),
    })

    const verticalFlexContext: IFlexContext = {
      direction: Direction.VERTICAL,
      isInHorizontalLayout: false,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    renderMarkdownWithFlexContext(props, verticalFlexContext)

    await waitFor(() => expect(screen.queryByTestId("stSkeleton")).toBeNull())

    const container = screen.getByTestId("stElementContainer")
    expect(container).toBeVisible()
    expect(container).toHaveStyle({ width: "100%" })
  })

  it("should apply stretch width when server sends useStretch config", async () => {
    const scriptRunId = "SCRIPT_RUN_ID"
    const widthConfig = new streamlit.WidthConfig({ useStretch: true })
    const props = getElementNodeRendererProps({
      node: createMarkdownNode(scriptRunId, widthConfig),
    })

    const horizontalFlexContext: IFlexContext = {
      direction: Direction.HORIZONTAL,
      isInHorizontalLayout: true,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    renderMarkdownWithFlexContext(props, horizontalFlexContext)

    await waitFor(() => expect(screen.queryByTestId("stSkeleton")).toBeNull())

    const container = screen.getByTestId("stElementContainer")
    expect(container).toBeVisible()
    expect(container).toHaveStyle({ width: "100%" })
  })

  it("should apply content width when server sends useContent config", async () => {
    const scriptRunId = "SCRIPT_RUN_ID"
    const widthConfig = new streamlit.WidthConfig({ useContent: true })
    const props = getElementNodeRendererProps({
      node: createMarkdownNode(scriptRunId, widthConfig),
    })

    const verticalFlexContext: IFlexContext = {
      direction: Direction.VERTICAL,
      isInHorizontalLayout: false,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    renderMarkdownWithFlexContext(props, verticalFlexContext)

    await waitFor(() => expect(screen.queryByTestId("stSkeleton")).toBeNull())

    const container = screen.getByTestId("stElementContainer")
    expect(container).toBeVisible()
    expect(container).toHaveStyle({ width: "fit-content" })
  })

  it("should apply pixel width when server sends pixelWidth config", async () => {
    const scriptRunId = "SCRIPT_RUN_ID"
    const widthConfig = new streamlit.WidthConfig({ pixelWidth: 150 })
    const props = getElementNodeRendererProps({
      node: createMarkdownNode(scriptRunId, widthConfig),
    })

    const verticalFlexContext: IFlexContext = {
      direction: Direction.VERTICAL,
      isInHorizontalLayout: false,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    renderMarkdownWithFlexContext(props, verticalFlexContext)

    await waitFor(() => expect(screen.queryByTestId("stSkeleton")).toBeNull())

    const container = screen.getByTestId("stElementContainer")
    expect(container).toBeVisible()
    expect(container).toHaveStyle({ width: "150px" })
  })
})

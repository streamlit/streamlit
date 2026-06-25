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

import { Heading as HeadingProto } from "@streamlit/protobuf"

import IsDialogContext from "~lib/components/core/IsDialogContext"
import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  FlexContext,
  IFlexContext,
} from "~lib/components/core/Layout/FlexContext"
import { Direction } from "~lib/components/core/Layout/utils"
import { render } from "~lib/test_util"

import Heading, { HeadingProtoProps } from "./Heading"

const getHeadingProps = (
  elementProps: Partial<HeadingProto> = {}
): HeadingProtoProps => ({
  element: HeadingProto.create({
    anchor: "some-anchor",
    tag: "h1",
    body: `hello world
             this is a new line`,
    ...elementProps,
  }),
})

describe("Heading", () => {
  beforeAll(async () => {
    await import("~lib/components/elements/CodeBlock/StreamlitSyntaxHighlighter")
  }, 30_000)

  it("renders properly after a new line", async () => {
    const props = getHeadingProps()
    render(<Heading {...props} />)

    const heading = screen.getByRole("heading")
    expect(heading).toHaveTextContent("hello world")
    expect(heading).not.toHaveTextContent("this is a new line")

    await screen.findByText("this is a new line")
    expect(screen.getAllByTestId("stMarkdownContainer")).toHaveLength(1)

    const headingElement = screen.getByTestId("stHeading")
    expect(headingElement).toHaveClass("stHeading")
  })

  it("renders properly without a new line", () => {
    const props = getHeadingProps({ body: "hello" })
    render(<Heading {...props} />)

    expect(screen.getByRole("heading")).toHaveTextContent("hello")
    expect(screen.getAllByTestId("stMarkdownContainer")).toHaveLength(1)
  })

  it("renders anchor link", () => {
    const props = getHeadingProps({ body: "hello" })
    render(<Heading {...props} />)

    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "#some-anchor")
    expect(link).toHaveAccessibleName("Link to heading")
  })

  it("does not render anchor link when it is hidden", () => {
    const props = getHeadingProps({ body: "hello", hideAnchor: true })
    render(<Heading {...props} />)

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("does not render anchor link in sidebar", () => {
    const props = getHeadingProps()
    render(
      <IsSidebarContext.Provider value={true}>
        <Heading {...props} />
      </IsSidebarContext.Provider>
    )
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("does not render anchor link in dialog", () => {
    const props = getHeadingProps()
    render(
      <IsDialogContext.Provider value={true}>
        <Heading {...props} />
      </IsDialogContext.Provider>
    )
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("renders properly with help text", () => {
    const props = getHeadingProps({ body: "hello", help: "help text" })
    render(<Heading {...props} />)

    expect(screen.getByRole("heading")).toHaveTextContent("hello")
    expect(screen.getAllByTestId("stMarkdownContainer")).toHaveLength(1)

    const tooltip = screen.getByTestId("stTooltipIcon")
    expect(tooltip).toBeInTheDocument()
  })

  it("renders properly with help text in sidebar", () => {
    const props = getHeadingProps({ body: "hello", help: "help text" })
    render(
      <IsSidebarContext.Provider value={true}>
        <Heading {...props} />
      </IsSidebarContext.Provider>
    )

    expect(screen.getByRole("heading")).toHaveTextContent("hello")
    expect(screen.getAllByTestId("stMarkdownContainer")).toHaveLength(1)

    const tooltip = screen.getByTestId("stTooltipIcon")
    expect(tooltip).toBeInTheDocument()
  })

  it("renders properly with help text in dialog", () => {
    const props = getHeadingProps({ body: "hello", help: "help text" })
    render(
      <IsDialogContext.Provider value={true}>
        <Heading {...props} />
      </IsDialogContext.Provider>
    )

    expect(screen.getByRole("heading")).toHaveTextContent("hello")
    expect(screen.getAllByTestId("stMarkdownContainer")).toHaveLength(1)

    const tooltip = screen.getByTestId("stTooltipIcon")
    expect(tooltip).toBeInTheDocument()
  })

  it("does not render ol block", () => {
    const props = getHeadingProps({ body: "1) hello" })
    render(<Heading {...props} />)

    expect(screen.getByRole("heading")).toHaveTextContent("1) hello")
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("does not render ul block", () => {
    const props = getHeadingProps({ body: "* hello" })
    render(<Heading {...props} />)

    expect(screen.getByRole("heading")).toHaveTextContent("* hello")
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("does not render blockquote with >", () => {
    const props = getHeadingProps({ body: ">hello" })
    render(<Heading {...props} />)

    expect(screen.getByRole("heading")).toHaveTextContent(">hello")
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument()
  })

  it("does not render tables", async () => {
    const props = getHeadingProps({
      body: `| Syntax | Description |
           | ----------- | ----------- |
           | Header      | Title       |
           | Paragraph   | Text        |`,
    })
    render(<Heading {...props} />)

    expect(screen.getByRole("heading")).toHaveTextContent(
      `| Syntax | Description |`
    )

    // Wait for lazy-loaded content to render
    await waitFor(() => {
      expect(screen.getByTestId("stMarkdownContainer")).toHaveTextContent(
        "| Syntax | Description | | ----------- | ----------- | | Header | Title | | Paragraph | Text |"
      )
    })

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("stMarkdownContainer")).toHaveLength(1)
  })

  it("renders no divider by default", () => {
    const props = getHeadingProps()
    render(<Heading {...props} />)

    expect(screen.queryByTestId("stHeadingDivider")).not.toBeInTheDocument()
  })

  it("renders a divider with given color", () => {
    // correct divider color mapping handled in Block.tsx
    const props = getHeadingProps({ divider: "#0068c9" })
    render(<Heading {...props} />)

    const divider = screen.getByTestId("stHeadingDivider")
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveStyle("background-color: #0068c9")
  })

  it("removes heading padding in horizontal layout", () => {
    const props = getHeadingProps({ body: "hello", tag: "h1" })
    const horizontalContext: IFlexContext = {
      direction: Direction.HORIZONTAL,
      isInHorizontalLayout: true,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    render(
      <FlexContext.Provider value={horizontalContext}>
        <Heading {...props} />
      </FlexContext.Provider>
    )

    const markdownContainer = screen.getByTestId("stMarkdownContainer")
    expect(markdownContainer).toHaveStyle({ "margin-bottom": "" })

    const heading = screen.getByRole("heading")
    expect(heading).toHaveStyle({ padding: "0" })
  })

  it("keeps heading padding in vertical layout", () => {
    const props = getHeadingProps({ body: "hello", tag: "h1" })
    const verticalContext: IFlexContext = {
      direction: Direction.VERTICAL,
      isInHorizontalLayout: false,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    render(
      <FlexContext.Provider value={verticalContext}>
        <Heading {...props} />
      </FlexContext.Provider>
    )

    const heading = screen.getByRole("heading")
    expect(heading).not.toHaveStyle({ padding: "0" })
  })
})

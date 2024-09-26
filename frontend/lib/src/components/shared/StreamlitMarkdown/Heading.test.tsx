/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"
import "@testing-library/jest-dom"

import { screen } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"
import { Heading as HeadingProto } from "@streamlit/lib/src/proto"
import IsDialogContext from "@streamlit/lib/src/components/core/IsDialogContext"
import IsSidebarContext from "@streamlit/lib/src/components/core/IsSidebarContext"

import Heading, { HeadingProtoProps } from "./Heading"

const getHeadingProps = (
  elementProps: Partial<HeadingProto> = {}
): HeadingProtoProps => ({
  width: 300,
  element: HeadingProto.create({
    anchor: "some-anchor",
    tag: "h1",
    body: `hello world
             this is a new line`,
    ...elementProps,
  }),
})

describe("Heading", () => {
  it("renders properly after a new line", () => {
    const props = getHeadingProps()
    render(<Heading {...props} />)

    const heading = screen.getByRole("heading")
    expect(heading).toHaveTextContent("hello world")
    expect(heading).not.toHaveTextContent("this is a new line")
    expect(screen.getByText("this is a new line")).toBeInTheDocument()
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

    // trying to trigger the :hover css state did not work, so using 'hidden: true' here. We have an e2e test to check the hovering.
    const link = screen.getByRole("link", { hidden: true })
    expect(link).toHaveAttribute("href", "#some-anchor")
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

  it("does not render tables", () => {
    const props = getHeadingProps({
      body: `| Syntax | Description |
           | ----------- | ----------- |
           | Header      | Title       |
           | Paragraph   | Text        |`,
    })
    render(<Heading {...props} />)

    expect(screen.getByTestId("stMarkdownContainer")).toHaveTextContent(
      "| Syntax | Description || ----------- | ----------- | | Header | Title | | Paragraph | Text |"
    )
    expect(screen.getByRole("heading")).toHaveTextContent(
      `| Syntax | Description |`
    )
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
})

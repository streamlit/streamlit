/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { Markdown as MarkdownProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"

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
})

describe("Markdown badge with help", () => {
  it("renders a markdown badge and displays a tooltip when help is provided", async () => {
    const user = userEvent.setup()
    const element = MarkdownProto.create({
      body: ":blue-badge[Testing Badge]",
      help: "Tooltip text",
      elementType: MarkdownProto.Type.NATIVE,
      isCaption: false,
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
      isCaption: false,
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
      isCaption: false,
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
      isCaption: false,
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
      isCaption: false,
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
      isCaption: false,
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

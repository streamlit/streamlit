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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { Text as TextProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"

import TextElement, { TextProps } from "./TextElement"

const getProps = (elementProps: Partial<TextProto> = {}): TextProps => ({
  element: TextProto.create({
    body: "some plain text",
    ...elementProps,
  }),
})

describe("TextElement element", () => {
  it("renders preformatted text as expected", () => {
    const props = getProps()
    render(<TextElement {...props} />)

    const textElement = screen.getByTestId("stText")
    expect(textElement).toBeInTheDocument()
    expect(screen.getByText("some plain text")).toBeInTheDocument()
    expect(textElement).toHaveClass("stText")
  })

  it("renders text with help tooltip", async () => {
    const props = getProps({ help: "help text" })
    render(<TextElement {...props} />)
    const tooltip = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltip).toBeInTheDocument()
    await userEvent.hover(tooltip)

    const helpText = await screen.findAllByText("help text")
    expect(helpText[0].textContent).toBe("help text")
  })

  it("does not truncate by default", () => {
    render(<TextElement {...getProps()} />)
    expect(screen.getByText("some plain text")).not.toHaveStyle({
      "text-overflow": "ellipsis",
    })
    expect(screen.queryByTitle("some plain text")).not.toBeInTheDocument()
  })

  it("preserves whitespace sequences by default", () => {
    render(<TextElement {...getProps({ body: "Lorem    ipsum\tdolor" })} />)
    const text = screen.getByTestId("stText").querySelector("span")
    expect(text?.textContent).toBe("Lorem    ipsum\tdolor")
    expect(text).toHaveStyle({ "white-space-collapse": "preserve" })
  })

  it("truncates and exposes the full text via a native title when wrap is false", async () => {
    render(<TextElement {...getProps({ wrap: false })} />)
    const body = await screen.findByTitle("some plain text")
    expect(body).toHaveStyle({
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "white-space-collapse": "preserve",
    })
    expect(body).toBeVisible()
  })

  it("sets a native title when wrap is false, including when help is set", async () => {
    render(<TextElement {...getProps({ wrap: false, help: "help text" })} />)
    expect(screen.getByTestId("stTooltipHoverTarget")).toBeVisible()
    expect(await screen.findByTitle("some plain text")).toBeVisible()
    expect(
      screen.getByTestId("stTooltipHoverTarget").closest("[title]")
    ).toBeNull()
  })

  it("collapses newlines when wrap is false so the body stays one line", async () => {
    render(
      <TextElement
        {...getProps({
          body: "Line one\nLine two\nLine three extra",
          wrap: false,
        })}
      />
    )
    const body = await screen.findByTitle("Line one Line two Line three extra")
    expect(body.textContent).not.toContain("\n")
    expect(body).toHaveStyle({
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    })
    expect(body).toBeVisible()
  })
})

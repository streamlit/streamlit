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
})

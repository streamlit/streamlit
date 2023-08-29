/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import "@testing-library/jest-dom"
import { render } from "@streamlit/lib/src/test_util"

import { LinkButton as LinkButtonProto } from "@streamlit/lib/src/proto"
import LinkButton, { Props } from "./LinkButton"

const getProps = (
  elementProps: Partial<LinkButtonProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: LinkButtonProto.create({
    label: "Label",
    url: "https://streamlit.io",
    ...elementProps,
  }),
  width: 250,
  disabled: false,
  ...widgetProps,
})

describe("LinkButton widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<LinkButton {...props} />)

    const linkButton = screen.getByRole("link")
    expect(linkButton).toBeInTheDocument()
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<LinkButton {...props} />)

    const linkButton = screen.getByTestId("stLinkButton")

    expect(linkButton).toHaveClass("row-widget")
    expect(linkButton).toHaveClass("stLinkButton")
    expect(linkButton).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label within the button", () => {
    const props = getProps()
    render(<LinkButton {...props} />)

    const linkButton = screen.getByRole("link", {
      name: `${props.element.label}`,
    })

    expect(linkButton).toBeInTheDocument()
  })

  describe("wrapped BaseLinkButton", () => {
    it("handles the disabled prop", () => {
      const props = getProps({}, { disabled: true })
      render(<LinkButton {...props} />)

      const linkButton = screen.getByRole("link")
      expect(linkButton).toHaveAttribute("disabled")
    })

    it("does not use container width by default", () => {
      const props = getProps()
      render(<LinkButton {...props}>Hello</LinkButton>)

      const linkButton = screen.getByRole("link")
      expect(linkButton).toHaveStyle("width: auto")
    })

    it("passes useContainerWidth property with help correctly", () => {
      render(
        <LinkButton
          {...getProps({ useContainerWidth: true, help: "mockHelpText" })}
        >
          Hello
        </LinkButton>
      )

      const linkButton = screen.getByRole("link")
      expect(linkButton).toHaveStyle(`width: ${250}px`)
    })

    it("passes useContainerWidth property without help correctly", () => {
      render(
        <LinkButton {...getProps({ useContainerWidth: true })}>
          Hello
        </LinkButton>
      )

      const linkButton = screen.getByRole("link")
      expect(linkButton).toHaveStyle("width: 100%")
    })
  })
})

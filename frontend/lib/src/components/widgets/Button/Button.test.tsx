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

import { fireEvent, screen } from "@testing-library/react"

import "@testing-library/jest-dom"
import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { Button as ButtonProto } from "@streamlit/lib/src/proto"

import Button, { Props } from "./Button"

jest.mock("@streamlit/lib/src/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (
  elementProps: Partial<ButtonProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: ButtonProto.create({
    id: "1",
    label: "Label",
    ...elementProps,
  }),
  width: 250,
  disabled: false,
  // @ts-expect-error
  widgetMgr: new WidgetStateManager(sendBackMsg),
  ...widgetProps,
})

describe("Button widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<Button {...props} />)

    const buttonWidget = screen.getByRole("button")
    expect(buttonWidget).toBeInTheDocument()
  })

  it("should have correct className and style", () => {
    const props = getProps()
    render(<Button {...props} />)

    const stButtonDiv = screen.getByTestId("stButton")

    expect(stButtonDiv).toHaveClass("stButton")
    expect(stButtonDiv).toHaveStyle(`width: ${props.width}px`)
  })

  it("should render a label within the button", () => {
    const props = getProps()
    render(<Button {...props} />)

    const buttonWidget = screen.getByRole("button", {
      name: `${props.element.label}`,
    })

    expect(buttonWidget).toBeInTheDocument()
  })

  describe("BaseButton props should work", () => {
    it("onClick prop", () => {
      const props = getProps()
      render(<Button {...props} />)

      const buttonWidget = screen.getByRole("button")
      fireEvent.click(buttonWidget)

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true },
        undefined
      )
    })

    it("passes fragmentId to onClick prop", () => {
      const props = getProps(undefined, {
        fragmentId: "myFragmentId",
      })
      render(<Button {...props} />)

      const buttonWidget = screen.getByRole("button")
      fireEvent.click(buttonWidget)

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true },
        "myFragmentId"
      )
    })

    it("can be disabled", () => {
      const props = getProps({}, { disabled: true })
      render(<Button {...props} />)

      const buttonWidget = screen.getByRole("button")

      expect(buttonWidget).toBeDisabled()
    })
  })

  it("does not use container width by default", () => {
    render(<Button {...getProps()}>Hello</Button>)

    const buttonWidget = screen.getByRole("button")
    expect(buttonWidget).toHaveStyle("width: auto")
  })

  it("passes useContainerWidth property without help correctly", () => {
    render(<Button {...getProps({ useContainerWidth: true })}>Hello</Button>)

    const buttonWidget = screen.getByRole("button")
    expect(buttonWidget).toHaveStyle("width: 100%")
  })

  it("passes useContainerWidth property with help correctly", () => {
    render(
      <Button {...getProps({ useContainerWidth: true, help: "mockHelpText" })}>
        Hello
      </Button>
    )

    const buttonWidget = screen.getByRole("button")
    expect(buttonWidget).toHaveStyle(`width: ${250}px`)
  })

  it("renders an emoji icon if provided", () => {
    render(<Button {...getProps({ icon: "😀" })} />)

    const icon = screen.getByTestId("stIconEmoji")
    expect(icon).toHaveTextContent("😀")
  })

  it("renders a material icon if provided", () => {
    render(<Button {...getProps({ icon: ":material/thumb_up:" })} />)

    const icon = screen.getByTestId("stIconMaterial")
    expect(icon).toHaveTextContent("thumb_up")
  })

  it("renders an icon with no margin, if there is no label", () => {
    render(<Button {...getProps({ label: "", icon: "😀" })} />)

    expect(screen.getByTestId("stIconEmoji")).toHaveStyle("margin: 0")
  })
})

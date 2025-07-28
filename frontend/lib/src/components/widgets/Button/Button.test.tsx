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

import { Button as ButtonProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Button, { Props } from "./Button"

vi.mock("~lib/WidgetStateManager")

const sendBackMsg = vi.fn()

const getProps = (
  elementProps: Partial<ButtonProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: ButtonProto.create({
    id: "1",
    label: "Label",
    ...elementProps,
  }),
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
    it("onClick prop", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<Button {...props} />)

      const buttonWidget = screen.getByRole("button")
      await user.click(buttonWidget)

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true },
        undefined
      )
    })

    it("passes fragmentId to onClick prop", async () => {
      const user = userEvent.setup()
      const props = getProps(undefined, {
        fragmentId: "myFragmentId",
      })
      render(<Button {...props} />)

      const buttonWidget = screen.getByRole("button")
      await user.click(buttonWidget)

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

  it("renders with help properly", async () => {
    const user = userEvent.setup()
    // Hover to see tooltip content
    render(<Button {...getProps({ help: "mockHelpText" })} />)

    // Ensure both the button and the tooltip target have the correct width.
    // These will be 100% and the ElementContainer will have styles to determine
    // the button width.
    const buttonWidget = screen.getByRole("button")
    expect(buttonWidget).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  it("passes useContainerWidth property without help correctly", () => {
    render(<Button {...getProps({ useContainerWidth: true })}>Hello</Button>)

    const buttonWidget = screen.getByRole("button")
    expect(buttonWidget).toHaveStyle("width: 100%")
  })
})

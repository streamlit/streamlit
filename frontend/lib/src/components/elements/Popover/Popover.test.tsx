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

import { Block as BlockProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"

import Popover, { PopoverProps } from "./Popover"

const getProps = (
  elementProps: Partial<BlockProto.Popover> = {},
  props: Partial<PopoverProps> = {}
): PopoverProps => ({
  element: BlockProto.Popover.create({
    label: "label",
    disabled: false,
    help: "",
    ...elementProps,
  }),
  empty: false,
  stretchWidth: false,
  ...props,
})

describe("Popover container", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(
      <Popover {...props}>
        <div>test</div>
      </Popover>
    )
    const popoverButton = screen.getByTestId("stPopover")
    expect(popoverButton).toBeInTheDocument()
    expect(popoverButton).toHaveClass("stPopover")
  })

  it("renders label on the popover", () => {
    const props = getProps()
    render(
      <Popover {...props}>
        <div>test</div>
      </Popover>
    )

    const popover = screen.getByRole("button", {
      name: `${props.element.label}`,
    })
    expect(popover).toBeInTheDocument()
  })

  it("should render the text when opened", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(
      <Popover {...props}>
        <div>test</div>
      </Popover>
    )

    await user.click(screen.getByText("label"))
    // Text should be visible now
    expect(screen.queryByText("test")).toBeVisible()
  })

  it("should render correctly with width=stretch and help", async () => {
    const user = userEvent.setup()
    // Hover to see tooltip content
    render(
      <Popover
        {...getProps({ help: "mockHelpText" }, { stretchWidth: true })}
      />
    )

    // Ensure both the button and the tooltip target have the correct width
    const popoverButtonWidget = screen.getByRole("button")
    expect(popoverButtonWidget).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  it("should render correctly with help", async () => {
    const user = userEvent.setup()
    // Hover to see tooltip content
    render(
      <Popover
        {...getProps({ help: "mockHelpText", useContainerWidth: false })}
      />
    )

    // Ensure both the button and the tooltip target have the correct width
    const popoverButtonWidget = screen.getByRole("button")
    // The button should stretch to the container and width will
    // be set on the Element Container.
    expect(popoverButtonWidget).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  it("passes width=stretch property without help correctly", () => {
    render(<Popover {...getProps({}, { stretchWidth: true })} />)

    const popoverButtonWidget = screen.getByRole("button")
    expect(popoverButtonWidget).toHaveStyle("width: 100%")
  })
})

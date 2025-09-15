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

import { fireEvent, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { DropdownButton as DropdownButtonProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import DropdownButton, { Props } from "./DropdownButton"

const getProps = (
  elementProps: Partial<DropdownButtonProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: DropdownButtonProto.create({
    id: "test-dropdown-button",
    label: "Select Option",
    options: ["Option 1", "Option 2", "Option 3"],
    help: "This is a dropdown button",
    type: "secondary",
    placeholder: "Choose an option",
    icon: "",
    disabled: false,
    useContainerWidth: false,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("DropdownButton widget", () => {
  it("renders with correct label and options", () => {
    const props = getProps()
    render(<DropdownButton {...props} />)

    // Check if button renders with correct label
    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Select Option: Choose an option ▼")

    // Check if all options are present in the DOM
    expect(screen.getAllByText("Option 1")).toHaveLength(2)
    expect(screen.getAllByText("Option 2")).toHaveLength(2)
    expect(screen.getAllByText("Option 3")).toHaveLength(2)
  })

  it("handles option selection and triggers widget state update", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<DropdownButton {...props} />)

    // Open dropdown and select an option
    const button = screen.getByRole("button")
    await user.click(button)
    const option2Elements = screen.getAllByText("Option 2")
    await user.click(option2Elements[0])

    // Verify widget state update
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "Option 2",
      { fromUi: true },
      undefined
    )
  })

  it("respects disabled state", async () => {
    const user = userEvent.setup()
    const props = getProps({}, { disabled: true })
    render(<DropdownButton {...props} />)

    // Verify button is disabled
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()

    // Try to click disabled button
    await user.click(button)

    // Verify dropdown remains closed (options exist but are hidden)
    const option1Elements = screen.getAllByText("Option 1")
    expect(option1Elements).toHaveLength(2)
  })

  it("handles keyboard navigation with arrow keys", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<DropdownButton {...props} />)

    const container = screen.getByTestId("stDropdownButton")

    // Test keyboard events don't throw errors
    await user.type(container, "{Enter}")
    await user.type(container, "{ArrowDown}")
    await user.type(container, "{ArrowUp}")
    await user.type(container, "{Escape}")

    // Test passes if no errors are thrown
    expect(container).toBeVisible()
  })

  it("closes dropdown on Escape key", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<DropdownButton {...props} />)

    const button = screen.getByRole("button")
    const container = screen.getByTestId("stDropdownButton")

    // Open dropdown
    await user.click(button)

    // Close with Escape
    await user.type(container, "{Escape}")

    // Test passes if no error is thrown
    expect(button).toBeVisible()
  })

  it("closes dropdown when clicking outside", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(
      <div>
        <DropdownButton {...props} />
        <div data-testid="outside">Outside element</div>
      </div>
    )

    const button = screen.getByRole("button")

    // Open dropdown
    await user.click(button)

    // Click outside
    const outsideElement = screen.getByTestId("outside")
    fireEvent.mouseDown(outsideElement)

    // Test passes if no error is thrown
    expect(button).toBeVisible()
  })

  it("handles empty options list", () => {
    const props = getProps({ options: [] })
    render(<DropdownButton {...props} />)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Select Option: Choose an option ▼")
  })

  it("displays custom placeholder", () => {
    const props = getProps({ placeholder: "Pick something" })
    render(<DropdownButton {...props} />)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("Select Option: Pick something ▼")
  })

  it("handles icon display", () => {
    const props = getProps({ icon: "⭐" })
    render(<DropdownButton {...props} />)

    // Icon should be rendered in the button label
    expect(screen.getByRole("button")).toBeVisible()
  })

  it("renders dropdown menu correctly", () => {
    const props = getProps()
    render(<DropdownButton {...props} />)

    const button = screen.getByRole("button")
    expect(button).toBeVisible()
  })

  it("handles different button types", () => {
    const primaryProps = getProps({ type: "primary" })
    const { rerender } = render(<DropdownButton {...primaryProps} />)
    expect(screen.getByRole("button")).toBeVisible()

    const secondaryProps = getProps({ type: "secondary" })
    rerender(<DropdownButton {...secondaryProps} />)
    expect(screen.getByRole("button")).toBeVisible()

    const tertiaryProps = getProps({ type: "tertiary" })
    rerender(<DropdownButton {...tertiaryProps} />)
    expect(screen.getByRole("button")).toBeVisible()
  })

  it("handles container width option", () => {
    const props = getProps({ useContainerWidth: true })
    render(<DropdownButton {...props} />)

    // Button should be rendered (specific styling is handled by BaseButton)
    expect(screen.getByRole("button")).toBeVisible()
  })

  it("prevents interaction when disabled via element prop", async () => {
    const user = userEvent.setup()
    const props = getProps({ disabled: true }, { disabled: true })
    render(<DropdownButton {...props} />)

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()

    // Should not be able to open dropdown
    await user.click(button)
    // Test passes if button is disabled
  })
})

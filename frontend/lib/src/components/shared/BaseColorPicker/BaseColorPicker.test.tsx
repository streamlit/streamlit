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

import { render } from "~lib/test_util"
import { LabelVisibilityOptions } from "~lib/util/utils"

import BaseColorPicker, { BaseColorPickerProps } from "./BaseColorPicker"

const getProps = (
  props: Partial<BaseColorPickerProps> = {}
): BaseColorPickerProps => ({
  label: "Label",
  value: "#000000",
  width: 0,
  disabled: false,
  onChange: vi.fn(),
  ...props,
})

describe("ColorPicker widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<BaseColorPicker {...props} />)

    const colorPicker = screen.getByTestId("stColorPicker")
    expect(colorPicker).toBeInTheDocument()
    expect(colorPicker).toHaveClass("stColorPicker")
  })

  it("should render a label in the title", () => {
    const props = getProps()
    render(<BaseColorPicker {...props} />)
    expect(screen.getByText(props.label)).toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    render(<BaseColorPicker {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    render(<BaseColorPicker {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("renders trigger as a button with correct aria attributes", () => {
    const props = getProps()
    render(<BaseColorPicker {...props} />)

    const trigger = screen.getByRole("button", { name: /label color picker/i })
    expect(trigger).toBeVisible()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
  })

  it("popover is not shown before trigger is clicked", () => {
    render(<BaseColorPicker {...getProps()} />)
    expect(
      screen.queryByTestId("stColorPickerPopover")
    ).not.toBeInTheDocument()
  })

  it("opens popover when trigger is clicked", async () => {
    const user = userEvent.setup()
    render(<BaseColorPicker {...getProps()} />)

    await user.click(
      screen.getByRole("button", { name: /label color picker/i })
    )

    expect(screen.getByTestId("stColorPickerPopover")).toBeVisible()
    expect(
      screen.getByRole("button", { name: /label color picker/i })
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("closes popover and calls onChange when trigger is clicked again", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BaseColorPicker {...getProps({ onChange })} />)

    const trigger = screen.getByRole("button", { name: /label color picker/i })
    await user.click(trigger)
    expect(screen.getByTestId("stColorPickerPopover")).toBeVisible()

    await user.click(trigger)
    expect(
      screen.queryByTestId("stColorPickerPopover")
    ).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith("#000000")
  })

  it("closes popover and calls onChange on outside click", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <div>
        <BaseColorPicker {...getProps({ onChange })} />
        <button>outside</button>
      </div>
    )

    await user.click(
      screen.getByRole("button", { name: /label color picker/i })
    )
    expect(screen.getByTestId("stColorPickerPopover")).toBeVisible()

    // Advance Date.now() past the 50ms timestamp guard used to prevent the
    // same click that opens the popover from immediately closing it.
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 100)
    await user.click(screen.getByRole("button", { name: "outside" }))
    nowSpy.mockRestore()

    expect(
      screen.queryByTestId("stColorPickerPopover")
    ).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith("#000000")
  })

  it("closes popover and calls onChange on Tab key", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BaseColorPicker {...getProps({ onChange })} />)

    await user.click(
      screen.getByRole("button", { name: /label color picker/i })
    )
    expect(screen.getByTestId("stColorPickerPopover")).toBeVisible()

    // Simulate the realistic flow: user focuses an input inside the picker
    // (e.g. the hex field), then Tabs away. We click the hex input explicitly
    // because FloatingFocusManager's initial autofocus uses requestAnimationFrame,
    // which JSDOM does not run, so focus stays on the trigger after the click.
    const hexInput = screen.getByRole("textbox")
    await user.click(hexInput)

    await user.keyboard("{Tab}")
    expect(
      screen.queryByTestId("stColorPickerPopover")
    ).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith("#000000")
  })

  it("closes popover and calls onChange on Escape key", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BaseColorPicker {...getProps({ onChange })} />)

    await user.click(
      screen.getByRole("button", { name: /label color picker/i })
    )
    expect(screen.getByTestId("stColorPickerPopover")).toBeVisible()

    await user.keyboard("{Escape}")
    expect(
      screen.queryByTestId("stColorPickerPopover")
    ).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith("#000000")
  })

  it("should render a default color in the preview and the color picker", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<BaseColorPicker {...props} />)

    const colorBlock = screen.getByTestId("stColorPickerBlock")
    await user.click(colorBlock)

    expect(colorBlock).toHaveStyle("background-color: #000000")

    const colorInput = screen.getByRole("textbox")
    expect(colorInput).toHaveValue("#000000")
  })

  it("supports hex shorthand", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<BaseColorPicker {...props} />)

    const colorBlock = screen.getByTestId("stColorPickerBlock")
    await user.click(colorBlock)

    const colorInput = screen.getByRole("textbox")

    // Change the color to hex shorthand
    await user.clear(colorInput)
    await user.type(colorInput, "#333")

    // Remove focus from the color input field
    await user.click(document.body)

    expect(colorInput).toHaveValue("#333333")
    expect(colorBlock).toHaveStyle("background-color: #333333")
  })

  it("should update the widget value when it's changed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<BaseColorPicker {...props} />)

    const newColor = "#E91E63"
    const colorBlock = screen.getByTestId("stColorPickerBlock")
    await user.click(colorBlock)

    const colorInput = screen.getByRole("textbox")
    await user.clear(colorInput)
    await user.type(colorInput, newColor)

    expect(colorInput).toHaveValue(newColor)
    expect(colorBlock).toHaveStyle(`background-color: ${newColor}`)
  })

  describe("ColorPicker widget with optional params", () => {
    it("renders with showValue", () => {
      const props = getProps({ showValue: true })
      render(<BaseColorPicker {...props} />)
      expect(screen.getByText("#000000")).toBeVisible()
    })

    it("renders without showValue", () => {
      const props = getProps()
      render(<BaseColorPicker {...props} />)
      const colorLabel = screen.queryByText("#000000")
      expect(colorLabel).not.toBeInTheDocument()
    })

    it("should render TooltipIcon if help text provided", () => {
      const props = getProps({ help: "help text" })
      render(<BaseColorPicker {...props} />)
      const tooltipIcon = screen.getByTestId("stTooltipIcon")
      expect(tooltipIcon).toBeInTheDocument()
    })

    it("does not open popover when disabled", async () => {
      const user = userEvent.setup()
      render(<BaseColorPicker {...getProps({ disabled: true })} />)

      const trigger = screen.getByRole("button", {
        name: /label color picker/i,
      })
      await user.click(trigger)
      expect(
        screen.queryByTestId("stColorPickerPopover")
      ).not.toBeInTheDocument()
    })
  })
})

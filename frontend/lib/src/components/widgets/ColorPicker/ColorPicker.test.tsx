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

import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { ColorPicker as ColorPickerProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ColorPicker, { Props } from "./ColorPicker"

const getProps = (
  elementProps: Partial<ColorPickerProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: ColorPickerProto.create({
    id: "1",
    label: "Label",
    default: "#000000",
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("ColorPicker widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<ColorPicker {...props} />)
    const colorPicker = screen.getByTestId("stColorPicker")
    expect(colorPicker).toBeInTheDocument()
    expect(colorPicker).toHaveClass("stColorPicker")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<ColorPicker {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<ColorPicker {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("renders a default color in the preview and the color picker", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ColorPicker {...props} />)

    const colorBlock = screen.getByTestId("stColorPickerBlock")
    await user.click(colorBlock)
    expect(colorBlock).toHaveStyle("background-color: #000000")

    const colorInput = screen.getByRole("textbox")
    expect(colorInput).toHaveValue("#000000")
  })

  it("updates its widget value when it's changed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<ColorPicker {...props} />)

    // Open the color picker
    const colorBlock = screen.getByTestId("stColorPickerBlock")
    await user.click(colorBlock)

    // Clear the color input text field
    const colorInput = screen.getByRole("textbox")
    await user.tripleClick(colorInput)
    await user.keyboard("{backspace}")

    // Enter the new color in the input field
    const newColor = "#e91e63"
    await user.type(colorInput, newColor)

    // Close out of the popover
    await user.click(colorBlock)

    // And the WidgetMgr should also be updated.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      newColor,
      { fromUi: true },
      undefined
    )
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    render(<ColorPicker {...props} />)

    // Open the color picker
    const colorBlock = screen.getByTestId("stColorPickerBlock")
    await user.click(colorBlock)

    // Clear the color input text field
    const colorInput = screen.getByRole("textbox")
    await user.tripleClick(colorInput)
    await user.keyboard("{backspace}")

    // Enter the new color in the input field
    const newColor = "#e91e63"
    await user.type(colorInput, newColor)

    // Close out of the popover
    await user.click(colorBlock)

    expect(colorInput).toHaveValue(newColor.toUpperCase())
    expect(colorBlock).toHaveStyle(`background-color: ${newColor}`)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      newColor,
      { fromUi: true },
      undefined
    )

    act(() => {
      // "Submit" the form
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(colorBlock).toHaveStyle("background-color: #000000")
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      },
      undefined
    )
  })
})

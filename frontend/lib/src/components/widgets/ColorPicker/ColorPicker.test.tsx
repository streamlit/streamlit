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
import "@testing-library/jest-dom"
import { fireEvent, screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"

import { ColorPicker as ColorPickerProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"

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
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  ...widgetProps,
})

describe("ColorPicker widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<ColorPicker {...props} />)
    const colorPicker = screen.getByTestId("stColorPicker")
    expect(colorPicker).toBeInTheDocument()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")

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
    jest.spyOn(props.widgetMgr, "setStringValue")

    render(<ColorPicker {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("renders a default color in the preview and the color picker", () => {
    const props = getProps()
    render(<ColorPicker {...props} />)

    const colorBlock = screen.getByTestId("stColorBlock")
    fireEvent.click(colorBlock)
    expect(colorBlock).toHaveStyle("background-color: #000000")

    const colorInput = screen.getByRole("textbox")
    expect(colorInput).toHaveValue("#000000")
  })

  it("updates its widget value when it's changed", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")

    render(<ColorPicker {...props} />)

    const newColor = "#e91e63"
    const colorBlock = screen.getByTestId("stColorBlock")
    fireEvent.click(colorBlock)

    // Our widget should be updated.
    const colorInput = screen.getByRole("textbox")
    fireEvent.change(colorInput, { target: { value: newColor } })
    // Close out of the popover
    fireEvent.click(colorBlock)

    // And the WidgetMgr should also be updated.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      newColor,
      { fromUi: true },
      undefined
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    jest.spyOn(props.widgetMgr, "setStringValue")
    props.widgetMgr.setFormClearOnSubmit("form", true)

    render(<ColorPicker {...props} />)

    // Choose a new color
    const newColor = "#e91e63"
    const colorBlock = screen.getByTestId("stColorBlock")
    fireEvent.click(colorBlock)

    // Update the color
    const colorInput = screen.getByRole("textbox")
    fireEvent.change(colorInput, { target: { value: newColor } })
    // Close out of the popover
    fireEvent.click(colorBlock)

    expect(colorInput).toHaveValue(newColor)
    expect(colorBlock).toHaveStyle(`background-color: ${newColor}`)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      newColor,
      { fromUi: true },
      undefined
    )

    // "Submit" the form
    props.widgetMgr.submitForm("form", undefined)

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

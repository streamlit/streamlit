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
import "@testing-library/jest-dom"

import { screen, fireEvent } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"

import {
  TextInput as TextInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/lib/src/proto"
import TextInput, { Props } from "./TextInput"

const getProps = (
  elementProps: Partial<TextInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: TextInputProto.create({
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    type: TextInputProto.Type.DEFAULT,
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

describe("TextInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    expect(textInput).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const widgetLabel = screen.queryByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })

    render(<TextInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<TextInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("shows a placeholder", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("handles TextInputProto.Type properly", () => {
    const defaultProps = getProps({ type: TextInputProto.Type.DEFAULT })
    const { unmount } = render(<TextInput {...defaultProps} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("type", "text")
    // unmount the initial component
    unmount()

    const passwordProps = getProps({ type: TextInputProto.Type.PASSWORD })
    render(<TextInput {...passwordProps} />)
    const passwordTextInput = screen.getByTestId("textInputElement")
    expect(passwordTextInput).toHaveAttribute("type", "password")
  })

  it("handles TextInputProto.autocomplete", () => {
    let props = getProps()
    const { unmount } = render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("autoComplete", "")
    // unmount the initial component
    unmount()

    props = getProps({ autocomplete: "one-time-password" })
    render(<TextInput {...props} />)
    const autocompleteTextInput = screen.getByRole("textbox")
    expect(autocompleteTextInput).toHaveAttribute(
      "autoComplete",
      "one-time-password"
    )
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<TextInput {...props} />)
    const textInput = screen.getByTestId("stTextInput")

    expect(textInput).toHaveClass("row-widget")
    expect(textInput).toHaveClass("stTextInput")
    expect(textInput).toHaveStyle(`width: ${props.width}px`)
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toBeDisabled()
  })

  it("sets widget value on blur", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByTestId("textInputElement")
    fireEvent.change(textInput, { target: { value: "testing" } })
    fireEvent.blur(textInput)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      }
    )
  })

  // TODO: Fix this test
  // it("sets widget value when enter is pressed", () => {
  //   const props = getProps()
  //   jest.spyOn(props.widgetMgr, "setStringValue")
  //   render(<TextInput {...props} />)

  //   expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  // })

  it("doesn't set widget value when not dirty", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByTestId("textInputElement")
    fireEvent.keyPress(textInput, { key: "Enter" })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    fireEvent.blur(textInput)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("limits input length if max_chars is passed", () => {
    const props = getProps({ maxChars: 10 })
    render(<TextInput {...props} />)

    const textInput = screen.getByTestId("textInputElement")

    fireEvent.change(textInput, { target: { value: "0123456789" } })
    expect(textInput).toHaveValue("0123456789")

    fireEvent.change(textInput, { target: { value: "0123456789a" } })
    expect(textInput).toHaveValue("0123456789")
  })

  it("does not update widget value on text changes when outside of a form", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByTestId("textInputElement")
    fireEvent.change(textInput, { target: { value: "TEST" } })
    expect(textInput).toHaveValue("TEST")

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      }
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)

    const textInput = screen.getByTestId("textInputElement")
    // Change the widget value
    fireEvent.change(textInput, { target: { value: "TEST" } })

    // "Submit" the form
    props.widgetMgr.submitForm("form")

    // Our widget should be reset, and the widgetMgr should be updated
    expect(textInput).toHaveValue(props.element.default)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})

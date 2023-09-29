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
import { render, shallow } from "@streamlit/lib/src/test_util"
import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  TextArea as TextAreaProto,
} from "@streamlit/lib/src/proto"

import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import InputInstructions from "@streamlit/lib/src/components/shared/InputInstructions/InputInstructions"

import TextArea, { Props } from "./TextArea"

const getProps = (
  elementProps: Partial<TextAreaProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: TextAreaProto.create({
    id: "1",
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    ...elementProps,
  }),
  width: 300,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  ...widgetProps,
})

describe("TextArea widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toBeInTheDocument()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<TextArea {...props} />)
    const textArea = screen.getByTestId("stTextArea")

    expect(textArea).toHaveClass("stTextArea")
    expect(textArea).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const widgetLabel = screen.queryByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<TextArea {...props} />)
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
    render(<TextArea {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("has a default value", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveValue(props.element.default)
  })

  it("renders a placeholder", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toBeDisabled()
  })

  it("sets widget value on blur", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    fireEvent.change(textArea, { target: { value: "testing" } })
    fireEvent.blur(textArea)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      }
    )
  })

  it("sets widget value when ctrl+enter is pressed", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")

    fireEvent.change(textArea, { target: { value: "testing" } })
    fireEvent.keyDown(textArea, { ctrlKey: true, key: "Enter" })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      }
    )
  })

  it("limits the length if max_chars is passed", () => {
    const props = getProps({
      height: 500,
      maxChars: 10,
    })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")

    fireEvent.change(textArea, { target: { value: "0123456789" } })
    expect(textArea).toHaveValue("0123456789")

    fireEvent.change(textArea, { target: { value: "0123456789a" } })
    expect(textArea).toHaveValue("0123456789")
  })

  it("does not update widget value on text changes when outside of a form", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    fireEvent.change(textArea, { target: { value: "TEST" } })

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      }
    )
  })

  it("hides Please enter to apply text when width is smaller than 180px", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} width={100} />)

    wrapper.setState({ dirty: true })

    expect(wrapper.find(InputInstructions).exists()).toBe(false)
  })

  it("shows Please enter to apply text when width is bigger than 180px", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} width={190} />)

    wrapper.setState({ dirty: true })

    expect(wrapper.find(InputInstructions).exists()).toBe(true)
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)

    // Change the widget value
    const textArea = screen.getByRole("textbox")
    fireEvent.change(textArea, { target: { value: "TEST" } })
    expect(textArea).toHaveValue("TEST")

    // "Submit" the form
    props.widgetMgr.submitForm("form")

    // Our widget should be reset, and the widgetMgr should be updated
    expect(textArea).toHaveValue(props.element.default)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })

  describe("on mac", () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
    })

    it("sets widget value when ⌘+enter is pressed", () => {
      const props = getProps()
      jest.spyOn(props.widgetMgr, "setStringValue")
      render(<TextArea {...props} />)
      const textArea = screen.getByRole("textbox")
      fireEvent.change(textArea, { target: { value: "testing" } })
      fireEvent.keyDown(textArea, { metaKey: true, key: "Enter" })

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "testing",
        {
          fromUi: true,
        }
      )
    })
  })
})

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
import { render } from "@streamlit/lib/src/test_util"
import { screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { Radio as RadioProto } from "@streamlit/lib/src/proto"
import Radio, { Props } from "./Radio"

const getProps = (
  elementProps: Partial<RadioProto> = {},
  otherProps: Partial<Props> = {}
): Props => ({
  element: RadioProto.create({
    id: "1",
    label: "Label",
    default: 0,
    options: ["a", "b", "c"],
    captions: [],
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  ...otherProps,
})

describe("Radio widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioGroup = screen.getByRole("radiogroup")
    const radioOptions = screen.getAllByRole("radio")

    expect(radioGroup).toBeInTheDocument()
    expect(radioOptions).toHaveLength(3)
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")
    render(<Radio {...props} />)

    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioElement = screen.getByTestId("stRadio")

    expect(radioElement).toHaveClass("row-widget")
    expect(radioElement).toHaveClass("stRadio")
    expect(radioElement).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const widgetLabel = screen.queryByText(`${props.element.label}`)

    expect(widgetLabel).toBeInTheDocument()
  })

  it("has a default value", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")
    expect(radioOptions).toHaveLength(3)

    // @ts-expect-error
    const checked = radioOptions[props.element.default]
    expect(checked).toBeChecked()
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")

    radioOptions.forEach(option => {
      expect(option).toBeDisabled()
    })
  })

  it("has the correct options", () => {
    const props = getProps()
    render(<Radio {...props} />)

    props.element.options.forEach(option => {
      expect(screen.getByText(option)).toBeInTheDocument()
    })
  })

  it("renders no captions when none passed", () => {
    const props = getProps()
    render(<Radio {...props} />)

    expect(screen.queryAllByTestId("stCaptionContainer")).toHaveLength(0)
  })

  it("has the correct captions", () => {
    const props = getProps({ captions: ["caption1", "caption2", "caption3"] })
    render(<Radio {...props} />)

    expect(screen.getAllByTestId("stCaptionContainer")).toHaveLength(3)
    props.element.options.forEach(option => {
      expect(screen.getByText(option)).toBeInTheDocument()
    })
  })

  it("renders non-blank captions", () => {
    const props = getProps({ captions: ["caption1", "", ""] })
    render(<Radio {...props} />)

    expect(screen.getAllByTestId("stCaptionContainer")).toHaveLength(3)
    expect(screen.getByText("caption1")).toBeInTheDocument()
  })

  it("shows a message when there are no options to be shown", () => {
    const props = getProps({ options: [] })
    render(<Radio {...props} />)

    const radioOptions = screen.getAllByRole("radio")
    const noOptionLabel = screen.getByText("No options to select.")

    expect(radioOptions).toHaveLength(1)
    expect(noOptionLabel).toBeInTheDocument()
  })

  it("sets the widget value when an option is selected", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")
    const secondOption = radioOptions[1]

    fireEvent.click(secondOption)

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )
    expect(secondOption).toBeChecked()
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")
    render(<Radio {...props} />)

    const radioOptions = screen.getAllByRole("radio")
    const secondOption = radioOptions[1]

    // Change the widget value
    fireEvent.click(secondOption)
    expect(secondOption).toBeChecked()

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )

    // "Submit" the form
    props.widgetMgr.submitForm("form")

    // Our widget should be reset, and the widgetMgr should be updated
    // @ts-expect-error
    const defaultValue = radioOptions[props.element.default]
    expect(defaultValue).toBeChecked()

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})

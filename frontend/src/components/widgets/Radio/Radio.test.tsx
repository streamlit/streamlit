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
import { fireEvent } from "@testing-library/react"
import { act } from "react-dom/test-utils"
import { render } from "src/lib/test_util"

import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { Radio as RadioProto, LabelVisibilityMessage } from "src/autogen/proto"
import { lightTheme } from "src/theme"
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
    ...elementProps,
  }),
  theme: lightTheme.emotion,
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
    const wrapper = render(<Radio {...props} />)
    const radioGroup = wrapper.baseElement.querySelectorAll("#RadioGroup")
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")

    expect(radioGroup).toHaveLength(1)
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
    const wrapper = render(<Radio {...props} />)
    const wrappedDiv = wrapper.baseElement.querySelector(".stRadio")

    expect(wrappedDiv).toHaveClass("row-widget")
    expect(wrappedDiv).toHaveStyle(`width: ${props.width}`)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    expect(wrapper.getByText(`${props.element.label}`)).toBeInTheDocument()
  })

  it("renders properly if no label is provided", () => {
    const props = getProps({ label: undefined })
    const wrapper = render(<Radio {...props} />)
    const radioGroup = wrapper.baseElement.querySelectorAll("#RadioGroup")
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup label")

    expect(radioGroup).toHaveLength(1)
    expect(radioOptions).toHaveLength(3)
  })

  it("passes labelVisibility prop to WidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = render(<Radio {...props} />)

    expect(wrapper.getByText(`${props.element.label}`)).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = render(<Radio {...props} />)
    expect(wrapper.getByText(`${props.element.label}`)).not.toBeVisible()
  })

  it("has a default value", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)

    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const defaultOption = radioOptions[props.element.default]

    expect(defaultOption).toBeChecked()
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    radioOptions.forEach(option => {
      expect(option).toBeDisabled()
    })
  })

  it("has the correct options", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const radioText = wrapper.baseElement.querySelectorAll(
      "#RadioGroup input + div"
    )

    radioOptions.forEach((option, index) => {
      expect(option).toHaveAttribute("value", index.toString())
      expect(radioText[index]).toHaveTextContent(props.element.options[index])
    })
  })

  it("shows a message when there are no options to be shown", () => {
    const props = getProps({ options: [] })
    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const radioText = wrapper.baseElement.querySelectorAll(
      "#RadioGroup input + div"
    )

    expect(radioOptions).toHaveLength(1)
    expect(radioText).toHaveLength(1)
    expect(radioText[0]).toHaveTextContent("No options to select.")
  })

  it("sets the widget value when an option is selected", () => {
    const props = getProps()
    const wrapper = render(<Radio {...props} />)
    jest.spyOn(props.widgetMgr, "setIntValue")
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const firstOption = radioOptions[0]
    const secondOption = radioOptions[1]

    // initial
    expect(firstOption).toBeChecked()
    expect(secondOption).not.toBeChecked()
    // click on the second radio option
    fireEvent.click(secondOption)
    // updated
    expect(firstOption).not.toBeChecked()
    expect(secondOption).toBeChecked()

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")

    const wrapper = render(<Radio {...props} />)
    const radioOptions =
      wrapper.baseElement.querySelectorAll("#RadioGroup input")
    const firstOption = radioOptions[0]
    const secondOption = radioOptions[1]

    // inital state
    expect(firstOption).toBeChecked()
    expect(secondOption).not.toBeChecked()
    // Change the widget value
    fireEvent.click(secondOption)
    expect(firstOption).not.toBeChecked()
    expect(secondOption).toBeChecked()

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true }
    )

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
    const storedValue = props.widgetMgr.getIntValue(props.element)
    expect(storedValue).toBe(props.element.default)
    expect(radioOptions[props.element.default]).toBeChecked()
  })
})

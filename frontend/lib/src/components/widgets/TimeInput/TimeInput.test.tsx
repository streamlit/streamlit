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
import { act } from "react-dom/test-utils"
import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  TimeInput as TimeInputProto,
} from "@streamlit/lib/src/proto"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"

import TimeInput, { Props } from "./TimeInput"

const getProps = (
  elementProps: Partial<TimeInputProto> = {},
  disabled = false
): Props => ({
  element: TimeInputProto.create({
    id: "123",
    label: "Label",
    default: "12:45",
    step: 900,
    ...elementProps,
  }),
  width: 0,
  disabled: disabled,
  theme: mockTheme.emotion,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("TimeInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<TimeInput {...props} />)
    const timeDisplay = screen.getByTestId("stTimeInput-timeDisplay")

    expect(timeDisplay).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps()
    render(<TimeInput {...props} />)
    const widgetLabel = screen.getByText(props.element.label)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<TimeInput {...props} />)

    const widgetLabel = screen.getByTestId("stWidgetLabel")
    expect(widgetLabel).toHaveStyle("visibility: hidden")
    expect(widgetLabel).not.toBeVisible()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<TimeInput {...props} />)

    const widgetLabel = screen.getByTestId("stWidgetLabel")
    expect(widgetLabel).toHaveStyle("display: none")
    expect(widgetLabel).not.toBeVisible()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    render(<TimeInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<TimeInput {...props} />)

    const timeInput = screen.getByTestId("stTimeInput")
    expect(timeInput).toHaveClass("stTimeInput")
    expect(timeInput).toHaveStyle(`width: ${props.width}px`)
  })

  it("can be disabled", () => {
    const props = getProps({}, true)
    render(<TimeInput {...props} />)
    const widgetLabel = screen.getByTestId("stWidgetLabel")
    expect(widgetLabel).toHaveAttribute("disabled")

    const timeDisplay = screen.getByTestId("stTimeInput-timeDisplay")
    expect(timeDisplay).toHaveAttribute("disabled")
  })

  it("has the correct default value", () => {
    const props = getProps()
    render(<TimeInput {...props} />)

    const timeDisplay = screen.getByTestId("stTimeInput-timeDisplay")
    expect(timeDisplay).toHaveTextContent("12:45")
  })

  it("has a 24 format", () => {
    const props = getProps()
    render(<TimeInput {...props} />)

    // Finds the input node by aria-label
    const inputNode = screen.getByLabelText(
      "Selected 12:45. Select a time, 24-hour format."
    )
    expect(inputNode).toBeInTheDocument()
  })

  it("sets the widget value on change", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")

    render(<TimeInput {...props} />)
    // Div containing the selected time as a value prop and as text
    const timeDisplay = screen.getByTestId("stTimeInput-timeDisplay")

    // Change the widget value
    if (timeDisplay) {
      // Select the time input dropdown
      fireEvent.click(timeDisplay)
      // Arrow up from 12:45 to 12:30 (since step in 15 min intervals)
      fireEvent.keyDown(timeDisplay, { key: "ArrowUp", code: 38 })
      // Hit enter to select the new time
      fireEvent.keyDown(timeDisplay, { key: "Enter", code: 13 })
    }

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "12:30",
      { fromUi: true }
    )

    expect(timeDisplay).toHaveAttribute("value", "12:30")
    expect(timeDisplay).toHaveTextContent("12:30")
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringValue")

    render(<TimeInput {...props} />)
    // Div containing the selected time as a value prop and as text
    const timeDisplay = screen.getByTestId("stTimeInput-timeDisplay")

    // Change the widget value
    if (timeDisplay) {
      // Select the time input dropdown
      fireEvent.click(timeDisplay)
      // Arrow down twice from 12:45 to 13:15 (since step in 15 min intervals)
      fireEvent.keyDown(timeDisplay, { key: "ArrowDown", code: 40 })
      fireEvent.keyDown(timeDisplay, { key: "ArrowDown", code: 40 })
      // Hit enter to select the new time
      fireEvent.keyDown(timeDisplay, { key: "Enter", code: 13 })
    }

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "13:15",
      { fromUi: true }
    )

    expect(timeDisplay).toHaveAttribute("value", "13:15")
    expect(timeDisplay).toHaveTextContent("13:15")

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm("form")
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )

    expect(timeDisplay).toHaveAttribute("value", "12:45")
    expect(timeDisplay).toHaveTextContent("12:45")
  })
})

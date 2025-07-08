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

import { Radio as RadioProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

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
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
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
    vi.spyOn(props.widgetMgr, "setIntValue")
    render(<Radio {...props} />)

    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setIntValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setIntValue")
    render(<Radio {...props} />)

    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("has correct className", () => {
    const props = getProps()
    render(<Radio {...props} />)
    const radioElement = screen.getByTestId("stRadio")

    expect(radioElement).toHaveClass("stRadio")
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

  it("sets the widget value when an option is selected", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setIntValue")
    render(<Radio {...props} />)
    const radioOptions = screen.getAllByRole("radio")
    const secondOption = radioOptions[1]

    await user.click(secondOption)

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true },
      undefined
    )
    expect(secondOption).toBeChecked()
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setIntValue")
    render(<Radio {...props} />)

    const radioOptions = screen.getAllByRole("radio")
    const secondOption = radioOptions[1]

    // Change the widget value
    await user.click(secondOption)
    expect(secondOption).toBeChecked()

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true },
      undefined
    )

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    // @ts-expect-error
    const defaultValue = radioOptions[props.element.default]
    expect(defaultValue).toBeChecked()

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      },
      undefined
    )
  })
})

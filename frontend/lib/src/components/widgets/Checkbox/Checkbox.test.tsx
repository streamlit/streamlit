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

import {
  Checkbox as CheckboxProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/protobuf"

import { WidgetStateManager } from "~lib/WidgetStateManager"
import { render } from "~lib/test_util"

import Checkbox, { Props } from "./Checkbox"

const getProps = (
  elementProps: Partial<CheckboxProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: CheckboxProto.create({
    id: "1",
    label: "Label",
    default: false,
    type: CheckboxProto.StyleType.DEFAULT,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("Checkbox widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<Checkbox {...props} />)

    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setBoolValue")

    render(<Checkbox {...props} />)

    expect(props.widgetMgr.setBoolValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("has correct className", () => {
    const props = getProps()
    render(<Checkbox {...props} />)
    const checkboxElement = screen.getByTestId("stCheckbox")

    expect(checkboxElement).toHaveClass("stCheckbox")
  })

  it("renders a label", () => {
    const props = getProps()
    render(<Checkbox {...props} />)
    expect(screen.getByText(props.element.label)).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledContent correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })

    render(<Checkbox {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledContent correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })

    render(<Checkbox {...props} />)

    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("is unchecked by default", () => {
    const props = getProps()
    render(<Checkbox {...props} />)

    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("is not disabled by default", () => {
    const props = getProps()
    render(<Checkbox {...props} />)

    expect(screen.getByRole("checkbox")).not.toBeDisabled()
  })

  it("handles the onChange event", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setBoolValue")

    render(<Checkbox {...props} />)

    await user.click(screen.getByRole("checkbox"))

    expect(props.widgetMgr.setBoolValue).toHaveBeenCalledWith(
      props.element,
      true,
      { fromUi: true },
      undefined
    )
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("can pass fragmentId to setBoolValue", async () => {
    const user = userEvent.setup()
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setBoolValue")

    render(<Checkbox {...props} />)

    await user.click(screen.getByRole("checkbox"))

    expect(props.widgetMgr.setBoolValue).toHaveBeenCalledWith(
      props.element,
      true,
      { fromUi: true },
      "myFragmentId"
    )
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setBoolValue")

    render(<Checkbox {...props} />)

    // Change the widget value
    await user.click(screen.getByRole("checkbox"))

    expect(screen.getByRole("checkbox")).toBeChecked()
    expect(props.widgetMgr.setBoolValue).toHaveBeenLastCalledWith(
      props.element,
      true,
      { fromUi: true },
      undefined
    )

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    expect(props.widgetMgr.setBoolValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      },
      undefined
    )
  })
})

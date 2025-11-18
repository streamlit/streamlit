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
  DateTimeInput as DateTimeInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import DateTimeInput, { type Props } from "./DateTimeInput"

const getProps = (
  elementProps: Partial<DateTimeInputProto> = {},
  disabled = false
): Props => ({
  element: DateTimeInputProto.create({
    id: "123",
    label: "Label",
    default: "2025/11/19, 16:45",
    min: "2015/11/19, 00:00",
    max: "2035/11/19, 23:59",
    step: 900,
    format: "YYYY/MM/DD",
    ...elementProps,
  }),
  disabled,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
})

describe("DateTimeInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stDateTimeInput")).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps()
    render(<DateTimeInput {...props} />)
    expect(screen.getByText(props.element.label)).toBeVisible()
  })

  it("respects hidden label visibility", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).not.toBeVisible()
  })

  it("respects collapsed label visibility", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<DateTimeInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).not.toBeVisible()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<DateTimeInput {...props} />)

    expect(spy).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can be disabled", () => {
    const props = getProps({}, true)
    render(<DateTimeInput {...props} />)

    const inputField = screen.getByTestId("stDateTimeInputField")
    expect(inputField).toHaveAttribute("disabled")
  })

  it("sets the widget value on change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<DateTimeInput {...props} />)

    const inputField = screen.getByTestId("stDateTimeInputField")

    await user.clear(inputField)
    await user.type(inputField, "2026/01/01, 09:30")
    await user.keyboard("{Enter}")

    expect(spy).toHaveBeenLastCalledWith(
      props.element,
      "2026/01/01, 09:30",
      { fromUi: true },
      undefined
    )
  })

  it("clears the widget value", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "" })
    const spy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<DateTimeInput {...props} />)

    const inputField = screen.getByTestId("stDateTimeInputField")
    await user.type(inputField, "2026/03/15, 12:45")
    await user.keyboard("{Enter}")

    const clearButton = screen.getByRole("button", { name: /clear value/i })
    await user.click(clearButton)

    expect(spy).toHaveBeenLastCalledWith(
      props.element,
      null,
      { fromUi: true },
      undefined
    )
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    const props = { ...getProps({ formId: "form" }), fragmentId: "fragment" }
    props.widgetMgr.setFormSubmitBehaviors("form", true)
    const spy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<DateTimeInput {...props} />)

    const inputField = screen.getByTestId("stDateTimeInputField")
    await user.clear(inputField)
    await user.type(inputField, "2026/02/01, 10:15")
    await user.keyboard("{Enter}")

    expect(spy).toHaveBeenLastCalledWith(
      props.element,
      "2026/02/01, 10:15",
      { fromUi: true },
      "fragment"
    )

    act(() => {
      props.widgetMgr.submitForm("form", "fragment")
    })

    expect(spy).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      { fromUi: true },
      "fragment"
    )
  })
})

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
import { act, fireEvent, screen } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { Selectbox as SelectboxProto } from "@streamlit/lib/src/proto"

import Selectbox, { Props } from "./Selectbox"

const getProps = (
  elementProps: Partial<SelectboxProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: SelectboxProto.create({
    id: "1",
    label: "Label",
    default: 0,
    options: ["a", "b", "c"],
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    sendFetchDataChunkMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  ...widgetProps,
})

const pickOption = (selectbox: HTMLElement, value: string): void => {
  fireEvent.click(selectbox)
  const valueElement = screen.getByText(value)
  fireEvent.click(valueElement)
}

describe("Selectbox widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")
    expect(selectbox).toBeInTheDocument()
    expect(selectbox).toHaveClass("stSelectbox")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")

    render(<Selectbox {...props} />)
    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setIntValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    jest.spyOn(props.widgetMgr, "setIntValue")

    render(<Selectbox {...props} />)
    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("handles the onChange event", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setIntValue")

    render(<Selectbox {...props} />)

    const selectbox = screen.getByRole("combobox")
    pickOption(selectbox, "b")

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true },
      undefined
    )
    expect(screen.queryByText("a")).not.toBeInTheDocument()
    expect(screen.getByText("b")).toBeInTheDocument()
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")

    render(<Selectbox {...props} />)

    const selectbox = screen.getByRole("combobox")
    pickOption(selectbox, "b")

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      1,
      { fromUi: true },
      undefined
    )

    // "Submit" the form
    await act(async () => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(screen.getByText("a")).toBeInTheDocument()
    expect(screen.queryByText("b")).not.toBeInTheDocument()
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

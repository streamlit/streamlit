/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { shallow } from "enzyme"
import { fromJS } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"

import DateInput, { Props } from "./DateInput"
import { Datepicker as UIDatePicker } from "baseui/datepicker"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("DateInput widget", () => {
  const props = getProps()
  const wrapper = shallow(<DateInput {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(UIDatePicker).length).toBe(1)
  })

  it("should set widget value on did mount", () => {
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.get("id"),
      props.element.get("default"),
      { fromUi: false }
    )
  })

  it("should have correct className and style", () => {
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("Widget")
    expect(splittedClassName).toContain("stDateInput")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })
})

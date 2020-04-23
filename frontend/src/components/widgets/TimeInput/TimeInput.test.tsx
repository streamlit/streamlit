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
import moment from "moment"
import { shallow } from "enzyme"
import { fromJS } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { TimeInput as TimeInputProto } from "autogen/proto"

import TimeInput, { Props } from "./TimeInput"
import { TimePicker as UITimePicker } from "baseui/timepicker"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()
const getProps = (elementProps: Partial<TimeInputProto> = {}): Props => ({
  element: fromJS({
    id: 123,
    label: "Label",
    default: "12:45",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("TextInput widget", () => {
  const props = getProps()
  const wrapper = shallow(<TimeInput {...props} />)

  it("renders without crashing", () => {
    expect(wrapper).toBeDefined()
  })

  it("should show a label", () => {
    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
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
    expect(splittedClassName).toContain("stTimeInput")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("could be disabled", () => {
    expect(wrapper.find(UITimePicker).prop("overrides")).toStrictEqual({
      Select: {
        props: {
          disabled: props.disabled,
        },
      },
    })
  })

  it("should have the correct default value", () => {
    const wrapperValue = wrapper.find(UITimePicker).prop("value")

    // @ts-ignore
    expect(moment(wrapperValue).format("hh:mm")).toBe("12:45")
  })

  it("should have a 24 format", () => {
    expect(wrapper.find(UITimePicker).prop("format")).toBe("24")
  })

  it("should set the widget value on change", () => {
    const date = new Date(1995, 10, 10, 12, 8)

    // @ts-ignore
    wrapper.find(UITimePicker).prop("onChange")(date)

    expect(wrapper.state("value")).toBe("12:08")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.get("id"),
      "12:08",
      { fromUi: true }
    )
  })
})

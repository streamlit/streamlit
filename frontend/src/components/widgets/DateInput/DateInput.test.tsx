/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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
import { mount } from "lib/test_util"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { DateInput as DateInputProto } from "autogen/proto"

import { Datepicker as UIDatePicker } from "baseui/datepicker"
import DateInput, { Props } from "./DateInput"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: Partial<DateInputProto> = {}): Props => ({
  element: DateInputProto.create({
    id: "1",
    label: "Label",
    default: ["1970/01/01"],
    min: "1970/1/1",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("DateInput widget", () => {
  const props = getProps()
  const wrapper = mount(<DateInput {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(UIDatePicker).length).toBe(1)
  })

  it("should render a label", () => {
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("should set widget value on did mount", () => {
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element.id,
      props.element.default,
      { fromUi: false }
    )
  })

  it("should have correct className and style", () => {
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stDateInput")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a default value", () => {
    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual([
      new Date(props.element.default[0]),
    ])
  })

  it("could be disabled", () => {
    expect(wrapper.find(UIDatePicker).prop("disabled")).toBe(props.disabled)
  })

  it("should have the correct format", () => {
    expect(wrapper.find(UIDatePicker).prop("formatString")).toBe("yyyy/MM/dd")
  })

  it("should update the widget value when it's changed", () => {
    const newDate = new Date("2020/02/06")

    // @ts-ignore
    wrapper.find(UIDatePicker).prop("onChange")({
      date: newDate,
    })
    wrapper.update()

    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual([newDate])
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element.id,
      ["2020/02/06"],
      {
        fromUi: true,
      }
    )
  })

  it("should have a minDate", () => {
    expect(wrapper.find(UIDatePicker).prop("minDate")).toStrictEqual(
      new Date("1970/1/1")
    )
    expect(wrapper.find(UIDatePicker).prop("maxDate")).toBeUndefined()
  })

  it("should have a maxDate if it is passed", () => {
    const props = getProps({
      max: "2030/02/06",
    })
    const wrapper = mount(<DateInput {...props} />)

    expect(wrapper.find(UIDatePicker).prop("maxDate")).toStrictEqual(
      new Date("2030/02/06")
    )
  })

  it("should handle min dates with years less than 100", () => {
    const props = getProps({
      min: "0001/01/01",
    })
    const wrapper = mount(<DateInput {...props} />)

    expect(wrapper.find(UIDatePicker).prop("minDate")).toStrictEqual(
      new Date("0001-01-01T00:00:00")
    )
  })

  it("should handle max dates with years less than 100", () => {
    const props = getProps({
      max: "0001/01/01",
    })
    const wrapper = mount(<DateInput {...props} />)

    expect(wrapper.find(UIDatePicker).prop("maxDate")).toStrictEqual(
      new Date("0001-01-01T00:00:00")
    )
  })
})

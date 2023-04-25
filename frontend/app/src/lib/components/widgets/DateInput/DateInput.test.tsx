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
import { mount } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import {
  DateInput as DateInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "src/lib/proto"

import { Datepicker as UIDatePicker } from "baseui/datepicker"
import { mockTheme } from "src/lib/mocks/mockTheme"
import DateInput, { Props } from "./DateInput"

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
  theme: mockTheme.emotion,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("DateInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<DateInput {...props} />)
    expect(wrapper.find(UIDatePicker).length).toBe(1)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = mount(<DateInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = mount(<DateInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<DateInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    mount(<DateInput {...props} />)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = mount(<DateInput {...props} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-expect-error
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stDateInput")

    // @ts-expect-error
    expect(style.width).toBe(getProps().width)
  })

  it("renders a default value", () => {
    const props = getProps()
    const wrapper = mount(<DateInput {...props} />)

    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual([
      new Date(props.element.default[0]),
    ])
  })

  it("can be disabled", () => {
    const props = getProps()
    const wrapper = mount(<DateInput {...props} />)
    expect(wrapper.find(UIDatePicker).prop("disabled")).toBe(props.disabled)
  })

  it("has the correct format", () => {
    const props = getProps()
    const wrapper = mount(<DateInput {...props} />)
    expect(wrapper.find(UIDatePicker).prop("formatString")).toBe("yyyy/MM/dd")
  })

  it("updates the widget value when it's changed", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    const wrapper = mount(<DateInput {...props} />)
    const newDate = new Date("2020/02/06")

    // @ts-expect-error
    wrapper.find(UIDatePicker).prop("onChange")({
      date: newDate,
    })
    wrapper.update()

    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual([newDate])
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      ["2020/02/06"],
      {
        fromUi: true,
      }
    )
  })

  it("reset it's value to default when it closed with empty input", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    const wrapper = mount(<DateInput {...props} />)
    const newDate = new Date("2020/02/06")

    // @ts-expect-error
    wrapper.find(UIDatePicker).prop("onChange")({
      date: newDate,
    })
    wrapper.update()

    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual([newDate])
    // @ts-expect-error
    wrapper.find(UIDatePicker).prop("onChange")({
      date: null,
    })
    // @ts-expect-error
    wrapper.find(UIDatePicker).prop("onClose")()
    wrapper.update()
    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual([
      new Date("1970/1/1"),
    ])
  })

  it("has a minDate", () => {
    const props = getProps()
    const wrapper = mount(<DateInput {...props} />)
    expect(wrapper.find(UIDatePicker).prop("minDate")).toStrictEqual(
      new Date("1970/1/1")
    )
    expect(wrapper.find(UIDatePicker).prop("maxDate")).toBeUndefined()
  })

  it("has a maxDate if it is passed", () => {
    const props = getProps({ max: "2030/02/06" })
    const wrapper = mount(<DateInput {...props} />)

    expect(wrapper.find(UIDatePicker).prop("maxDate")).toStrictEqual(
      new Date("2030/02/06")
    )
  })

  it("handles min dates with years less than 100", () => {
    const props = getProps({ min: "0001/01/01" })
    const wrapper = mount(<DateInput {...props} />)

    expect(wrapper.find(UIDatePicker).prop("minDate")).toStrictEqual(
      new Date("0001-01-01T00:00:00")
    )
  })

  it("handles max dates with years less than 100", () => {
    const props = getProps({ max: "0001/01/01" })
    const wrapper = mount(<DateInput {...props} />)

    expect(wrapper.find(UIDatePicker).prop("maxDate")).toStrictEqual(
      new Date("0001-01-01T00:00:00")
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    const wrapper = mount(<DateInput {...props} />)

    // Change the widget value
    const newDate = new Date("2020/02/06")

    // @ts-expect-error
    wrapper.find(UIDatePicker).prop("onChange")({
      date: newDate,
    })
    wrapper.update()

    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual([newDate])
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      ["2020/02/06"],
      {
        fromUi: true,
      }
    )

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(wrapper.find(UIDatePicker).prop("value")).toStrictEqual(
      props.element.default.map(value => new Date(value))
    )
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})

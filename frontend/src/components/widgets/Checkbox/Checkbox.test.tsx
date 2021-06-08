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
import { mount } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import { Checkbox as UICheckbox } from "baseui/checkbox"
import { Checkbox as CheckboxProto } from "src/autogen/proto"
import Checkbox, { OwnProps } from "./Checkbox"

const getProps = (elementProps: Partial<CheckboxProto> = {}): OwnProps => ({
  element: CheckboxProto.create({
    id: "1",
    label: "Label",
    default: false,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("Checkbox widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Checkbox {...props} />)

    expect(wrapper.find(UICheckbox).length).toBe(1)
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setBoolValue")

    mount(<Checkbox {...props} />)

    expect(props.widgetMgr.setBoolValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = mount(<Checkbox {...props} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stCheckbox")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = mount(<Checkbox {...props} />)
    expect(wrapper.find("StyledContent").text()).toBe(props.element.label)
  })

  it("is unchecked by default", () => {
    const props = getProps()
    const wrapper = mount(<Checkbox {...props} />)

    expect(wrapper.find(UICheckbox).prop("checked")).toBe(
      props.element.default
    )
  })

  it("is not disabled by default", () => {
    const props = getProps()
    const wrapper = mount(<Checkbox {...props} />)

    expect(wrapper.find(UICheckbox).prop("disabled")).toBe(props.disabled)
  })

  it("handles the onChange event", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setBoolValue")

    const wrapper = mount(<Checkbox {...props} />)

    // @ts-ignore
    wrapper.find(UICheckbox).prop("onChange")({
      target: { checked: true },
    } as EventTarget)
    wrapper.update()

    expect(props.widgetMgr.setBoolValue).toHaveBeenCalledWith(
      props.element,
      true,
      { fromUi: true }
    )
    expect(wrapper.find(UICheckbox).prop("checked")).toBe(true)
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setBoolValue")

    const wrapper = mount(<Checkbox {...props} />)

    // Change the widget value
    // @ts-ignore
    wrapper.find(UICheckbox).prop("onChange")({
      target: { checked: true },
    } as EventTarget)
    wrapper.update()

    expect(wrapper.find(UICheckbox).prop("checked")).toBe(true)
    expect(
      props.widgetMgr.setBoolValue
    ).toHaveBeenLastCalledWith(props.element, true, { fromUi: true })

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(wrapper.find(UICheckbox).prop("checked")).toEqual(
      props.element.default
    )
    expect(props.widgetMgr.setBoolValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})

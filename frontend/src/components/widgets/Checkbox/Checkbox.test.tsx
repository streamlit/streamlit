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

import Checkbox, { Props } from "./Checkbox"
import { Checkbox as UICheckbox } from "baseui/checkbox"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    default: false,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("Checkbox widget", () => {
  const props = getProps()
  const wrapper = shallow(<Checkbox {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(UICheckbox).length).toBe(1)
  })

  it("should set widget value on did mount", () => {
    expect(props.widgetMgr.setBoolValue).toHaveBeenCalledWith(
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
    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stCheckbox")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label", () => {
    expect(wrapper.find(UICheckbox).prop("children")).toBe(
      props.element.get("label")
    )
  })

  it("should be unchecked by default", () => {
    expect(wrapper.find(UICheckbox).prop("checked")).toBe(
      props.element.get("default")
    )
  })

  it("should be unchecked by default", () => {
    expect(wrapper.find(UICheckbox).prop("disabled")).toBe(props.disabled)
  })

  it("onChange should work", () => {
    // @ts-ignore
    wrapper.find(UICheckbox).prop("onChange")({
      target: {
        checked: true,
      },
    } as EventTarget)

    expect(props.widgetMgr.setBoolValue).toHaveBeenCalledWith(
      props.element.get("id"),
      true,
      { fromUi: true }
    )
    expect(wrapper.state("value")).toBeTruthy()
  })
})

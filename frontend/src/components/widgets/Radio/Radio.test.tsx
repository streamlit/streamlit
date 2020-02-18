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
import { radioOverrides } from "lib/widgetTheme"
import { WidgetStateManager } from "lib/WidgetStateManager"

import Radio, { Props } from "./Radio"
import { Radio as UIRadio, RadioGroup } from "baseui/radio"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    default: 0,
    options: ["a", "b", "c"],
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("Checkbox widget", () => {
  const props = getProps()
  const wrapper = shallow(<Radio {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(RadioGroup).length).toBe(1)
    expect(wrapper.find(UIRadio).length).toBe(3)
  })

  it("should set widget value on did mount", () => {
    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
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
    expect(splittedClassName).toContain("stRadio")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label", () => {
    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should have a default value", () => {
    expect(wrapper.find(RadioGroup).prop("value")).toBe(
      props.element.get("default").toString()
    )
  })

  it("could be disabled", () => {
    expect(wrapper.find(RadioGroup).prop("disabled")).toBe(props.disabled)
  })

  it("should have the correct options", () => {
    const options = wrapper.find(UIRadio)

    options.forEach((option, index) => {
      expect(option.prop("value")).toBe(index.toString())
      expect(option.prop("children")).toBe(
        props.element.get("options").get(index)
      )
      expect(option.prop("overrides")).toBe(radioOverrides)
    })
  })

  it("should show a message when there are no options to be shown", () => {
    const props = getProps({
      options: [],
    })
    const wrapper = shallow(<Radio {...props} />)

    expect(wrapper.find(UIRadio).length).toBe(1)
    expect(wrapper.find(UIRadio).prop("children")).toBe(
      "No options to select."
    )
  })

  it("should select just one option and set the widget value", () => {
    // @ts-ignore
    wrapper.find(RadioGroup).prop("onChange")({
      target: {
        value: "1",
      },
    } as React.ChangeEvent<HTMLInputElement>)

    expect(wrapper.find(RadioGroup).prop("value")).toBe("1")
    expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
      props.element.get("id"),
      1,
      { fromUi: true }
    )
  })
})

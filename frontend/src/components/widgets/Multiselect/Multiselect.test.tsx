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
import { multiSelectOverrides } from "lib/widgetTheme"
import { WidgetStateManager } from "lib/WidgetStateManager"

import { Select as UISelect, TYPE } from "baseui/select"
import Multiselect, { Props } from "./Multiselect"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: Record<string, unknown> = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    default: [0],
    options: ["a", "b", "c"],
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("Multiselect widget", () => {
  const props = getProps()
  const wrapper = shallow(<Multiselect {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(UISelect).length).toBeTruthy()
  })

  it("should set widget value on did mount", () => {
    expect(props.widgetMgr.setIntArrayValue).toHaveBeenCalledWith(
      props.element.get("id"),
      props.element.get("default").toJS(),
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
    expect(splittedClassName).toContain("stMultiSelect")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label", () => {
    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should set maxDropdownHeight", () => {
    const props = getProps({
      maxDropdownHeight: 5,
    })
    const wrapper = shallow(<Multiselect {...props} />)
    console.log(wrapper.find(UISelect).prop("maxDropdownHeigh"))
    expect(wrapper.find(UISelect).prop("maxDropdownHeight")).toBe("5px")
  })

  it("should set maxDropdownHeight to an empty string, if not provided", () => {
    const props = getProps()
    const wrapper = shallow(<Multiselect {...props} />)
    console.log(wrapper.find(UISelect).prop("maxDropdownHeigh"))
    expect(wrapper.find(UISelect).prop("maxDropdownHeight")).toBe("")
  })

  describe("placeholder", () => {
    it("should render when it's not empty", () => {
      expect(wrapper.find(UISelect).prop("placeholder")).toBe(
        "Choose an option"
      )
    })

    it("should render with empty options", () => {
      const props = getProps({
        options: [],
      })
      const wrapper = shallow(<Multiselect {...props} />)

      expect(wrapper.find(UISelect).prop("placeholder")).toBe(
        "No options to select."
      )
    })
  })

  it("should render options", () => {
    const options = wrapper.find(UISelect).prop("options") || []

    options.forEach(option => {
      expect(option).toHaveProperty("label")
      expect(option).toHaveProperty("value")
    })

    expect(options.length).toBe(props.element.get("options").size)
    expect(wrapper.find(UISelect).prop("labelKey")).toBe("label")
    expect(wrapper.find(UISelect).prop("valueKey")).toBe("value")
  })

  it("should have multi attr", () => {
    expect(wrapper.find(UISelect).prop("multi")).toBeDefined()
  })

  it("should have correct type", () => {
    expect(wrapper.find(UISelect).prop("type")).toBe(TYPE.select)
  })

  it("could be disabled", () => {
    expect(wrapper.find(UISelect).prop("disabled")).toBe(props.disabled)
  })

  it("should be able to select multiple options", () => {
    // @ts-ignore
    wrapper.find(UISelect).prop("onChange")({
      type: "select",
      option: {
        value: 1,
      },
    })

    expect(wrapper.find(UISelect).prop("value")).toStrictEqual([
      { label: "a", value: "0" },
      { label: "b", value: "1" },
    ])
  })

  it("should be able to remove an option", () => {
    // @ts-ignore
    wrapper.find(UISelect).prop("onChange")({
      type: "remove",
      option: {
        value: 1,
      },
    })

    expect(wrapper.find(UISelect).prop("value")).toStrictEqual([
      { label: "a", value: "0" },
    ])
  })

  it("should be able to clear it", () => {
    // @ts-ignore
    wrapper.find(UISelect).prop("onChange")({
      type: "clear",
    })

    expect(wrapper.find(UISelect).prop("value")).toStrictEqual([])
  })

  it("should have our theme overrides", () => {
    expect(wrapper.find(UISelect).prop("overrides")).toBe(multiSelectOverrides)
  })
})

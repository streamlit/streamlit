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

import Selectbox, { Props } from "./Selectbox"
import { Select as UISelect } from "baseui/select"

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

describe("Selectbox widget", () => {
  const props = getProps()
  const wrapper = shallow(<Selectbox {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(UISelect).length).toBeTruthy()
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
    expect(splittedClassName).toContain("stSelectbox")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label", () => {
    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should render a placeholder with empty options", () => {
    const props = getProps({
      options: [],
    })
    const wrapper = shallow(<Selectbox {...props} />)

    expect(wrapper.find(UISelect).prop("options")).toStrictEqual([
      {
        label: "No options to select.",
        value: "0",
      },
    ])
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

  it("could be disabled", () => {
    expect(wrapper.find(UISelect).prop("disabled")).toBe(props.disabled)
  })

  it("should be able to select an option", () => {
    // @ts-ignore
    wrapper.find(UISelect).prop("onChange")({
      value: [{ label: "b", value: "1" }],
      option: { label: "b", value: "1" },
      type: "select",
    })

    expect(wrapper.find(UISelect).prop("value")).toContainEqual({
      label: "b",
      value: "1",
    })
  })

  it("should not filter options based on index", () => {
    const options = wrapper.find(UISelect).prop("options")
    const filterOptionsFn = wrapper.find(UISelect).prop("filterOptions")
    if (filterOptionsFn === undefined || options === undefined) {
      fail("Unexepcted undefined value")
      return 0
    }
    const filteredOptions = filterOptionsFn(options, "1")
    expect(filteredOptions).toEqual([])
  })

  it("should filter options based on label with case insensitive", () => {
    const options = wrapper.find(UISelect).prop("options")
    const filterOptionsFn = wrapper.find(UISelect).prop("filterOptions")
    if (filterOptionsFn === undefined || options === undefined) {
      fail("Unexepcted undefined value")
      return 0
    }
    expect(filterOptionsFn(options, "b")).toEqual([
      {
        label: "b",
        value: "1",
      },
    ])

    expect(filterOptionsFn(options, "B")).toEqual([
      {
        label: "b",
        value: "1",
      },
    ])
  })
})

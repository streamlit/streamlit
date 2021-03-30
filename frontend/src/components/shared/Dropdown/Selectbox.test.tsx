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
import { shallow } from "src/lib/test_util"

import { Select as UISelect } from "baseui/select"
import Selectbox, { Props, fuzzyFilterSelectOptions } from "./Selectbox"

jest.mock("src/lib/WidgetStateManager")

const getProps = (props: Partial<Props> = {}): Props => ({
  value: 0,
  label: "Label",
  options: ["a", "b", "c"],
  width: 0,
  disabled: false,
  onChange: jest.fn(),
  ...props,
})

describe("Selectbox widget", () => {
  const props = getProps()
  const wrapper = shallow(<Selectbox {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(UISelect).length).toBeTruthy()
  })

  it("should have correct className and style", () => {
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stSelectbox")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label", () => {
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.label)
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

    expect(options.length).toBe(props.options.length)
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
    }
    const filteredOptions = filterOptionsFn(options, "1")
    expect(filteredOptions).toEqual([])
  })

  it("should filter options based on label with case insensitive", () => {
    const options = wrapper.find(UISelect).prop("options")
    const filterOptionsFn = wrapper.find(UISelect).prop("filterOptions")
    if (filterOptionsFn === undefined || options === undefined) {
      fail("Unexepcted undefined value")
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

  it("should fuzzy filter options correctly", () => {
    // This test just makes sure the filter algorithm works correctly. The e2e
    // test actually types something in the selectbox and makes sure that it
    // shows the right options.

    const options = [
      { label: "e2e/scripts/components_iframe.py", value: "" },
      { label: "e2e/scripts/st_warning.py", value: "" },
      { label: "e2e/scripts/st_container.py", value: "" },
      { label: "e2e/scripts/st_dataframe_sort_column.py", value: "" },
      { label: "e2e/scripts/app_hotkeys.py", value: "" },
      { label: "e2e/scripts/st_info.py", value: "" },
      { label: "e2e/scripts/st_echo.py", value: "" },
      { label: "e2e/scripts/st_json.py", value: "" },
      { label: "e2e/scripts/st_experimental_get_query_params.py", value: "" },
      { label: "e2e/scripts/st_markdown.py", value: "" },
      { label: "e2e/scripts/st_color_picker.py", value: "" },
      { label: "e2e/scripts/st_expander.py", value: "" },
    ]

    const results1 = fuzzyFilterSelectOptions(options, "esstm")
    expect(results1.map(it => it.label)).toEqual([
      "e2e/scripts/st_markdown.py",
      "e2e/scripts/st_dataframe_sort_column.py",
      "e2e/scripts/st_experimental_get_query_params.py",
      "e2e/scripts/components_iframe.py",
    ])

    const results2 = fuzzyFilterSelectOptions(options, "eseg")
    expect(results2.map(it => it.label)).toEqual([
      "e2e/scripts/st_experimental_get_query_params.py",
    ])
  })

  it("should update value if new value provided from parent", () => {
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

    wrapper.setProps({ value: "2" })
    expect(wrapper.find(UISelect).prop("value")).toContainEqual({
      label: "c",
      value: "2",
    })
  })
})

describe("Selectbox widget with optional props", () => {
  it("should not render label if none provided", () => {
    const props = getProps({ label: undefined })
    const wrapper = shallow(<Selectbox {...props} />)

    expect(wrapper.find("StyledWidgetLabel").exists()).toBeFalsy()
  })

  it("should render TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    const wrapper = shallow(<Selectbox {...props} />)
    expect(wrapper.find("TooltipIcon").prop("content")).toBe("help text")
  })
})

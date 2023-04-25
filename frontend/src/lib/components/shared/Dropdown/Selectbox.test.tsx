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
import { ShallowWrapper } from "enzyme"
import { shallow, mount } from "src/lib/test_util"

import { Select as UISelect } from "baseui/select"
import { LabelVisibilityOptions } from "src/lib/util/utils"
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
  let props: Props
  let wrapper: ShallowWrapper

  beforeEach(() => {
    props = getProps()
    wrapper = shallow(<Selectbox {...props} />)
  })

  it("renders without crashing", () => {
    expect(wrapper.find(UISelect).length).toBeTruthy()
  })

  it("has correct className and style", () => {
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-expect-error
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stSelectbox")

    // @ts-expect-error
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const wrapper = mount(<Selectbox {...props} />)
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.label)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    const wrapper = mount(<Selectbox {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityOptions.Hidden
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    const wrapper = mount(<Selectbox {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityOptions.Collapsed
    )
  })

  it("renders a placeholder with empty options", () => {
    props = getProps({
      options: [],
    })
    wrapper = shallow(<Selectbox {...props} />)

    expect(wrapper.find(UISelect).prop("options")).toStrictEqual([
      {
        label: "No options to select.",
        value: "0",
      },
    ])
  })

  it("renders options", () => {
    const options = wrapper.find(UISelect).prop("options") || []

    // @ts-expect-error
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

  it("is able to select an option", () => {
    // @ts-expect-error
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

  it("doesn't lose the selected value when the input is empty", () => {
    const wrapper = mount(<Selectbox {...props} />)

    const input = wrapper.find("input")

    input.simulate("change", { target: { value: "" } })
    expect(wrapper.state("isEmpty")).toBe(true)
    expect(wrapper.state("value")).toEqual(0)

    input.simulate("change", { target: { value: "a" } })
    expect(wrapper.state("isEmpty")).toBe(false)
    expect(wrapper.state("value")).toEqual(0)
  })

  it("doesn't filter options based on index", () => {
    const options = wrapper.find(UISelect).prop("options")
    const filterOptionsFn = wrapper.find(UISelect).prop("filterOptions")
    if (filterOptionsFn === undefined || options === undefined) {
      fail("Unexpected undefined value")
    }
    // @ts-expect-error
    const filteredOptions = filterOptionsFn(options, "1")
    expect(filteredOptions).toEqual([])
  })

  it("filters options based on label with case insensitive", () => {
    const options = wrapper.find(UISelect).prop("options")
    const filterOptionsFn = wrapper.find(UISelect).prop("filterOptions")
    if (filterOptionsFn === undefined || options === undefined) {
      fail("Unexpected undefined value")
    }
    // @ts-expect-error
    expect(filterOptionsFn(options, "b")).toEqual([
      {
        label: "b",
        value: "1",
      },
    ])
    // @ts-expect-error
    expect(filterOptionsFn(options, "B")).toEqual([
      {
        label: "b",
        value: "1",
      },
    ])
  })

  it("fuzzy filters options correctly", () => {
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

  it("updates value if new value provided from parent", () => {
    // @ts-expect-error
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
  // This goes against the previous solution to bug #3220, but that's on purpose.
  it("renders no label element if no text provided", () => {
    const props = getProps({ label: undefined })
    const wrapper = shallow(<Selectbox {...props} />)

    expect(wrapper.find("StyledWidgetLabel").exists()).toBeFalsy()
  })

  it("renders TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    const wrapper = shallow(<Selectbox {...props} />)

    expect(wrapper.find("TooltipIcon").prop("content")).toBe("help text")
  })
})

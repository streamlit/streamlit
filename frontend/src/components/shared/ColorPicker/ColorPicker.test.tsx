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
import { StyledColorPicker } from "src/components/shared/ColorPicker/styled-components"
import { mount, shallow } from "src/lib/test_util"
import { StatefulPopover as UIPopover } from "baseui/popover"
import { ChromePicker } from "react-color"

import ColorPicker, { Props } from "./ColorPicker"

const getProps = (props: Partial<Props> = {}): Props => ({
  label: "Label",
  value: "#000000",
  width: 0,
  disabled: false,
  onChange: jest.fn(),
  ...props,
})

describe("ColorPicker widget", () => {
  const props = getProps()
  const wrapper = shallow(<ColorPicker {...props} />)
  const colorPickerWrapper = wrapper.find(UIPopover).renderProp("content")()
  it("renders without crashing", () => {
    expect(wrapper.find(UIPopover).length).toBe(1)
    expect(colorPickerWrapper.find(ChromePicker).length).toBe(1)
  })

  it("should render a label in the title", () => {
    const wrapper = mount(<ColorPicker {...props} />)
    const wrappedDiv = wrapper.find("StyledColorPicker")
    expect(wrappedDiv.find("StyledWidgetLabel").text()).toBe(props.label)
  })

  it("should have correct style", () => {
    const wrappedDiv = wrapper.find("StyledColorPicker")
    const { style } = wrappedDiv.props()

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a default color in the preview and the color picker", () => {
    wrapper.find(UIPopover).simulate("click")
    const chromePickerWrapper = wrapper.find(UIPopover).renderProp("content")()

    expect(wrapper.find("StyledColorBlock").prop("style")).toEqual({
      backgroundColor: "#000000",
    })

    expect(chromePickerWrapper.prop("color")).toEqual("#000000")
  })

  it("supports hex shorthand", () => {
    wrapper.find(UIPopover).simulate("click")

    colorPickerWrapper.prop("onChange")({
      hex: "#333",
    })

    expect(
      wrapper
        .find(UIPopover)
        .renderProp("content")()
        .prop("color")
    ).toEqual("#333")
  })

  it("should update the widget value when it's changed", () => {
    const newColor = "#E91E63"
    wrapper.find(UIPopover).simulate("click")

    colorPickerWrapper.prop("onChange")({
      hex: newColor,
    })

    expect(
      wrapper
        .find(UIPopover)
        .renderProp("content")()
        .prop("color")
    ).toEqual(newColor)
  })

  it("should disable alpha property for now", () => {
    wrapper.find(UIPopover).simulate("click")
    expect(colorPickerWrapper.prop("disableAlpha")).toStrictEqual(true)
  })
})

describe("ColorPicker widget with optional params", () => {
  it("renders with showValue", () => {
    const props = getProps({ showValue: true })
    const wrapper = shallow(<ColorPicker {...props} />)
    expect(wrapper.find("StyledColorValue").exists()).toBe(true)
  })

  it("renders without showValue", () => {
    const props = getProps()
    const wrapper = shallow(<ColorPicker {...props} />)
    expect(wrapper.find("StyledColorValue").exists()).toBe(false)
  })

  it("should render TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    const wrapper = shallow(<ColorPicker {...props} />)
    expect(wrapper.find("TooltipIcon").prop("content")).toBe("help text")
  })
})

describe("ColorPicker error handler", () => {
  it("swallows SecurityErrors", () => {
    const props = getProps({})
    const wrapper = shallow(<ColorPicker {...props} />)
    wrapper
      .find(StyledColorPicker)
      .simulateError({ name: "SecurityError", message: "", stack: [] })

    // We swallow SecurityErrors, so after an error is thrown we
    // should not get unmounted
    expect(wrapper.find(UIPopover).length).toBe(1)
  })

  it("re-throws non-SecurityErrors", () => {
    const mockError = { name: "FooError", message: "", stack: [] }

    expect(() => {
      const props = getProps({})
      const wrapper = shallow(<ColorPicker {...props} />)
      wrapper.find(StyledColorPicker).simulateError(mockError)
    }).toThrowError(mockError)
  })
})

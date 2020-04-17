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
import { mount, ReactWrapper } from "enzyme"
import { fromJS } from "immutable"
import { StatefulPopover as UIPopover } from "baseui/popover"
import { ColorPicker as ColorPickerProto } from "autogen/proto"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { ChromePicker } from "react-color"

import ColorPicker, { Props } from "./ColorPicker"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: Partial<ColorPickerProto> = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    default: "#000000",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})
let wrapper: ReactWrapper
let props: Props

describe("ColorPicker widget", () => {
  beforeEach(() => {
    props = getProps()
    wrapper = mount(<ColorPicker {...props} />)
  })
  afterEach(() => {
    wrapper.unmount()
  })

  it("renders without crashing", () => {
    expect(wrapper.find(UIPopover).length).toBe(1)
    wrapper.find(UIPopover).simulate("click")
    expect(wrapper.find(ChromePicker).length).toBe(1)
  })

  it("should render a label in the title", () => {
    const wrappedDiv = wrapper.find("div").first()
    expect(wrappedDiv.find("label").text()).toBe(props.element.get("label"))
  })

  it("should set widget value on did mount", () => {
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
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
    expect(splittedClassName).toContain("stColorPicker")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a default color in the preview and the color picker", () => {
    expect(wrapper.find(".color-preview").prop("style")).toEqual({
      backgroundColor: "#000000",
    })

    wrapper.find(UIPopover).simulate("click")

    expect(wrapper.find(ChromePicker).prop("color")).toStrictEqual(
      new String(props.element.get("default"))
    )
  })

  it("supports hex shorthand", () => {
    wrapper.find(UIPopover).simulate("click")

    // @ts-ignore
    wrapper.find(ChromePicker).prop("onChangeComplete")({
      hex: "#333",
    })
    wrapper.update()

    expect(wrapper.find(ChromePicker).prop("color")).toEqual("#333")
  })

  it("should update the widget value when it's changed", () => {
    const newColor = "#E91E63"
    wrapper.find(UIPopover).simulate("click")

    // @ts-ignore
    wrapper.find(ChromePicker).prop("onChangeComplete")({
      hex: newColor,
    })

    wrapper.update()

    expect(wrapper.find(ChromePicker).prop("color")).toEqual(newColor)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.get("id"),
      "#E91E63",
      { fromUi: true }
    )
  })

  it("should disable alpha property for now", () => {
    wrapper.find(UIPopover).simulate("click")
    expect(wrapper.find(ChromePicker).prop("disableAlpha")).toStrictEqual(true)
  })
})

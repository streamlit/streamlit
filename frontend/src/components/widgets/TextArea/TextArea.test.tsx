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

import TextArea, { Props } from "./TextArea"
import { Textarea as UITextArea } from "baseui/textarea"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    default: "",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("Checkbox widget", () => {
  const props = getProps()
  const wrapper = shallow(<TextArea {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(UITextArea).length).toBe(1)
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
    expect(splittedClassName).toContain("stTextArea")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label", () => {
    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should have a default value", () => {
    expect(wrapper.find(UITextArea).prop("value")).toBe(
      props.element.get("default").toString()
    )
  })

  it("could be disabled", () => {
    expect(wrapper.find(UITextArea).prop("disabled")).toBe(props.disabled)
  })

  describe("should show instructions", () => {
    it("Ctrl+Enter if not mac", () => {
      // @ts-ignore
      wrapper.find(UITextArea).prop("onChange")({
        target: {
          value: "testing",
        },
      } as React.ChangeEvent<HTMLTextAreaElement>)

      expect(wrapper.find("div.instructions").text()).toBe(
        "Press Ctrl+Enter to apply"
      )
    })

    it("⌘+Enter if mac", () => {
      Object.defineProperty(navigator, "platform", {
        value: "MacIntel",
        writable: true,
      })

      const props = getProps()
      const wrapper = shallow(<TextArea {...props} />)

      // @ts-ignore
      wrapper.find(UITextArea).prop("onChange")({
        target: {
          value: "testing",
        },
      } as React.ChangeEvent<HTMLTextAreaElement>)

      expect(wrapper.find("div.instructions").text()).toBe(
        "Press ⌘+Enter to apply"
      )
    })
  })
})

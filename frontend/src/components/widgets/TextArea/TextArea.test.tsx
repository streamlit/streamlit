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
import { TextArea as TextAreaProto } from "autogen/proto"
import { WidgetStateManager } from "lib/WidgetStateManager"

import TextArea, { Props } from "./TextArea"
import { Textarea as UITextArea } from "baseui/textarea"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: Partial<TextAreaProto> = {}): Props => ({
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

describe("TextArea widget", () => {
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

  it("should show Ctrl+Enter instructions", () => {
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

  it("should set widget value on blur", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} />)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: {
        value: "testing",
      },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onBlur")()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.get("id"),
      "testing",
      { fromUi: true }
    )
  })

  it("should set widget value when ctrl+enter is pressed", () => {
    const props = getProps()
    const wrapper = shallow(<TextArea {...props} />)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onChange")({
      target: {
        value: "testing",
      },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    // @ts-ignore
    wrapper.find(UITextArea).prop("onKeyDown")({
      preventDefault: jest.fn(),
      ctrlKey: true,
      key: "Enter",
    })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.get("id"),
      "testing",
      { fromUi: true }
    )
  })

  describe("On mac it should", () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
    })

    const props = getProps()
    const wrapper = shallow(<TextArea {...props} />)

    it("show ⌘+Enter instructions", () => {
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

    it("should set widget value when ⌘+enter is pressed", () => {
      // @ts-ignore
      wrapper.find(UITextArea).prop("onChange")({
        target: {
          value: "testing",
        },
      } as React.ChangeEvent<HTMLTextAreaElement>)

      // @ts-ignore
      wrapper.find(UITextArea).prop("onKeyDown")({
        preventDefault: jest.fn(),
        metaKey: true,
        key: "Enter",
      })

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element.get("id"),
        "testing",
        { fromUi: true }
      )
    })
  })
})

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

import TextInput, { Props } from "./TextInput"
import { Input as UIInput } from "baseui/input"
import { TextInput as TextInputProto } from "autogen/proto"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()
const getProps = (elementProps: Partial<TextInputProto> = {}): Props => ({
  element: fromJS({
    label: "Label",
    default: "",
    type: TextInputProto.Type.DEFAULT,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("TextInput widget", () => {
  const props = getProps()
  const wrapper = shallow(<TextInput {...props} />)

  it("renders without crashing", () => {
    expect(wrapper).toBeDefined()
  })

  it("should show a label", () => {
    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should handle TextInputProto.Type properly", () => {
    const defaultProps = getProps({ type: TextInputProto.Type.DEFAULT })
    let textInput = shallow(<TextInput {...defaultProps} />)
    let uiInput = textInput.find(UIInput)
    expect(uiInput.props().type).toBeUndefined()

    const passwordProps = getProps({ type: TextInputProto.Type.PASSWORD })
    textInput = shallow(<TextInput {...passwordProps} />)
    uiInput = textInput.find(UIInput)
    expect(uiInput.props().type).toBe("password")
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
    expect(splittedClassName).toContain("stTextInput")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("could be disabled", () => {
    expect(wrapper.find(UIInput).prop("disabled")).toBe(props.disabled)
  })

  it("should set widget value on blur", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-ignore
    wrapper.find(UIInput).prop("onChange")({
      target: {
        value: "testing",
      },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    // @ts-ignore
    wrapper.find(UIInput).prop("onBlur")()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.get("id"),
      "testing",
      { fromUi: true }
    )
  })

  it("should set widget value when enter is pressed", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-ignore
    wrapper.find(UIInput).prop("onChange")({
      target: {
        value: "testing",
      },
    } as React.ChangeEvent<HTMLTextAreaElement>)

    // @ts-ignore
    wrapper.find(UIInput).prop("onKeyPress")({
      preventDefault: jest.fn(),
      key: "Enter",
    })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.get("id"),
      "testing",
      { fromUi: true }
    )
  })

  it("don't do anything when the component is clean", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-ignore
    wrapper.find(UIInput).prop("onKeyPress")({
      preventDefault: jest.fn(),
      key: "Enter",
    })
    // @ts-ignore
    wrapper.find(UIInput).prop("onBlur")()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("should limit the length if max_chars is passed", () => {
    const props = getProps({
      maxChars: 10,
    })
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-ignore
    wrapper.find(UIInput).prop("onChange")({
      target: {
        value: "0123456789",
      },
    } as EventTarget)

    expect(wrapper.find(UIInput).prop("value")).toBe("0123456789")

    // @ts-ignore
    wrapper.find(UIInput).prop("onChange")({
      target: {
        value: "0123456789a",
      },
    } as EventTarget)

    expect(wrapper.find(UIInput).prop("value")).toBe("0123456789")
  })
})

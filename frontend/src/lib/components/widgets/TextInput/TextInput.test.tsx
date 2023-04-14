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
import { shallow, mount } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import { Input as UIInput } from "baseui/input"
import {
  TextInput as TextInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "src/autogen/proto"
import TextInput, { Props } from "./TextInput"

const getProps = (elementProps: Partial<TextInputProto> = {}): Props => ({
  element: TextInputProto.create({
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    type: TextInputProto.Type.DEFAULT,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("TextInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("shows a label", () => {
    const props = getProps()
    const wrapper = mount(<TextInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = mount(<TextInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<TextInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("shows a placeholder", () => {
    const props = getProps()
    const wrapper = mount(<TextInput {...props} />)

    expect(wrapper.find(UIInput).prop("placeholder")).toBe(
      props.element.placeholder
    )
  })

  it("handles TextInputProto.Type properly", () => {
    const defaultProps = getProps({ type: TextInputProto.Type.DEFAULT })
    let textInput = shallow(<TextInput {...defaultProps} />)
    let uiInput = textInput.find(UIInput)
    expect(uiInput.props().type).toBe("text")

    const passwordProps = getProps({ type: TextInputProto.Type.PASSWORD })
    textInput = shallow(<TextInput {...passwordProps} />)
    uiInput = textInput.find(UIInput)
    expect(uiInput.props().type).toBe("password")
  })

  it("handles TextInputProto.autocomplete", () => {
    let props = getProps()
    let textInput = shallow(<TextInput {...props} />)
    let uiInput = textInput.find(UIInput)
    expect(uiInput.props().autoComplete).toBe("")

    props = getProps({ autocomplete: "one-time-password" })
    textInput = shallow(<TextInput {...props} />)
    uiInput = textInput.find(UIInput)
    expect(uiInput.props().autoComplete).toBe("one-time-password")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    shallow(<TextInput {...props} />)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false }
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)
    const wrappedDiv = wrapper.find("StyledTextInput").first()

    const { className, width } = wrappedDiv.props()
    // @ts-expect-error
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stTextInput")

    expect(width).toBe(getProps().width)
  })

  it("can be disabled", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)
    expect(wrapper.find(UIInput).prop("disabled")).toBe(props.disabled)
  })

  it("sets widget value on blur", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onChange")({
      target: { value: "testing" },
    } as React.ChangeEvent<HTMLInputElement>)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onBlur")()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      }
    )
  })

  it("sets widget value when enter is pressed", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onChange")({
      target: { value: "testing" },
    } as React.ChangeEvent<HTMLInputElement>)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onKeyPress")({
      preventDefault: jest.fn(),
      key: "Enter",
    })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      }
    )
  })

  it("doesn't set widget value when not dirty", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onKeyPress")({
      preventDefault: jest.fn(),
      key: "Enter",
    })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onBlur")()
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("limits input length if max_chars is passed", () => {
    const props = getProps({ maxChars: 10 })
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onChange")({
      target: { value: "0123456789" },
    } as EventTarget)

    expect(wrapper.find(UIInput).prop("value")).toBe("0123456789")

    // @ts-expect-error
    wrapper.find(UIInput).prop("onChange")({
      target: { value: "0123456789a" },
    } as EventTarget)

    expect(wrapper.find(UIInput).prop("value")).toBe("0123456789")
  })

  it("updates widget value on text changes when inside of a form", () => {
    const props = getProps({ formId: "form" })
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onChange")({
      target: { value: "TEST" },
    } as React.ChangeEvent<HTMLInputElement>)

    expect(wrapper.state("dirty")).toBe(false)

    // Check that the last call used the TEST value.
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "TEST",
      {
        fromUi: true,
      }
    )
  })

  it("does not update widget value on text changes when outside of a form", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringValue")
    const wrapper = shallow(<TextInput {...props} />)

    // @ts-expect-error
    wrapper.find(UIInput).prop("onChange")({
      target: { value: "TEST" },
    } as React.ChangeEvent<HTMLInputElement>)

    expect(wrapper.state("dirty")).toBe(true)

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      }
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringValue")

    const wrapper = shallow(<TextInput {...props} />)

    // Change the widget value
    // @ts-expect-error
    wrapper.find(UIInput).prop("onChange")({
      target: { value: "TEST" },
    } as React.ChangeEvent<HTMLInputElement>)

    expect(wrapper.state("value")).toBe("TEST")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "TEST",
      {
        fromUi: true,
      }
    )

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(wrapper.state("value")).toBe(props.element.default)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })
})

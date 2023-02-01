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

import { ShallowWrapper } from "enzyme"
import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  NumberInput as NumberInputProto,
} from "src/autogen/proto"
import React from "react"
import { mount, shallow } from "src/lib/test_util"
import { Input as UIInput } from "baseui/input"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import NumberInput, { Props, State } from "./NumberInput"

const getProps = (elementProps: Partial<NumberInputProto> = {}): Props => ({
  element: NumberInputProto.create({
    label: "Label",
    hasMin: false,
    hasMax: false,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

const getIntProps = (elementProps: Partial<NumberInputProto> = {}): Props => {
  return getProps({
    dataType: NumberInputProto.DataType.INT,
    default: 10,
    min: 0,
    max: 0,
    ...elementProps,
  })
}

const getFloatProps = (
  elementProps: Partial<NumberInputProto> = {}
): Props => {
  return getProps({
    dataType: NumberInputProto.DataType.FLOAT,
    default: 10.0,
    min: 0.0,
    max: 0.0,
    ...elementProps,
  })
}

describe("NumberInput widget", () => {
  it("renders without crashing", () => {
    const props = getIntProps()
    const wrapper = shallow(<NumberInput {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("adds a focused class when running onFocus", () => {
    const props = getIntProps()
    const wrapper = shallow(<NumberInput {...props} />)
    const input = wrapper.find(UIInput)

    expect(wrapper).toBeDefined()

    // @ts-ignore
    input.props().onFocus()

    expect(wrapper.state("isFocused")).toBe(true)
    expect(wrapper.find("StyledInputContainer").hasClass("focused")).toBe(true)
  })

  it("removes the focused class when running onBlur", () => {
    const props = getIntProps()
    const wrapper = shallow(<NumberInput {...props} />)
    const input = wrapper.find(UIInput)

    expect(wrapper).toBeDefined()

    // @ts-ignore
    input.props().onBlur()

    expect(wrapper.state("isFocused")).toBe(false)
    expect(wrapper.find("StyledInputContainer").hasClass("focused")).toBe(
      false
    )
  })

  it("handles malformed format strings without crashing", () => {
    // This format string is malformed (it should be %0.2f)
    const props = getFloatProps({
      default: 5.0,
      format: "%0.2",
    })
    const wrapper = shallow(<NumberInput {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.state("value")).toBe(5.0)
  })

  it("shows a label", () => {
    const props = getIntProps()
    const wrapper = mount(<NumberInput {...props} />)

    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.element.label)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getIntProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    const wrapper = mount(<NumberInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getIntProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    const wrapper = mount(<NumberInput {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED
    )
  })

  it("sets min/max defaults", () => {
    const props = getIntProps()
    const wrapper = shallow(<NumberInput {...props} />)

    // @ts-ignore
    expect(wrapper.instance().getMin()).toBe(-Infinity)
    // @ts-ignore
    expect(wrapper.instance().getMax()).toBe(+Infinity)
  })

  it("sets min/max values", () => {
    const props = getIntProps({
      hasMin: true,
      hasMax: true,
      default: 10,
      min: 0,
      max: 10,
    })
    const wrapper = shallow(<NumberInput {...props} />)

    // @ts-ignore
    expect(wrapper.instance().getMin()).toBe(0)
    // @ts-ignore
    expect(wrapper.instance().getMax()).toBe(10)
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getIntProps({ formId: "form", default: 10 })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setIntValue")

    const wrapper = shallow(<NumberInput {...props} />)

    // Change the widget value
    wrapper.setState({ dirty: true, value: 15 })
    const inputWrapper = wrapper.find(UIInput)
    // @ts-ignore
    inputWrapper.props().onKeyPress({ key: "Enter" })

    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      15,
      { fromUi: true }
    )

    // "Submit" the form
    props.widgetMgr.submitForm({ id: "submitFormButtonId", formId: "form" })
    wrapper.update()

    // Our widget should be reset, and the widgetMgr should be updated
    expect(wrapper.state("value")).toBe(props.element.default)
    expect(props.widgetMgr.setIntValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      }
    )
  })

  describe("FloatData", () => {
    it("changes state on ArrowDown", () => {
      const props = getFloatProps({
        format: "%0.2f",
        default: 11.0,
        step: 0.1,
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      const preventDefault = jest.fn()

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowDown",
        preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe(10.9)
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("sets widget value on mount", () => {
      const props = getFloatProps()
      jest.spyOn(props.widgetMgr, "setDoubleValue")

      shallow(<NumberInput {...props} />)

      expect(props.widgetMgr.setDoubleValue).toHaveBeenCalledWith(
        props.element,
        props.element.default,
        {
          fromUi: false,
        }
      )
    })

    it("sets value on Enter", () => {
      const props = getFloatProps({ default: 10 })
      jest.spyOn(props.widgetMgr, "setDoubleValue")

      const wrapper = shallow(<NumberInput {...props} />)

      wrapper.setState({ dirty: true })

      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyPress({
        key: "Enter",
      })

      expect(props.widgetMgr.setDoubleValue).toHaveBeenCalled()
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("sets initialValue from widgetMgr", () => {
      const props = getFloatProps({ default: 10.0 })
      props.widgetMgr.getDoubleValue = jest.fn(() => 15.0)

      const wrapper = shallow<NumberInput, Props, State>(
        <NumberInput {...props} />
      )
      expect(wrapper.state().value).toBe(15.0)
    })
  })

  describe("format", () => {
    it("honors format specification for integers (%d)", () => {
      const props = getIntProps({ format: "$%dk" })
      const wrapper = shallow(<NumberInput {...props} />)
      expect(wrapper.state("formattedValue")).toBe("$10k")
    })

    it("of %f%% and a value of 5.3 results in 5.3%", () => {
      const props = getFloatProps({ format: "%f%%", default: 5.3 })
      const wrapper = shallow(<NumberInput {...props} />)
      expect(wrapper.state("formattedValue")).toBe("5.3%")
    })

    it("input data only update if valid", () => {
      const props = getIntProps({ default: 10, format: "$%dk" })
      const wrapper = shallow(<NumberInput {...props} />)

      const InputWrapper = wrapper.find(UIInput)
      // @ts-ignore
      InputWrapper.props().onChange({
        // @ts-ignore
        target: {
          value: "$100",
        },
      })
      expect(wrapper.state("value")).toBe(10)
      expect(wrapper.state("dirty")).toBe(false)
      expect(wrapper.state("formattedValue")).toBe("$100")
    })

    it("ignore enter keypress if invalid", () => {
      const props = getIntProps({
        default: 10,
        value: 10,
        format: "$%dk",
      })
      jest.spyOn(props.widgetMgr, "setIntValue")

      const wrapper = shallow(<NumberInput {...props} />)

      const InputWrapper = wrapper.find(UIInput)
      // @ts-ignore
      InputWrapper.props().onKeyPress({
        key: "Enter",
      })

      expect(wrapper.state("dirty")).toBe(false)
      expect(props.widgetMgr.setIntValue).toHaveBeenCalled()
    })
  })

  describe("IntData", () => {
    it("passes a default value", () => {
      const props = getIntProps({ default: 10 })
      const wrapper = shallow(<NumberInput {...props} />)

      expect(wrapper.find(UIInput).props().value).toBe("10")
    })

    it("sets widget value on mount", () => {
      const props = getIntProps()
      jest.spyOn(props.widgetMgr, "setIntValue")

      shallow(<NumberInput {...props} />)

      expect(props.widgetMgr.setIntValue).toHaveBeenCalledWith(
        props.element,
        props.element.default,
        {
          fromUi: false,
        }
      )
    })

    it("calls onChange", () => {
      const props = getIntProps({ default: 10 })
      const wrapper = shallow(<NumberInput {...props} />)

      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onChange({
        target: {
          // @ts-ignore
          value: 1,
        },
      })

      expect(wrapper.state("value")).toBe(1)
      expect(wrapper.state("dirty")).toBe(true)
    })

    it("sets value on Enter", () => {
      const props = getIntProps({ default: 10 })
      jest.spyOn(props.widgetMgr, "setIntValue")

      const wrapper = shallow(<NumberInput {...props} />)

      wrapper.setState({ dirty: true })

      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyPress({
        key: "Enter",
      })

      expect(props.widgetMgr.setIntValue).toHaveBeenCalled()
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("sets initialValue from widgetMgr", () => {
      const props = getIntProps({ default: 10 })
      props.widgetMgr.getIntValue = jest.fn(() => 15)

      const wrapper = shallow<NumberInput, Props, State>(
        <NumberInput {...props} />
      )
      expect(wrapper.state().value).toBe(15)
    })
  })

  describe("Step", () => {
    function stepUpButton(
      wrapper: ShallowWrapper<NumberInput>
    ): ShallowWrapper<any, any> {
      return wrapper.find("StyledInputControl").at(1)
    }

    function stepDownButton(
      wrapper: ShallowWrapper<NumberInput>
    ): ShallowWrapper<any, any> {
      return wrapper.find("StyledInputControl").at(0)
    }

    it("passes the step prop", () => {
      const props = getIntProps({ default: 10, step: 1 })
      const wrapper = shallow(<NumberInput {...props} />)

      // @ts-ignore
      expect(wrapper.find(UIInput).props().overrides.Input.props.step).toBe(1)
    })

    it("changes state on ArrowUp", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      const preventDefault = jest.fn()

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowUp",
        preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe(11)
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("changes state on ArrowDown", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      const preventDefault = jest.fn()

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowDown",
        preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe(9)
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("handles stepDown button clicks", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      const wrapper = shallow(<NumberInput {...props} />)

      stepDownButton(wrapper).simulate("click")

      expect(wrapper.state("dirty")).toBe(false)
      expect(wrapper.state("value")).toBe(9)
    })

    it("handles stepUp button clicks", () => {
      const props = getIntProps({
        format: "%d",
        default: 10,
        step: 1,
      })
      const wrapper = shallow(<NumberInput {...props} />)

      stepUpButton(wrapper).simulate("click")

      expect(wrapper.state("dirty")).toBe(false)
      expect(wrapper.state("value")).toBe(11)
    })

    it("disables stepDown button when at min", () => {
      const props = getIntProps({ default: 1, step: 1, min: 0, hasMin: true })
      const wrapper = shallow(<NumberInput {...props} />)

      expect(stepDownButton(wrapper).prop("disabled")).toBe(false)

      stepDownButton(wrapper).simulate("click")

      expect(wrapper.state("value")).toBe(0)
      expect(stepDownButton(wrapper).prop("disabled")).toBe(true)
    })

    it("disables stepUp button when at max", () => {
      const props = getIntProps({ default: 1, step: 1, max: 2, hasMax: true })
      const wrapper = shallow(<NumberInput {...props} />)

      expect(stepUpButton(wrapper).prop("disabled")).toBe(false)

      stepUpButton(wrapper).simulate("click")

      expect(wrapper.state("value")).toBe(2)
      expect(stepUpButton(wrapper).prop("disabled")).toBe(true)
    })
  })
})

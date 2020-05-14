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

import { NumberInput as NumberInputProto } from "autogen/proto"
import React from "react"
import { shallow } from "enzyme"
import { Input as UIInput } from "baseui/input"
import { fromJS } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"

import NumberInput, { Props } from "./NumberInput"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()
const preventDefault = jest.fn()
const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    label: "Label",
    has_min: false,
    has_max: false,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

const getIntProps = (elementProps: object = {}): Props => {
  return getProps({
    dataType: NumberInputProto.DataType.INT,
    default: 10,
    min: 0,
    max: 0,
    ...elementProps,
  })
}

const getFloatProps = (elementProps: object = {}): Props => {
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

  it("should show a label", () => {
    const props = getIntProps()
    const wrapper = shallow(<NumberInput {...props} />)

    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  it("should set min/max defaults", () => {
    const props = getIntProps()
    const wrapper = shallow(<NumberInput {...props} />)

    // @ts-ignore
    expect(wrapper.instance().getMin()).toBe(-Infinity)
    // @ts-ignore
    expect(wrapper.instance().getMax()).toBe(+Infinity)
  })

  it("should set min/max", () => {
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

  describe("FloatData", () => {
    it("should change the state when ArrowDown", () => {
      const props = getFloatProps({
        format: "%0.2f",
        default: 11.0,
        step: 0.1,
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowDown",
        preventDefault: preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe(10.9)
      expect(wrapper.state("dirty")).toBe(false)
    })
  })

  describe("Value", () => {
    it("should pass a default value", () => {
      const props = getIntProps({ default: 10 })
      const wrapper = shallow(<NumberInput {...props} />)

      expect(wrapper.find(UIInput).props().value).toBe("10")
    })

    it("should call onChange", () => {
      const props = getIntProps({
        intData: {
          default: 10,
        },
      })
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

    it("should set value on Enter", () => {
      const props = getIntProps({
        intData: {
          default: 10,
        },
      })
      const wrapper = shallow(<NumberInput {...props} />)

      wrapper.setState({
        dirty: true,
      })

      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyPress({
        key: "Enter",
      })

      expect(props.widgetMgr.setIntValue).toHaveBeenCalled()
      expect(wrapper.state("dirty")).toBe(false)
    })
  })

  describe("Step", () => {
    it("should have an step", () => {
      const props = getIntProps({
        intData: {
          default: 10,
          step: 1,
        },
      })
      const wrapper = shallow(<NumberInput {...props} />)

      // @ts-ignore
      expect(wrapper.find(UIInput).props().overrides.Input.props.step).toBe(1)
    })

    it("should change the state when ArrowUp", () => {
      const props = getIntProps({
        format: "%d",
        intData: {
          default: 10,
          step: 1,
        },
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowUp",
        preventDefault: preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe(11)
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("should change the state when ArrowDown", () => {
      const props = getIntProps({
        format: "%d",
        intData: {
          default: 10,
          step: 1,
        },
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowDown",
        preventDefault: preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe(9)
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("stepDown button onClick", () => {
      const props = getIntProps({
        format: "%d",
        intData: {
          default: 10,
          step: 1,
        },
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const enhancer = wrapper.find(".controls .step-down")

      enhancer.simulate("click")

      expect(wrapper.state("dirty")).toBe(false)
      expect(wrapper.state("value")).toBe(9)
      expect(preventDefault).toHaveBeenCalled()
    })

    it("stepUp button onClick", () => {
      const props = getIntProps({
        format: "%d",
        intData: {
          default: 10,
          step: 1,
        },
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const enhancer = wrapper.find(".controls .step-up")

      enhancer.simulate("click")

      expect(wrapper.state("dirty")).toBe(false)
      expect(wrapper.state("value")).toBe(11)
      expect(preventDefault).toHaveBeenCalled()
    })
  })
})

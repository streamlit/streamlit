/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
import { Input as UIInput } from "baseui/input"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"

import NumberInput, { Props } from "./NumberInput"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()
const preventDefault = jest.fn()
const getProps = (elementProps: object = {}): Props => ({
  element: ImmutableMap({
    label: "Label",
    min: -Infinity,
    max: +Infinity,
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("NumberInput", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<NumberInput {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("Should show a label", () => {
    const props = getProps()
    const wrapper = shallow(<NumberInput {...props} />)

    expect(wrapper.find("label").text()).toBe(props.element.get("label"))
  })

  describe("Value", () => {
    it("Should pass a default value", () => {
      const props = getProps({
        default: 10,
      })
      const wrapper = shallow(<NumberInput {...props} />)

      expect(wrapper.find(UIInput).props().value).toBe(
        props.element.get("default")
      )
    })

    it("Should call onChange", () => {
      const props = getProps({
        default: 10,
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

    it("Should set value on Enter", () => {
      const props = getProps({
        default: 10,
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
    it("Should have an step", () => {
      const props = getProps({
        default: 10,
        step: 1,
      })
      const wrapper = shallow(<NumberInput {...props} />)

      // @ts-ignore
      expect(wrapper.find(UIInput).props().overrides.Input.props.step).toBe(1)
    })

    it("Should change the state when ArrowUp", () => {
      const props = getProps({
        default: 10,
        step: 1,
        format: "%d",
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowUp",
        preventDefault: preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe("11")
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("Should change the state when ArrowDown", () => {
      const props = getProps({
        default: 10,
        step: 1,
        format: "%d",
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const InputWrapper = wrapper.find(UIInput)

      // @ts-ignore
      InputWrapper.props().onKeyDown({
        key: "ArrowDown",
        preventDefault: preventDefault,
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(wrapper.state("value")).toBe("9")
      expect(wrapper.state("dirty")).toBe(false)
    })

    it("stepDown button onClick", () => {
      const props = getProps({
        default: 10,
        step: 1,
        format: "%d",
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const enhancer = wrapper.find(".controls .step-down")

      enhancer.simulate("click")

      expect(wrapper.state("dirty")).toBe(false)
      expect(wrapper.state("value")).toBe("9")
      expect(preventDefault).toHaveBeenCalled()
    })

    it("stepUp button onClick", () => {
      const props = getProps({
        default: 10,
        step: 1,
        format: "%d",
      })
      const wrapper = shallow(<NumberInput {...props} />)
      const enhancer = wrapper.find(".controls .step-up")

      enhancer.simulate("click")

      expect(wrapper.state("dirty")).toBe(false)
      expect(wrapper.state("value")).toBe("11")
      expect(preventDefault).toHaveBeenCalled()
    })
  })

  it("Should show a message when it's dirty", () => {
    const props = getProps()
    const wrapper = shallow(<NumberInput {...props} />)

    wrapper.setState({
      dirty: true,
    })

    expect(wrapper.find("div.instructions").length).toBe(1)
  })
})

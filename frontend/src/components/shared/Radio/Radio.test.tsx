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
import { mount } from "lib/test_util"

import { Radio as UIRadio, RadioGroup } from "baseui/radio"
import { Radio as RadioProto } from "autogen/proto"
import Radio, { Props } from "./Radio"

jest.mock("lib/WidgetStateManager")

const getProps = (props: Partial<RadioProto> = {}): Props => ({
  width: 0,
  disabled: false,
  value: 0,
  onChange: (selectedIndex: number) => {},
  options: ["a", "b", "c"],
  label: "Label",
  ...props,
})

describe("Radio widget", () => {
  const props = getProps()
  const wrapper = mount(<Radio {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(RadioGroup).length).toBe(1)
    expect(wrapper.find(UIRadio).length).toBe(3)
  })

  it("should have correct className and style", () => {
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stRadio")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label", () => {
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.label)
  })

  it("should have a default value", () => {
    expect(wrapper.find(RadioGroup).prop("value")).toBe(props.value.toString())
  })

  it("could be disabled", () => {
    expect(wrapper.find(RadioGroup).prop("disabled")).toBe(props.disabled)
  })

  it("should have the correct options", () => {
    const options = wrapper.find(UIRadio)

    options.forEach((option, index) => {
      expect(option.prop("value")).toBe(index.toString())
      expect(option.prop("children")).toBe(props.options[index])
    })
  })

  it("should show a message when there are no options to be shown", () => {
    const props = getProps({
      options: [],
    })
    const wrapper = mount(<Radio {...props} />)

    expect(wrapper.find(UIRadio).length).toBe(1)
    expect(wrapper.find(UIRadio).prop("children")).toBe(
      "No options to select."
    )
  })

  it("should select just one option and set the value", () => {
    // @ts-ignore
    wrapper.find(RadioGroup).prop("onChange")({
      target: {
        value: "1",
      },
    } as React.ChangeEvent<HTMLInputElement>)
    wrapper.update()

    expect(wrapper.find(RadioGroup).prop("value")).toBe("1")
  })
})

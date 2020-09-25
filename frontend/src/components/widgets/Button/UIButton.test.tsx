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
import { fromJS } from "immutable"
import { shallow } from "enzyme"
import { Button as BaseUIButton } from "baseui/button"

import { buttonOverrides } from "lib/widgetTheme"
import UIButton, { Props } from "./UIButton"

const getProps = (props: Partial<Props> = {}): Props => ({
  label: "Label",
  className: "class",
  disabled: false,
  onClick: jest.fn(),
  ...props,
})

describe("Button widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<UIButton {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("should have correct className", () => {
    const wrapper = shallow(<UIButton {...getProps()} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")
    expect(splittedClassName).toContain("stButton")
  })

  it("should render a label within the button", () => {
    const wrapper = shallow(<UIButton {...getProps()} />)

    const wrappedBaseButton = wrapper.find(BaseUIButton)

    expect(wrappedBaseButton.length).toBe(1)
    expect(wrappedBaseButton.props().children).toBe(getProps().label)
  })

  describe("UIButton props should work", () => {
    it("onClick prop", () => {
      const props = getProps()
      const wrapper = shallow(<UIButton {...props} />)

      const wrappedBaseButton = wrapper.find(BaseUIButton)

      wrappedBaseButton.simulate("click")

      expect(props.onClick).toHaveBeenCalledTimes(1)
    })

    it("disable prop", () => {
      const props = getProps()
      const wrapper = shallow(<UIButton {...props} />)

      const wrappedBaseButton = wrapper.find(BaseUIButton)

      expect(wrappedBaseButton.props().disabled).toBe(props.disabled)
    })

    it("overrides prop", () => {
      const props = getProps()
      const wrapper = shallow(<UIButton {...props} />)

      const wrappedBaseButton = wrapper.find(BaseUIButton)

      expect(wrappedBaseButton.props().overrides).toBe(buttonOverrides)
    })
  })
})

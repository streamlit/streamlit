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
import { buttonOverrides } from "lib/widgetTheme"
import { WidgetStateManager } from "lib/WidgetStateManager"

import { Button as UIButton } from "baseui/button"

import Button, { Props } from "./Button"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: object = {}): Props => ({
  element: fromJS({
    id: 1,
    label: "Label",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

describe("Button widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<Button {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("should have correct className and style", () => {
    const wrapper = shallow(<Button {...getProps()} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("Widget")
    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stButton")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label within the button", () => {
    const wrapper = shallow(<Button {...getProps()} />)

    const wrappedUIButton = wrapper.find(UIButton)

    expect(wrappedUIButton.length).toBe(1)
    expect(wrappedUIButton.props().children).toBe(
      getProps().element.get("label")
    )
  })

  describe("UIButton props should work", () => {
    it("onClick prop", () => {
      const props = getProps()
      const wrapper = shallow(<Button {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      wrappedUIButton.simulate("click")

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element.get("id"),
        { fromUi: true }
      )
    })

    it("disable prop", () => {
      const props = getProps()
      const wrapper = shallow(<Button {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      expect(wrappedUIButton.props().disabled).toBe(props.disabled)
    })

    it("overrides prop", () => {
      const props = getProps()
      const wrapper = shallow(<Button {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      expect(wrappedUIButton.props().overrides).toBe(buttonOverrides)
    })
  })
})

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
// We are using Shallow rendering from enzyme as we want
// to have a proper isolated testing environment for our
// Unit test.
import { fromJS } from "immutable"
import { shallow } from "enzyme"
import { buttonOverrides } from "lib/widgetTheme"
import { WidgetStateManager } from "lib/WidgetStateManager"

import { Button as UIButton } from "baseui/button"

import Button, { Props } from "./Button"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()

// After checking Button.tsx component props, we can see that this are the needed one.
// Nothing the less we should export the Props interface from that component
// in order to use that here.
const getProps = (elementProps: object = {}): Props => ({
  // properties of the Button proto that are actually being
  // used inside Button component.
  element: fromJS({
    id: 1,
    label: "Label",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager(sendBackMsg),
})

// We need to contain our test suite using a describe() function
describe("Button", () => {
  // Here we are creating our first and most basic test
  // in which the component should be rendered having all the default props
  it("renders without crashing", () => {
    // We get the default props using our existing method
    const props = getProps()
    // We render the component using shallow, passing our props
    const wrapper = shallow(<Button {...props} />)

    // Using expect (https://jestjs.io/docs/en/expect), we are gonna be checking
    // this component condition should be defined without crashing.
    expect(wrapper).toBeDefined()
  })

  // We define what """ it should be tested ""
  it("Should have correct className and style", () => {
    // We render our component using shallow wrapper as always
    const wrapper = shallow(<Button {...getProps()} />)

    // Using enzyme we 'find' the first div that is contained within our
    // component and which should have the classes and style
    const wrappedDiv = wrapper.find("div").first()

    // We are gonna be getting the className and style from the div
    const { className, style } = wrappedDiv.props()
    const splittedClassName = className.split(" ")

    // The className should contain the needed classes
    expect(splittedClassName).toContain("Widget")
    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stButton")

    // The style should have width and it needs to be the same as passed by props
    expect(style.width).toBe(getProps().width)
  })

  it("Should render a label within the button", () => {
    const wrapper = shallow(<Button {...getProps()} />)

    // We are gonna be finding the button inside our component
    const wrappedUIButton = wrapper.find(UIButton)

    // The quantity of buttons that it needs to have is one
    expect(wrappedUIButton.length).toBe(1)
    // The button should have the label passed in our pops
    expect(wrappedUIButton.props().children).toBe(
      getProps().element.get("label")
    )
  })

  describe("UIButton props should work", () => {
    it("onClick prop", () => {
      // We get a new props object
      const props = getProps()
      const wrapper = shallow(<Button {...props} />)
      // We search for a button that will be clicked
      const wrappedUIButton = wrapper.find(UIButton)

      // We simulate a click event
      wrappedUIButton.simulate("click")

      // And we expect that our mocked method has to be called with the correct
      // params
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

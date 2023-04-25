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
import { shallow } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

import UIButton from "src/lib/components/shared/Button"
import StreamlitMarkdown from "src/lib/components/shared/StreamlitMarkdown"

import { Button as ButtonProto } from "src/lib/proto"
import Button, { Props } from "./Button"

jest.mock("src/lib/WidgetStateManager")

const sendBackMsg = jest.fn()

const getProps = (elementProps: Partial<ButtonProto> = {}): Props => ({
  element: ButtonProto.create({
    id: "1",
    label: "Label",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  // @ts-expect-error
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
    // @ts-expect-error
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stButton")

    // @ts-expect-error
    expect(style.width).toBe(getProps().width)
  })

  it("should render a label within the button", () => {
    const wrapper = shallow(<Button {...getProps()} />)

    const wrappedUIButton = wrapper.find(UIButton)
    const wrappedButtonLabel = wrappedUIButton.find(StreamlitMarkdown)

    expect(wrappedUIButton.length).toBe(1)
    expect(wrappedButtonLabel.props().source).toBe(getProps().element.label)
    expect(wrappedButtonLabel.props().isButton).toBe(true)
  })

  describe("UIButton props should work", () => {
    it("onClick prop", () => {
      const props = getProps()
      const wrapper = shallow(<Button {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      wrappedUIButton.simulate("click")

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true }
      )
    })

    it("disable prop", () => {
      const props = getProps()
      const wrapper = shallow(<Button {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      expect(wrappedUIButton.props().disabled).toBe(props.disabled)
    })
  })

  it("does not use container width by default", () => {
    const wrapper = shallow(<Button {...getProps()}>Hello</Button>)

    const wrappedUIButton = wrapper.find(UIButton)
    expect(wrappedUIButton.props().fluidWidth).toBe(false)
  })

  it("passes useContainerWidth property correctly", () => {
    const wrapper = shallow(
      <Button {...getProps({ useContainerWidth: true })}>Hello</Button>
    )

    const wrappedUIButton = wrapper.find(UIButton)
    expect(wrappedUIButton.props().fluidWidth).toBe(true)
  })
})

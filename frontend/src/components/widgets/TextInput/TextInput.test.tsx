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
import { Input as UIInput } from "baseui/input"
import { fromJS } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"

import TextInput, { Props } from "./TextInput"
import { TextInput as TextInputProto } from "autogen/proto"

jest.mock("lib/WidgetStateManager")

const sendBackMsg = jest.fn()
const getProps = (elementProps: object = {}): Props => ({
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
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("should show a label", () => {
    const props = getProps()
    const wrapper = shallow(<TextInput {...props} />)

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
})

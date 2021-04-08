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

import { enableAllPlugins } from "immer"
import React from "react"

import { Button as ButtonProto } from "src/autogen/proto"

import UIButton from "src/components/shared/Button"
import { shallow } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { createFormsData, FormsManager } from "./FormsManager"
import { FormSubmitButton, Props } from "./FormSubmitButton"
import { FormsData } from "./index"

jest.mock("src/lib/WidgetStateManager")

// Required by ImmerJS
enableAllPlugins()

describe("FormSubmitButton", () => {
  let formsData: FormsData
  let formsMgr: FormsManager

  beforeEach(() => {
    formsData = createFormsData()
    formsMgr = new FormsManager(formsData, newData => {
      formsData = newData
    })
  })

  function getProps(props: Partial<Props> = {}): Props {
    return {
      element: ButtonProto.create({
        id: "1",
        label: "Submit",
        formId: "mockFormId",
      }),
      disabled: false,
      hasPendingChanges: false,
      hasInProgressUpload: false,
      width: 0,
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: jest.fn(),
        pendingFormsChanged: jest.fn(),
      }),
      formsMgr,
      ...props,
    }
  }

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<FormSubmitButton {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("has correct className and style", () => {
    const wrapper = shallow(<FormSubmitButton {...getProps()} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const classNameParts = className.split(" ")

    expect(classNameParts).toContain("stButton")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const wrapper = shallow(<FormSubmitButton {...getProps()} />)

    const wrappedUIButton = wrapper.find(UIButton)

    expect(wrappedUIButton.length).toBe(1)
    expect(wrappedUIButton.props().children).toBe(getProps().element.label)
  })

  it("calls submitForm when clicked", () => {
    const props = getProps()
    const wrapper = shallow(<FormSubmitButton {...props} />)

    const wrappedUIButton = wrapper.find(UIButton)

    wrappedUIButton.simulate("click")

    expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(props.element)
  })

  it("is disabled when form has pending upload", () => {
    const props = getProps({ hasInProgressUpload: true })
    const wrapper = shallow(<FormSubmitButton {...props} />)

    const wrappedUIButton = wrapper.find(UIButton)
    expect(wrappedUIButton.props().disabled).toBe(true)
  })

  it("increments submitButtonCount on mount and decrements on unmount", () => {
    expect(formsData.submitButtonCount.get("mockFormId")).toBeUndefined()

    const props = getProps()

    const wrapper1 = shallow(<FormSubmitButton {...props} />)
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(1)

    const wrapper2 = shallow(<FormSubmitButton {...props} />)
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(2)

    wrapper1.unmount()
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(1)

    wrapper2.unmount()
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(0)
  })
})

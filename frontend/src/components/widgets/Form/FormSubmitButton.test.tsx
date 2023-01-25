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

import { screen } from "@testing-library/dom"
import userEvent from "@testing-library/user-event"
import { enableAllPlugins } from "immer"
import React from "react"

import { Button as ButtonProto } from "src/autogen/proto"

import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import UIButton from "src/components/shared/Button"
import { render, shallow } from "src/lib/test_util"
import {
  createFormsData,
  FormsData,
  WidgetStateManager,
} from "src/lib/WidgetStateManager"
import { FormSubmitButton, Props } from "./FormSubmitButton"

// Required by ImmerJS
enableAllPlugins()

describe("FormSubmitButton", () => {
  let formsData: FormsData
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    formsData = createFormsData()
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(newData => {
        formsData = newData
      }),
    })
  })

  function getProps(
    props: Partial<Props> = {},
    useContainerWidth = false
  ): Props {
    return {
      element: ButtonProto.create({
        id: "1",
        label: "Submit",
        formId: "mockFormId",
        help: "mockHelpText",
        useContainerWidth,
      }),
      disabled: false,
      hasInProgressUpload: false,
      width: 0,
      widgetMgr,
      ...props,
    }
  }

  it("renders without crashing", () => {
    render(<FormSubmitButton {...getProps()} />)
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
    const markdownInsideWrappedUIButton =
      wrappedUIButton.find(StreamlitMarkdown)
    expect(markdownInsideWrappedUIButton.props().source).toBe(
      getProps().element.label
    )
  })

  it("calls submitForm when clicked", async () => {
    const props = getProps()
    const user = userEvent.setup()

    jest.spyOn(props.widgetMgr, "submitForm")

    render(<FormSubmitButton {...props} />)

    await user.click(screen.getByRole("button"))
    expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(props.element)
  })

  it("is disabled when form has pending upload", () => {
    const props = getProps({ hasInProgressUpload: true })
    render(<FormSubmitButton {...props} />)

    const button = screen.getByRole("button") as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it("increments submitButtonCount on mount and decrements on unmount", () => {
    expect(formsData.submitButtonCount.get("mockFormId")).toBeUndefined()

    const props = getProps()

    const wrapper1 = render(<FormSubmitButton {...props} />)
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(1)

    const wrapper2 = render(<FormSubmitButton {...props} />)
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(2)

    wrapper1.unmount()
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(1)

    wrapper2.unmount()
    expect(formsData.submitButtonCount.get("mockFormId")).toBe(0)
  })

  it("does not use container width by default", () => {
    const wrapper = shallow(<FormSubmitButton {...getProps()} />)

    const wrappedUIButton = wrapper.find(UIButton)
    expect(wrappedUIButton.props().fluidWidth).toBe(false)
  })

  it("passes useContainerWidth property correctly", () => {
    const wrapper = shallow(<FormSubmitButton {...getProps({}, true)} />)

    const wrappedUIButton = wrapper.find(UIButton)
    expect(wrappedUIButton.props().fluidWidth).toBe(true)
  })
})

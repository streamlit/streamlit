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

import { DownloadButton as DownloadButtonProto } from "src/autogen/proto"
import { mockEndpoints } from "src/lib/mocks/mocks"
import DownloadButton, { Props } from "./DownloadButton"

jest.mock("src/lib/WidgetStateManager")
jest.mock("src/lib/StreamlitEndpoints")

const getProps = (elementProps: Partial<DownloadButtonProto> = {}): Props => ({
  element: DownloadButtonProto.create({
    id: "1",
    label: "Label",
    url: "/media/mockDownloadURL",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  endpoints: mockEndpoints(),
})

describe("DownloadButton widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<DownloadButton {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("has correct className and style", () => {
    const wrapper = shallow(<DownloadButton {...getProps()} />)

    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-expect-error
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("stDownloadButton")

    // @ts-expect-error
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label within the button", () => {
    const wrapper = shallow(<DownloadButton {...getProps()} />)

    const wrappedUIButton = wrapper.find(UIButton)
    const wrappedButtonLabel = wrappedUIButton.find(StreamlitMarkdown)

    expect(wrappedUIButton.length).toBe(1)
    expect(wrappedButtonLabel.props().source).toBe(getProps().element.label)
    expect(wrappedButtonLabel.props().isButton).toBe(true)
  })

  describe("wrapped UIButton", () => {
    it("sets widget triggerValue and creates a download URL on click", () => {
      const props = getProps()
      const wrapper = shallow(<DownloadButton {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      wrappedUIButton.simulate("click")

      expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
        props.element,
        { fromUi: true }
      )

      expect(props.endpoints.buildMediaURL).toHaveBeenCalledWith(
        "/media/mockDownloadURL"
      )
    })

    it("handles the disabled prop", () => {
      const props = getProps()
      const wrapper = shallow(<DownloadButton {...props} />)

      const wrappedUIButton = wrapper.find(UIButton)

      expect(wrappedUIButton.props().disabled).toBe(props.disabled)
    })

    it("does not use container width by default", () => {
      const wrapper = shallow(
        <DownloadButton {...getProps()}>Hello</DownloadButton>
      )

      const wrappedUIButton = wrapper.find(UIButton)
      expect(wrappedUIButton.props().fluidWidth).toBe(false)
    })

    it("passes useContainerWidth property correctly", () => {
      const wrapper = shallow(
        <DownloadButton {...getProps({ useContainerWidth: true })}>
          Hello
        </DownloadButton>
      )

      const wrappedUIButton = wrapper.find(UIButton)
      expect(wrappedUIButton.props().fluidWidth).toBe(true)
    })
  })
})

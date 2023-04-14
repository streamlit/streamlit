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
import { BaseProvider, LightTheme } from "baseui"
import { ReactWrapper } from "enzyme"

import { ModalHeader, ModalFooter } from "src/lib/components/shared/Modal"
import { mount } from "src/lib/test_util"
import ScreencastDialog, { Props } from "./ScreencastDialog"

const getProps = (props: Partial<Props> = {}): Props => ({
  onClose: jest.fn(),
  startRecording: jest.fn(),
  toggleRecordAudio: jest.fn(),
  recordAudio: false,
  ...props,
})

describe("ScreencastDialog", () => {
  const props = getProps()
  let wrapper: ReactWrapper

  beforeEach(() => {
    wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <ScreencastDialog {...props} />
      </BaseProvider>
    )
  })

  afterEach(() => {
    wrapper.unmount()
  })

  it("renders without crashing", () => {
    expect(wrapper.html()).not.toBeNull()
  })

  it("should render a header", () => {
    const headerWrapper = wrapper.find(ModalHeader)
    expect(headerWrapper.props().children).toBe("Record a screencast")
  })

  describe("Modal body", () => {
    it("should have a record audio option to be selected", () => {
      const labelWrapper = wrapper.find("StyledRecordAudioLabel")

      labelWrapper.find("input").simulate("change", {
        target: {
          checked: true,
        },
      })
      wrapper.update()

      expect(labelWrapper.text()).toBe(" Also record audio")
      expect(wrapper.find("input").props().checked).toBeTruthy()
      expect(props.toggleRecordAudio).toBeCalled()
    })

    it("should have the stop recording explanation message", () => {
      expect(wrapper.find("StyledInstruction").text()).toBe(
        "Press Esc any time to stop recording."
      )
    })
  })

  describe("Modal footer", () => {
    it("should have an start button", () => {
      const buttonWrapper = wrapper.find(ModalFooter).find("button")

      buttonWrapper.simulate("click")

      expect(buttonWrapper.props().children).toBe("Start recording!")
      expect(props.startRecording).toBeCalled()
      expect(props.onClose).toBeCalled()
    })
  })
})

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
import { ModalHeader, ModalFooter, Button } from "reactstrap"

import ScreencastDialog, { Props } from "./ScreencastDialog"

const getProps = (props: object = {}): Props => ({
  onClose: jest.fn(),
  startRecording: jest.fn(),
  toggleRecordAudio: jest.fn(),
  recordAudio: false,
  ...props,
})

describe("ScreencastDialog", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<ScreencastDialog {...props} />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("should render a header", () => {
    const props = getProps()
    const wrapper = shallow(<ScreencastDialog {...props} />)
    const headerWrapper = wrapper.find(ModalHeader)

    // @ts-ignore
    headerWrapper.props().toggle()

    expect(headerWrapper.props().children).toBe("Record a screencast")
    expect(props.onClose).toBeCalled()
  })

  describe("Modal body", () => {
    it("should have a record audio option to be selected", () => {
      const props = getProps()
      const wrapper = shallow(<ScreencastDialog {...props} />)

      const labelWrapper = wrapper.find("p label")

      labelWrapper.find("input").simulate("change", {
        target: {
          checked: true,
        },
      })

      expect(labelWrapper.text()).toBe(" Also record audio")
      expect(wrapper.find("input").props().checked).toBeTruthy()
      expect(props.toggleRecordAudio).toBeCalled()
    })

    it("should have the stop recording explanation message", () => {
      const props = getProps()
      const wrapper = shallow(<ScreencastDialog {...props} />)

      expect(
        wrapper
          .find("p")
          .last()
          .text()
      ).toBe("Press Esc any time to stop recording.")
    })
  })

  describe("Modal footer", () => {
    it("should have an start button", () => {
      const props = getProps()
      const wrapper = shallow(<ScreencastDialog {...props} />)
      const buttonWrapper = wrapper.find(ModalFooter).find(Button)

      buttonWrapper.simulate("click")

      expect(buttonWrapper.props().children).toBe("Start recording!")
      expect(props.startRecording).toBeCalled()
      expect(props.onClose).toBeCalled()
    })
  })
})
